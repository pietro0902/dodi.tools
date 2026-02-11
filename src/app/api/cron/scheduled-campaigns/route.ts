import { NextRequest, NextResponse } from "next/server";
import { getOptInCustomers } from "@/lib/shopify";
import { getResendClient } from "@/lib/resend";
import { sendInBatches } from "@/lib/rate-limit";
import {
  getScheduledCampaigns,
  saveScheduledCampaigns,
} from "@/lib/scheduled-campaigns";
import CampaignEmail from "@/emails/campaign";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await getScheduledCampaigns();
    const now = Date.now();

    const due = campaigns.filter(
      (c) => c.status === "scheduled" && new Date(c.scheduledAt).getTime() <= now
    );

    if (due.length === 0) {
      return NextResponse.json({ processed: 0, message: "No due campaigns" });
    }

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";
    const logoUrl = process.env.STORE_LOGO_URL;

    const results: Array<{ id: string; subject: string; sent: number; failed: number }> = [];

    for (const campaign of due) {
      try {
        let customers = await getOptInCustomers();

        if (campaign.recipientMode === "manual" && campaign.customerIds?.length) {
          const idSet = new Set(campaign.customerIds);
          customers = customers.filter((c) => idSet.has(c.id));
        }

        if (customers.length === 0) {
          campaign.status = "sent";
          results.push({ id: campaign.id, subject: campaign.subject, sent: 0, failed: 0 });
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
        results.push({ id: campaign.id, subject: campaign.subject, ...result });
      } catch (error) {
        console.error(`Failed to send campaign ${campaign.id}:`, error);
        results.push({ id: campaign.id, subject: campaign.subject, sent: 0, failed: -1 });
      }
    }

    await saveScheduledCampaigns(campaigns);

    return NextResponse.json({
      processed: due.length,
      results,
    });
  } catch (error) {
    console.error("Scheduled campaigns cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
