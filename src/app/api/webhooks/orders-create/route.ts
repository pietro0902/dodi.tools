import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/verify-webhook";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import PostPurchaseEmail from "@/emails/post-purchase";
import type { OrderWebhookPayload } from "@/types/shopify";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hmac = request.headers.get("x-shopify-hmac-sha256");

    if (!hmac || !verifyShopifyWebhook(rawBody, hmac)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order: OrderWebhookPayload = JSON.parse(rawBody);

    if (!order.email) {
      return NextResponse.json({ skipped: "No email" }, { status: 200 });
    }

    if (!hasMarketingConsent(order.customer?.email_marketing_consent)) {
      return NextResponse.json(
        { skipped: "No marketing consent" },
        { status: 200 }
      );
    }

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";
    const logoUrl = process.env.STORE_LOGO_URL;

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: order.email,
      subject: `Grazie per il tuo ordine #${order.order_number}!`,
      react: PostPurchaseEmail({
        firstName: order.customer?.first_name || "Cliente",
        orderNumber: order.order_number,
        totalPrice: order.total_price,
        currency: order.currency,
        lineItems: order.line_items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
        })),
        storeName,
        logoUrl,
      }),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Post-purchase email error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
