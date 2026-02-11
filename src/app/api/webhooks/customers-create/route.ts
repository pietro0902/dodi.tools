import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/verify-webhook";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import WelcomeEmail from "@/emails/welcome";
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

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";
    const storeUrl = process.env.STORE_URL || "";
    const logoUrl = process.env.STORE_LOGO_URL;

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: customer.email,
      subject: `Benvenuto in ${storeName}!`,
      react: WelcomeEmail({
        firstName: customer.first_name || "Cliente",
        storeName,
        storeUrl,
        logoUrl,
      }),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Welcome email error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
