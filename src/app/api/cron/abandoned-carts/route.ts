import { NextRequest, NextResponse } from "next/server";
import { getAbandonedCheckouts } from "@/lib/shopify";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import { sendInBatches } from "@/lib/rate-limit";
import AbandonedCartEmail from "@/emails/abandoned-cart";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const checkouts = await getAbandonedCheckouts();
    const now = Date.now();
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

    // Filter: consent, time window 4-48h, deduplicate by email
    const seenEmails = new Set<string>();
    const eligible = checkouts.filter((checkout) => {
      if (!checkout.email) return false;
      if (!hasMarketingConsent(checkout.customer?.email_marketing_consent))
        return false;

      const age = now - new Date(checkout.created_at).getTime();
      if (age < FOUR_HOURS || age > FORTY_EIGHT_HOURS) return false;

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
    const logoUrl = process.env.STORE_LOGO_URL;

    const result = await sendInBatches(eligible, 100, 1000, async (checkout) => {
      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: checkout.email,
        subject: `Hai dimenticato qualcosa in ${storeName}!`,
        react: AbandonedCartEmail({
          firstName: checkout.customer?.first_name || "Cliente",
          checkoutUrl: checkout.abandoned_checkout_url,
          totalPrice: checkout.total_price,
          currency: checkout.currency,
          lineItems: checkout.line_items.map((item) => ({
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            variantTitle: item.variant_title,
          })),
          storeName,
          logoUrl,
        }),
      });
    });

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
