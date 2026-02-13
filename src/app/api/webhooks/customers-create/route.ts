import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/verify-webhook";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import { getAutomationSettings } from "@/lib/automation-settings";
import { blocksToHtml } from "@/lib/email-blocks";
import { logActivity } from "@/lib/activity-log";
import CampaignEmail from "@/emails/campaign";
import type { CustomerWebhookPayload } from "@/types/shopify";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hmac = request.headers.get("x-shopify-hmac-sha256");

    if (!hmac || !verifyShopifyWebhook(rawBody, hmac)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customer: CustomerWebhookPayload = JSON.parse(rawBody);

    if (!customer.email) {
      return NextResponse.json({ skipped: "No email" }, { status: 200 });
    }

    if (!hasMarketingConsent(customer.email_marketing_consent)) {
      return NextResponse.json(
        { skipped: "No marketing consent" },
        { status: 200 }
      );
    }

    const settings = await getAutomationSettings();

    if (!settings.welcome.enabled) {
      return NextResponse.json(
        { skipped: "Welcome automation disabled" },
        { status: 200 }
      );
    }

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";
    const firstName = customer.first_name || "Cliente";
    const replace = (s: string) => s.replace(/\{\{name\}\}/g, firstName);

    const w = settings.welcome;
    const subject = replace(w.subject);
    const bodyHtml = w.blocks && w.blocks.length > 0
      ? replace(blocksToHtml(w.blocks, w.btnColor || "#111827"))
      : replace(w.bodyHtml);
    const previewText = replace(w.preheader || w.subject);

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: customer.email,
      subject,
      react: CampaignEmail({
        firstName,
        subject,
        previewText,
        bodyHtml,
        storeName,
        bgColor: w.bgColor,
        btnColor: w.btnColor,
        containerColor: w.containerColor,
        textColor: w.textColor,
      }),
    });

    try {
      await logActivity({
        type: "welcome_email",
        summary: `Email di benvenuto inviata a ${customer.email}`,
        details: { customerEmail: customer.email },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Welcome email error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
