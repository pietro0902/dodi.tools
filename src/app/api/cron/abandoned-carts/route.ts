import { NextResponse } from "next/server";
import { getAbandonedCheckouts, enrichCheckoutLineItemImages } from "@/lib/shopify";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import { sendInBatches } from "@/lib/rate-limit";
import { getAutomationSettings } from "@/lib/automation-settings";
import { blocksToHtml } from "@/lib/email-blocks";
import { buildCartItemsHtml } from "@/lib/cart-html";
import { logActivity } from "@/lib/activity-log";
import { verifyQStashRequest } from "@/lib/qstash";
import CampaignEmail from "@/emails/campaign";

export async function POST(request: Request) {
  try {
    const body = await verifyQStashRequest(request);
    if (body === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getAutomationSettings();

    if (!settings.abandonedCart.enabled) {
      return NextResponse.json({
        sent: 0,
        message: "Abandoned cart automation disabled",
      });
    }

    const ac = settings.abandonedCart;

    const checkouts = await getAbandonedCheckouts();
    const now = Date.now();
    const delayMs = ac.delayHours * 60 * 60 * 1000;
    const maxAgeMs = ac.maxAgeHours * 60 * 60 * 1000;

    // Filter: consent, time window, deduplicate by email
    const seenEmails = new Set<string>();
    const eligible = checkouts.filter((checkout) => {
      if (!checkout.email) return false;
      if (!hasMarketingConsent(checkout.customer?.email_marketing_consent))
        return false;

      const age = now - new Date(checkout.created_at).getTime();
      if (age < delayMs || age > maxAgeMs) return false;

      const emailLower = checkout.email.toLowerCase();
      if (seenEmails.has(emailLower)) return false;
      seenEmails.add(emailLower);

      return true;
    });

    if (eligible.length === 0) {
      return NextResponse.json({ sent: 0, message: "No eligible carts" });
    }

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";

    const result = await sendInBatches(eligible, 100, 1000, async (checkout) => {
      const firstName = checkout.customer?.first_name || "Cliente";
      const replace = (s: string) => s.replace(/\{\{name\}\}/g, firstName);

      const cartBlock = ac.blocks?.find((b) => b.type === "cart_items");
      const cartColors = cartBlock?.type === "cart_items" ? {
        textColor: cartBlock.textColor,
        btnColor: cartBlock.btnColor,
        btnTextColor: cartBlock.btnTextColor,
      } : {};

      const enrichedItems = await enrichCheckoutLineItemImages(checkout.line_items);

      const cartHtml = buildCartItemsHtml(
        enrichedItems.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          variantTitle: item.variant_title,
          imageUrl: item.image?.src ?? null,
        })),
        checkout.total_price,
        checkout.currency,
        checkout.abandoned_checkout_url,
        cartColors
      );

      const subject = replace(ac.subject);
      const baseHtml = ac.blocks && ac.blocks.length > 0
        ? replace(blocksToHtml(ac.blocks, ac.btnColor || "#111827"))
        : replace(ac.bodyHtml);
      const fullBodyHtml = baseHtml.includes("__CART_ITEMS__")
        ? baseHtml.replace("__CART_ITEMS__", cartHtml)
        : baseHtml + cartHtml;
      const previewText = replace(ac.preheader || ac.subject);

      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: checkout.email,
        subject,
        react: CampaignEmail({
          firstName,
          subject,
          previewText,
          bodyHtml: fullBodyHtml,
          storeName,
          bgColor: ac.bgColor,
          btnColor: ac.btnColor,
          containerColor: ac.containerColor,
          textColor: ac.textColor,
        }),
      });
    });

    try {
      await logActivity({
        type: "abandoned_cart_batch",
        summary: `Email carrello abbandonato: ${result.sent} inviate`,
        details: {
          sent: result.sent,
          failed: result.failed,
          recipientCount: eligible.length,
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({
      eligible: eligible.length,
      ...result,
    });
  } catch (error) {
    console.error("Abandoned cart cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
