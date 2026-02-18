import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/verify-webhook";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import { getAutomationSettings } from "@/lib/automation-settings";
import { blocksToHtml } from "@/lib/email-blocks";
import { logActivity } from "@/lib/activity-log";
import { getProductImageUrl } from "@/lib/shopify";
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

    // Prepend the gift card product image if available
    const giftCardItem = order.line_items.find((item) => item.gift_card === true);
    if (giftCardItem?.product_id) {
      const imageUrl = await getProductImageUrl(giftCardItem.product_id).catch(() => null);
      if (imageUrl) {
        bodyHtml = `<div style="text-align:center;margin-bottom:24px;"><img src="${imageUrl}" alt="${giftCardItem.title}" style="max-width:360px;width:100%;border-radius:8px;" /></div>` + bodyHtml;
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
