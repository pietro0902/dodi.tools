import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/verify-webhook";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import { getAutomationSettings } from "@/lib/automation-settings";
import { resolveTemplate } from "@/lib/resolve-template";
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

    let subject: string;
    let bodyHtml: string;
    let previewText: string;
    let bgColor: string | undefined;
    let btnColor: string | undefined;
    let containerColor: string | undefined;
    let textColor: string | undefined;

    const tpl = settings.welcome.templateId
      ? await resolveTemplate(settings.welcome.templateId)
      : null;

    if (tpl) {
      subject = replace(tpl.subject);
      bodyHtml = replace(tpl.bodyHtml);
      previewText = replace(tpl.preheader || tpl.subject);
      bgColor = tpl.bgColor;
      btnColor = tpl.btnColor;
      containerColor = tpl.containerColor;
      textColor = tpl.textColor;
    } else {
      subject = replace(settings.welcome.subject);
      bodyHtml = replace(settings.welcome.bodyHtml);
      previewText = replace(settings.welcome.preheader || settings.welcome.subject);
      bgColor = settings.welcome.bgColor;
      btnColor = settings.welcome.btnColor;
      containerColor = settings.welcome.containerColor;
      textColor = settings.welcome.textColor;
    }

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
        bgColor,
        btnColor,
        containerColor,
        textColor,
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
