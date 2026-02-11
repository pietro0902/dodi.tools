import { NextRequest, NextResponse } from "next/server";
import { getOptInCustomers } from "@/lib/shopify";
import { getResendClient } from "@/lib/resend";
import { sendInBatches } from "@/lib/rate-limit";
import { getSessionFromRequest } from "@/lib/session-token";
import CampaignEmail from "@/emails/campaign";

interface CampaignBody {
  subject: string;
  previewText?: string;
  bodyHtml?: string;
  html?: string;
  ctaText?: string;
  ctaUrl?: string;
  logoWidth?: number;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.CAMPAIGN_API_KEY;

    // Accept either API key auth or session token auth (from embedded dashboard)
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

    const customers = await getOptInCustomers();

    if (customers.length === 0) {
      return NextResponse.json({
        sent: 0,
        message: "No opt-in customers found",
      });
    }

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";
    const logoUrl = process.env.STORE_LOGO_URL;

    const result = await sendInBatches(customers, 100, 1000, async (customer) => {
      const firstName = customer.first_name || "Cliente";
      const personalizedHtml = htmlContent.replace(/\{\{name\}\}/g, firstName);

      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: customer.email,
        subject: body.subject,
        react: CampaignEmail({
          firstName,
          subject: body.subject,
          previewText: body.previewText || body.subject,
          bodyHtml: personalizedHtml,
          ctaText: body.ctaText,
          ctaUrl: body.ctaUrl,
          storeName,
          logoUrl,
          logoWidth: body.logoWidth,
        }),
      });
    });

    return NextResponse.json({
      totalCustomers: customers.length,
      sentTo: customers.length,
      ...result,
    });
  } catch (error) {
    console.error("Campaign send error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
