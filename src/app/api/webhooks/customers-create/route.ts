import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/verify-webhook";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import { getAutomationSettings } from "@/lib/automation-settings";
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
    const logoUrl = process.env.STORE_LOGO_URL;
    const firstName = customer.first_name || "Cliente";

    const personalizedSubject = settings.welcome.subject.replace(/\{\{name\}\}/g, firstName);
    const personalizedBody = settings.welcome.bodyHtml.replace(/\{\{name\}\}/g, firstName);

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: customer.email,
      subject: personalizedSubject,
      react: CampaignEmail({
        firstName,
        subject: personalizedSubject,
        previewText: personalizedSubject,
        bodyHtml: personalizedBody,
        storeName,
        logoUrl,
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
