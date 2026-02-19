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
import { verifyQStashRequest } from "@/lib/qstash";
import CampaignEmail from "@/emails/campaign";

export async function POST(request: Request) {
  try {
    const body = await verifyQStashRequest<{ campaignId?: string }>(request);
    if (body === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await getScheduledCampaigns();
    const now = new Date();

    // If a specific campaignId is provided (legacy/manual trigger), use only that one.
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

      let customers = allCustomers;
      if (campaign.recipientMode === "manual" && campaign.customerIds?.length) {
        const idSet = new Set(campaign.customerIds);
        customers = customers.filter((c) => idSet.has(c.id));
      }

      if (customers.length === 0) {
        campaign.status = "sent";
        continue;
      }

      const result = await sendInBatches(customers, 100, 1000, async (customer) => {
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

      campaign.status = "sent";
      totalSent += result.sent;
      totalFailed += result.failed;

      try {
        await logActivity({
          type: "scheduled_campaign_sent",
          summary: `Campagna programmata '${campaign.subject}' inviata a ${result.sent} iscritti`,
          details: {
            subject: campaign.subject,
            sent: result.sent,
            failed: result.failed,
            recipientCount: customers.length,
          },
        });
      } catch (logErr) {
        console.error("Activity log error:", logErr);
      }
    }

    await saveScheduledCampaigns(campaigns);

    return NextResponse.json({ processed: due.length, sent: totalSent, failed: totalFailed });
  } catch (error) {
    console.error("Scheduled campaign cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
