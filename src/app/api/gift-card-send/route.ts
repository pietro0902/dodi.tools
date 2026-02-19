import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";
import { getAutomationSettings } from "@/lib/automation-settings";
import { blocksToHtml } from "@/lib/email-blocks";
import { logActivity } from "@/lib/activity-log";
import { markGiftCardOrderSent } from "@/lib/sent-gift-cards";
import CampaignEmail from "@/emails/campaign";

export async function POST(request: Request) {
  try {
    const { email, firstName, amount, orderId } = await request.json();

    if (!email || !firstName || !amount) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const settings = await getAutomationSettings();
    const gc = settings.giftCard;
    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";
    const replace = (s: string) => s.replace(/\{\{name\}\}/g, firstName);

    const subject = replace(gc.subject);
    let bodyHtml =
      gc.blocks && gc.blocks.length > 0
        ? replace(blocksToHtml(gc.blocks, gc.btnColor || "#111827"))
        : replace(gc.bodyHtml);
    const previewText = replace(gc.preheader || gc.subject);

    if (bodyHtml.includes("__GIFT_CARD_IMAGE__") || bodyHtml.includes("__GIFT_CARD_URL__")) {
      const appUrl = process.env.APP_URL || "";
      if (appUrl) {
        const generatedImageUrl = `${appUrl}/api/gift-card-image?name=${encodeURIComponent(firstName)}&amount=${encodeURIComponent(amount)}`;
        bodyHtml = bodyHtml.replace(/__GIFT_CARD_IMAGE__/g, generatedImageUrl);
        bodyHtml = bodyHtml.replace(/__GIFT_CARD_URL__/g, generatedImageUrl);
      }
    }

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
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

    if (orderId) {
      try {
        await markGiftCardOrderSent(Number(orderId));
      } catch (_) {}
    }

    try {
      await logActivity({
        type: "gift_card_email",
        summary: `Email gift card inviata manualmente a ${email}${orderId ? ` (ordine #${orderId})` : ""}`,
        details: { customerEmail: email },
      });
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gift card send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
