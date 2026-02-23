import { NextResponse } from "next/server";
import { getOptInCustomers } from "@/lib/shopify";
import { getResendClient } from "@/lib/resend";
import {
  getScheduledCampaigns,
  saveScheduledCampaigns,
  type ScheduledCampaign,
} from "@/lib/scheduled-campaigns";
import { logActivity } from "@/lib/activity-log";
import { verifyQStashRequest, getQStashClient, getAppUrl } from "@/lib/qstash";
import CampaignEmail from "@/emails/campaign";
import { renderAsync } from "@react-email/render";

const DAILY_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || "90", 10);

export async function POST(request: Request) {
  try {
    const body = await verifyQStashRequest<{ campaignId?: string }>(request);
    if (body === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await getScheduledCampaigns();
    const now = new Date();

    let due: ScheduledCampaign[];
    if (body.campaignId) {
      const found = campaigns.find((c) => c.id === body.campaignId);
      if (!found) {
        return NextResponse.json({ error: `Campaign ${body.campaignId} not found` }, { status: 404 });
      }
      due = [found];
    } else {
      due = campaigns.filter(
        (c) => c.status === "scheduled" && new Date(c.scheduledAt) <= now
      );
    }

    if (due.length === 0) {
      return NextResponse.json({ sent: 0, message: "No campaigns due" });
    }

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";
    const allCustomers = await getOptInCustomers();

    let totalSent = 0;
    let totalFailed = 0;

    for (const campaign of due) {
      if (campaign.status !== "scheduled") continue;

      // Determine recipients
      let allRecipientIds: number[];
      if (campaign.pendingCustomerIds != null) {
        allRecipientIds = campaign.pendingCustomerIds;
      } else {
        let resolved = allCustomers;
        if (campaign.recipientMode === "manual" && campaign.customerIds?.length) {
          const idSet = new Set(campaign.customerIds);
          resolved = allCustomers.filter((c) => idSet.has(c.id));
        }
        allRecipientIds = resolved.map((c) => c.id);
      }

      const thisBatchIds = allRecipientIds.slice(0, DAILY_LIMIT);
      const remainingIds = allRecipientIds.slice(DAILY_LIMIT);

      const batchIdSet = new Set(thisBatchIds);
      const batchCustomers = allCustomers.filter((c) => batchIdSet.has(c.id));

      if (batchCustomers.length === 0) {
        campaign.status = "sent";
        campaign.pendingCustomerIds = [];
        continue;
      }

      // Build all emails, then send in one batch call (no rate limit issues)
      const emails = await Promise.all(
        batchCustomers.map(async (customer) => {
          const firstName = customer.first_name || "Cliente";
          const personalizedHtml = campaign.bodyHtml.replace(/\{\{name\}\}/g, firstName);
          const html = await renderAsync(
            CampaignEmail({
              firstName,
              subject: campaign.subject,
              previewText: campaign.previewText || campaign.subject,
              bodyHtml: personalizedHtml,
              ctaText: campaign.ctaText || undefined,
              ctaUrl: campaign.ctaUrl || undefined,
              storeName,
              bgColor: campaign.bgColor,
              btnColor: campaign.btnColor,
              containerColor: campaign.containerColor,
              textColor: campaign.textColor,
            })
          );
          return {
            from: process.env.EMAIL_FROM!,
            to: customer.email,
            subject: campaign.subject,
            html,
          };
        })
      );

      let sent = 0;
      let failed = 0;

      try {
        const batchResult = await resend.batch.send(emails);
        if (batchResult.error) {
          console.error("Batch send error:", batchResult.error);
          failed = batchCustomers.length;
        } else {
          sent = batchCustomers.length;
        }
      } catch (err) {
        console.error("Batch send exception:", err);
        failed = batchCustomers.length;
      }

      totalSent += sent;
      totalFailed += failed;

      if (remainingIds.length > 0) {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        try {
          const qstash = getQStashClient();
          const { messageId } = await qstash.publishJSON({
            url: getAppUrl("/api/cron/scheduled-campaigns"),
            body: { campaignId: campaign.id },
            notBefore: Math.floor(tomorrow.getTime() / 1000),
            retries: 3,
          });
          campaign.qstashMessageId = messageId;
        } catch (err) {
          console.error("Failed to schedule next batch:", err);
        }

        campaign.pendingCustomerIds = remainingIds;

        try {
          await logActivity({
            type: "scheduled_campaign_sent",
            summary: `Campagna '${campaign.subject}' — ${sent} inviati, ${remainingIds.length} rimangono`,
            details: { subject: campaign.subject, sent, failed, remaining: remainingIds.length },
          });
        } catch (logErr) {
          console.error("Activity log error:", logErr);
        }
      } else {
        campaign.status = "sent";
        campaign.pendingCustomerIds = [];

        try {
          await logActivity({
            type: "scheduled_campaign_sent",
            summary: `Campagna '${campaign.subject}' completata — ${sent} inviati`,
            details: { subject: campaign.subject, sent, failed, remaining: 0 },
          });
        } catch (logErr) {
          console.error("Activity log error:", logErr);
        }
      }
    }

    await saveScheduledCampaigns(campaigns);

    return NextResponse.json({ processed: due.length, sent: totalSent, failed: totalFailed });
  } catch (error) {
    console.error("Scheduled campaign cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
