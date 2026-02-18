import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/verify-webhook";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import { getAutomationSettings } from "@/lib/automation-settings";
import { blocksToHtml } from "@/lib/email-blocks";
import { logActivity } from "@/lib/activity-log";
import CampaignEmail from "@/emails/campaign";
import type { OrderWebhookPayload } from "@/types/shopify";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hmac = request.headers.get("x-shopify-hmac-sha256");

    if (!hmac || !verifyShopifyWebhook(rawBody, hmac)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order: OrderWebhookPayload = JSON.parse(rawBody);

    // Only process orders where ALL line items are gift cards
    const allGiftCards =
      order.line_items.length > 0 &&
      order.line_items.every((item) => item.gift_card === true);

    if (!allGiftCards) {
      return NextResponse.json(
        { skipped: "Order does not consist entirely of gift cards" },
        { status: 200 }
      );
    }

    if (!order.email) {
      return NextResponse.json({ skipped: "No email" }, { status: 200 });
    }

    if (!hasMarketingConsent(order.customer?.email_marketing_consent)) {
      return NextResponse.json(
        { skipped: "No marketing consent" },
        { status: 200 }
      );
    }

    const settings = await getAutomationSettings();

    if (!settings.giftCard.enabled) {
      return NextResponse.json(
        { skipped: "Gift card automation disabled" },
        { status: 200 }
      );
    }

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";
    const firstName = order.customer?.first_name || "Cliente";
    const replace = (s: string) => s.replace(/\{\{name\}\}/g, firstName);

    const gc = settings.giftCard;
    const subject = replace(gc.subject);
    let bodyHtml =
      gc.blocks && gc.blocks.length > 0
        ? replace(blocksToHtml(gc.blocks, gc.btnColor || "#111827"))
        : replace(gc.bodyHtml);
    const previewText = replace(gc.preheader || gc.subject);

    // Replace gift card placeholders with a personalized generated image
    if (bodyHtml.includes("__GIFT_CARD_IMAGE__") || bodyHtml.includes("__GIFT_CARD_URL__")) {
      const giftCardItem = order.line_items.find((item) => item.gift_card === true);
      const appUrl = process.env.APP_URL || "";
      if (appUrl && giftCardItem) {
        const amount = giftCardItem.price || "0";
        const generatedImageUrl = `${appUrl}/api/gift-card-image?name=${encodeURIComponent(firstName)}&amount=${encodeURIComponent(amount)}`;
        bodyHtml = bodyHtml.replace(/__GIFT_CARD_IMAGE__/g, generatedImageUrl);
        bodyHtml = bodyHtml.replace(/__GIFT_CARD_URL__/g, generatedImageUrl);
      } else {
        bodyHtml = bodyHtml.replace(/<div[^>]*><img src="__GIFT_CARD_IMAGE__"[^>]*\/>[\s\S]*?<\/div>/g, "");
        bodyHtml = bodyHtml.replace(/__GIFT_CARD_URL__/g, "#");
      }
    }

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: order.email,
      subject,
      react: CampaignEmail({
        firstName,
        subject,
        previewText,
        bodyHtml,
        storeName,
        bgColor: gc.bgColor,
        btnColor: gc.btnColor,
        containerColor: gc.containerColor,
        textColor: gc.textColor,
      }),
    });

    try {
      await logActivity({
        type: "gift_card_email",
        summary: `Email gift card inviata a ${order.email} (ordine #${order.order_number})`,
        details: {
          customerEmail: order.email,
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Gift card email error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
