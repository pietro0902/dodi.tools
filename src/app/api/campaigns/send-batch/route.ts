import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import { getOptInCustomers } from "@/lib/shopify";
import { getResendClient } from "@/lib/resend";
import { getScheduledCampaigns, saveScheduledCampaigns } from "@/lib/scheduled-campaigns";
import { logActivity } from "@/lib/activity-log";
import CampaignEmail from "@/emails/campaign";
import { renderAsync } from "@react-email/render";

const DAILY_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || "90", 10);

export async function POST(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId è obbligatorio" }, { status: 400 });
    }

    const campaigns = await getScheduledCampaigns();
    const campaign = campaigns.find((c) => c.id === campaignId);

    if (!campaign) {
      return NextResponse.json({ error: "Campagna non trovata" }, { status: 404 });
    }
    if (campaign.status !== "scheduled") {
      return NextResponse.json({ error: "Campagna non in stato scheduled" }, { status: 400 });
    }
    if (!campaign.pendingCustomerIds || campaign.pendingCustomerIds.length === 0) {
      campaign.status = "sent";
      await saveScheduledCampaigns(campaigns);
      return NextResponse.json({ sent: 0, remaining: 0, message: "Nessun destinatario rimasto" });
    }

    const allCustomers = await getOptInCustomers();
    const thisBatchIds = campaign.pendingCustomerIds.slice(0, DAILY_LIMIT);
    const remainingIds = campaign.pendingCustomerIds.slice(DAILY_LIMIT);

    const batchIdSet = new Set(thisBatchIds);
    const batchCustomers = allCustomers.filter((c) => batchIdSet.has(c.id));

    if (batchCustomers.length === 0) {
      campaign.status = "sent";
      campaign.pendingCustomerIds = [];
      await saveScheduledCampaigns(campaigns);
      return NextResponse.json({ sent: 0, remaining: 0 });
    }

    // Save state BEFORE sending
    campaign.pendingCustomerIds = remainingIds;
    if (remainingIds.length === 0) campaign.status = "sent";
    await saveScheduledCampaigns(campaigns);

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";

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
      // Restore so it can be retried
      campaign.pendingCustomerIds = [...thisBatchIds, ...remainingIds];
      campaign.status = "scheduled";
      await saveScheduledCampaigns(campaigns);
      return NextResponse.json({ error: "Invio fallito — riprova domani", sent: 0, failed }, { status: 500 });
    }

    try {
      await logActivity({
        type: "scheduled_campaign_sent",
        summary: remainingIds.length > 0
          ? `Campagna '${campaign.subject}' — ${sent} inviati, ${remainingIds.length} rimangono`
          : `Campagna '${campaign.subject}' completata — ${sent} inviati`,
        details: { subject: campaign.subject, sent, failed, remaining: remainingIds.length },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ sent, failed, remaining: remainingIds.length });
  } catch (error) {
    console.error("Send batch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
