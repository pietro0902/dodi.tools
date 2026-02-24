import { NextRequest, NextResponse } from "next/server";
import { getOptInCustomers } from "@/lib/shopify";
import { getResendClient } from "@/lib/resend";
import { getSessionFromRequest } from "@/lib/session-token";
import { logActivity } from "@/lib/activity-log";
import { addScheduledCampaign } from "@/lib/scheduled-campaigns";
import CampaignEmail from "@/emails/campaign";
import { renderAsync } from "@react-email/render";

const DAILY_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || "90", 10);

interface CampaignBody {
  subject: string;
  previewText?: string;
  bodyHtml?: string;
  html?: string;
  ctaText?: string;
  ctaUrl?: string;
  customerIds?: number[];
  excludeCustomerIds?: number[];
  bgColor?: string;
  btnColor?: string;
  containerColor?: string;
  textColor?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.CAMPAIGN_API_KEY;

    const isApiKeyAuth = apiKey && authHeader === `Bearer ${apiKey}`;
    const isSessionAuth = !isApiKeyAuth && getSessionFromRequest(request);

    if (!isApiKeyAuth && !isSessionAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CampaignBody = await request.json();
    const htmlContent = body.bodyHtml || body.html;

    if (!body.subject || !htmlContent) {
      return NextResponse.json(
        { error: "subject and bodyHtml (or html) are required" },
        { status: 400 }
      );
    }

    let customers = await getOptInCustomers();

    // Filter to specific customer IDs if provided
    if (body.customerIds && body.customerIds.length > 0) {
      const idSet = new Set(body.customerIds);
      customers = customers.filter((c) => idSet.has(c.id));
    }

    // Exclude specific customer IDs (already received, or manually excluded)
    if (body.excludeCustomerIds && body.excludeCustomerIds.length > 0) {
      const excludeSet = new Set(body.excludeCustomerIds);
      customers = customers.filter((c) => !excludeSet.has(c.id));
    }

    if (customers.length === 0) {
      return NextResponse.json({ sent: 0, message: "Nessun destinatario trovato" });
    }

    const storeName = process.env.STORE_NAME || "Store";
    const resend = getResendClient();

    // Take today's batch
    const thisBatch = customers.slice(0, DAILY_LIMIT);
    const remaining = customers.slice(DAILY_LIMIT);

    // Build batch emails (one API call, no rate limit issues)
    const emails = await Promise.all(
      thisBatch.map(async (customer) => {
        const firstName = customer.first_name || "Cliente";
        const personalizedHtml = htmlContent.replace(/\{\{name\}\}/g, firstName);
        const html = await renderAsync(
          CampaignEmail({
            firstName,
            subject: body.subject,
            previewText: body.previewText || body.subject,
            bodyHtml: personalizedHtml,
            ctaText: body.ctaText,
            ctaUrl: body.ctaUrl,
            storeName,
            bgColor: body.bgColor,
            btnColor: body.btnColor,
            containerColor: body.containerColor,
            textColor: body.textColor,
          })
        );
        return {
          from: process.env.EMAIL_FROM!,
          to: customer.email,
          subject: body.subject,
          html,
        };
      })
    );

    let sent = 0;
    let failed = 0;

    try {
      const batchResult = await resend.batch.send(emails);
      // resend.batch.send returns { data: [...], error }
      if (batchResult.error) {
        console.error("Batch send error:", batchResult.error);
        failed = thisBatch.length;
      } else {
        sent = thisBatch.length;
      }
    } catch (err) {
      console.error("Batch send exception:", err);
      failed = thisBatch.length;
    }

    // If more recipients remain, save them as a pending campaign (manual trigger)
    let savedContinuation = false;
    if (remaining.length > 0 && sent > 0) {
      try {
        const campaignId = crypto.randomUUID();
        await addScheduledCampaign({
          id: campaignId,
          subject: body.subject,
          previewText: body.previewText,
          bodyHtml: htmlContent,
          ctaText: body.ctaText || "",
          ctaUrl: body.ctaUrl || "",
          logoWidth: 120,
          recipientMode: "manual",
          scheduledAt: new Date().toISOString(),
          status: "scheduled",
          createdAt: new Date().toISOString(),
          recipientCount: remaining.length,
          bgColor: body.bgColor,
          btnColor: body.btnColor,
          containerColor: body.containerColor,
          textColor: body.textColor,
          pendingCustomerIds: remaining.map((c) => c.id),
        });
        savedContinuation = true;
      } catch (err) {
        console.error("Failed to save continuation:", err);
      }
    }

    try {
      await logActivity({
        type: "campaign_sent",
        summary: `Campagna '${body.subject}' inviata a ${sent} iscritti${remaining.length > 0 ? `, altri ${remaining.length} schedulati` : ""}`,
        details: { subject: body.subject, sent, failed, recipientCount: customers.length },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({
      sent,
      failed,
      remaining: remaining.length,
      savedContinuation,
      dailyLimit: DAILY_LIMIT,
    });
  } catch (error) {
    console.error("Campaign send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
