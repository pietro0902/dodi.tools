import { NextResponse } from "next/server";
import { getAbandonedCheckouts } from "@/lib/shopify";
import { getResendClient } from "@/lib/resend";
import { getAutomationSettings } from "@/lib/automation-settings";
import { blocksToHtml } from "@/lib/email-blocks";
import { buildCartItemsHtml } from "@/lib/cart-html";
import { logActivity } from "@/lib/activity-log";
import CampaignEmail from "@/emails/campaign";

// GET /api/abandoned-cart-test — return recent abandoned checkouts (last 10)
export async function GET() {
  try {
    const checkouts = await getAbandonedCheckouts();
    // Sort by most recent and return last 10
    const recent = [...checkouts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
    return NextResponse.json({ checkouts: recent });
  } catch (error) {
    console.error("Abandoned cart test GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/abandoned-cart-test — send test email using a checkout's data
export async function POST(request: Request) {
  try {
    const { email, checkoutId } = await request.json();

    if (!email || !checkoutId) {
      return NextResponse.json({ error: "Missing email or checkoutId" }, { status: 400 });
    }

    const checkouts = await getAbandonedCheckouts();
    const checkout = checkouts.find((c) => c.id === Number(checkoutId));
    if (!checkout) {
      return NextResponse.json({ error: "Checkout not found" }, { status: 404 });
    }

    const settings = await getAutomationSettings();
    const ac = settings.abandonedCart;
    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";

    const firstName = checkout.customer?.first_name || "Cliente";
    const replace = (s: string) => s.replace(/\{\{name\}\}/g, firstName);

    const cartBlock = ac.blocks?.find((b) => b.type === "cart_items");
    const cartColors = cartBlock?.type === "cart_items" ? {
      textColor: cartBlock.textColor,
      btnColor: cartBlock.btnColor,
      btnTextColor: cartBlock.btnTextColor,
    } : {};

    const cartHtml = buildCartItemsHtml(
      checkout.line_items.map((item) => ({
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
      to: email,
      subject: `[TEST] ${subject}`,
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

    try {
      await logActivity({
        type: "abandoned_cart_test",
        summary: `Email test carrello abbandonato inviata a ${email} (checkout #${checkoutId})`,
        details: { customerEmail: email },
      });
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Abandoned cart test POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
