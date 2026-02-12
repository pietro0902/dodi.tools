import { NextResponse } from "next/server";
import { getOptInCustomers } from "@/lib/shopify";
import { getResendClient } from "@/lib/resend";
import { sendInBatches } from "@/lib/rate-limit";
import {
  getScheduledCampaigns,
  saveScheduledCampaigns,
} from "@/lib/scheduled-campaigns";
import { logActivity } from "@/lib/activity-log";
import { verifyQStashRequest } from "@/lib/qstash";
import CampaignEmail from "@/emails/campaign";

interface QStashBody {
  campaignId: string;
}

export async function POST(request: Request) {
  try {
    const body = await verifyQStashRequest<QStashBody>(request);
    if (body === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId } = body;
    if (!campaignId) {
      return NextResponse.json(
        { error: "campaignId is required" },
        { status: 400 }
      );
    }

    const campaigns = await getScheduledCampaigns();
    const campaign = campaigns.find((c) => c.id === campaignId);

    if (!campaign) {
      return NextResponse.json(
        { error: `Campaign ${campaignId} not found` },
        { status: 404 }
      );
    }

    // Idempotent: skip if already sent or cancelled
    if (campaign.status !== "scheduled") {
      return NextResponse.json({
        skipped: true,
        reason: `Campaign status is '${campaign.status}'`,
      });
    }

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";
    const logoUrl = process.env.STORE_LOGO_URL;

    let customers = await getOptInCustomers();

    if (campaign.recipientMode === "manual" && campaign.customerIds?.length) {
      const idSet = new Set(campaign.customerIds);
      customers = customers.filter((c) => idSet.has(c.id));
    }

    if (customers.length === 0) {
      campaign.status = "sent";
      await saveScheduledCampaigns(campaigns);
      return NextResponse.json({
        campaignId,
        sent: 0,
        failed: 0,
        message: "No eligible recipients",
      });
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
          previewText: campaign.subject,
          bodyHtml: personalizedHtml,
          ctaText: campaign.ctaText || undefined,
          ctaUrl: campaign.ctaUrl || undefined,
          storeName,
          logoUrl,
          logoWidth: campaign.logoWidth,
        }),
      });
    });

    campaign.status = "sent";
    await saveScheduledCampaigns(campaigns);

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

    return NextResponse.json({
      campaignId,
      subject: campaign.subject,
      ...result,
    });
  } catch (error) {
    console.error("Scheduled campaign cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
