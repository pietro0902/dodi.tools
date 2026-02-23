import { NextResponse } from "next/server";
import { getOptInCustomers } from "@/lib/shopify";
import { getResendClient } from "@/lib/resend";
import { sendInBatches } from "@/lib/rate-limit";
import {
  getScheduledCampaigns,
  saveScheduledCampaigns,
  type ScheduledCampaign,
} from "@/lib/scheduled-campaigns";
import { logActivity } from "@/lib/activity-log";
import { verifyQStashRequest, getQStashClient, getAppUrl } from "@/lib/qstash";
import CampaignEmail from "@/emails/campaign";

// Leave some headroom for transactional emails (welcome, cart, etc.)
const DAILY_LIMIT = 90;

export async function POST(request: Request) {
  try {
    const body = await verifyQStashRequest<{ campaignId?: string }>(request);
    if (body === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await getScheduledCampaigns();
    const now = new Date();

    // If a specific campaignId is provided, use only that one.
    // Otherwise pick all scheduled campaigns whose scheduledAt has passed.
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
      // Idempotent: skip if already sent or cancelled
      if (campaign.status !== "scheduled") continue;

      // Determine the full list of recipient IDs for this campaign
      let allRecipientIds: number[];

      if (campaign.pendingCustomerIds != null) {
        // Continuation batch — use the saved pending list
        allRecipientIds = campaign.pendingCustomerIds;
      } else {
        // First run — resolve recipients now
        let resolved = allCustomers;
        if (campaign.recipientMode === "manual" && campaign.customerIds?.length) {
          const idSet = new Set(campaign.customerIds);
          resolved = allCustomers.filter((c) => idSet.has(c.id));
        }
        allRecipientIds = resolved.map((c) => c.id);
      }

      // Slice this day's batch
      const thisBatchIds = allRecipientIds.slice(0, DAILY_LIMIT);
      const remainingIds = allRecipientIds.slice(DAILY_LIMIT);

      // Resolve to customer objects (re-checks opt-in status, handles unsubscribes)
      const batchIdSet = new Set(thisBatchIds);
      const batchCustomers = allCustomers.filter((c) => batchIdSet.has(c.id));

      if (batchCustomers.length === 0) {
        campaign.status = "sent";
        campaign.pendingCustomerIds = [];
        continue;
      }

      const result = await sendInBatches(batchCustomers, 100, 1000, async (customer) => {
        const firstName = customer.first_name || "Cliente";
        const personalizedHtml = campaign.bodyHtml.replace(/\{\{name\}\}/g, firstName);

        await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: customer.email,
          subject: campaign.subject,
          react: CampaignEmail({
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
          }),
        });
      });

      totalSent += result.sent;
      totalFailed += result.failed;

      if (remainingIds.length > 0) {
        // Schedule continuation for tomorrow at the same time
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
        // status stays "scheduled" — more to send tomorrow

        try {
          await logActivity({
            type: "scheduled_campaign_sent",
            summary: `Campagna '${campaign.subject}' — batch inviato a ${result.sent} iscritti, ne rimangono ${remainingIds.length}`,
            details: {
              subject: campaign.subject,
              sent: result.sent,
              failed: result.failed,
              remaining: remainingIds.length,
            },
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
            summary: `Campagna '${campaign.subject}' completata — inviata a ${result.sent} iscritti`,
            details: {
              subject: campaign.subject,
              sent: result.sent,
              failed: result.failed,
              remaining: 0,
            },
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
