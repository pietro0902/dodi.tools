import { NextResponse } from "next/server";
import { getOptInCustomers } from "@/lib/shopify";
import { getResendClient } from "@/lib/resend";
import {
  getScheduledCampaigns,
  saveScheduledCampaigns,
  type ScheduledCampaign,
} from "@/lib/scheduled-campaigns";
import { logActivity } from "@/lib/activity-log";
import { verifyQStashRequest } from "@/lib/qstash";
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

      // Save state BEFORE sending — prevents double-send if this request is retried
      campaign.pendingCustomerIds = remainingIds;
      if (remainingIds.length === 0) campaign.status = "sent";
      await saveScheduledCampaigns(campaigns);

      // Build and send batch
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
          return { from: process.env.EMAIL_FROM!, to: customer.email, subject: campaign.subject, html };
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

      if (failed > 0 && sent === 0) {
        // Restore batch so it can be retried manually
        campaign.pendingCustomerIds = [...thisBatchIds, ...remainingIds];
        campaign.status = "scheduled";
        await saveScheduledCampaigns(campaigns);
      }

      totalSent += sent;
      totalFailed += failed;

      const remaining = campaign.pendingCustomerIds?.length ?? 0;
      try {
        await logActivity({
          type: "scheduled_campaign_sent",
          summary: remaining > 0
            ? `Campagna '${campaign.subject}' — ${sent} inviati, ${remaining} rimangono`
            : `Campagna '${campaign.subject}' completata — ${sent} inviati`,
          details: { subject: campaign.subject, sent, failed, remaining },
        });
      } catch (logErr) {
        console.error("Activity log error:", logErr);
      }
    }

    return NextResponse.json({ processed: due.length, sent: totalSent, failed: totalFailed });
  } catch (error) {
    console.error("Scheduled campaign cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
