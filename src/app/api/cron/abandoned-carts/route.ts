import { NextResponse } from "next/server";
import { getAbandonedCheckouts } from "@/lib/shopify";
import { hasMarketingConsent } from "@/lib/consent";
import { getResendClient } from "@/lib/resend";
import { sendInBatches } from "@/lib/rate-limit";
import { getAutomationSettings } from "@/lib/automation-settings";
import { resolveTemplate, type ResolvedTemplate } from "@/lib/resolve-template";
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

    // Load template if configured
    let template: ResolvedTemplate | null = null;
    if (settings.abandonedCart.templateId) {
      template = await resolveTemplate(settings.abandonedCart.templateId);
    }

    const checkouts = await getAbandonedCheckouts();
    const now = Date.now();
    const delayMs = settings.abandonedCart.delayHours * 60 * 60 * 1000;
    const maxAgeMs = settings.abandonedCart.maxAgeHours * 60 * 60 * 1000;

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

      const cartHtml = buildCartItemsHtml(
        checkout.line_items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          variantTitle: item.variant_title,
        })),
        checkout.total_price,
        checkout.currency,
        checkout.abandoned_checkout_url
      );

      let subject: string;
      let fullBodyHtml: string;
      let previewText: string;
      let bgColor: string | undefined;
      let btnColor: string | undefined;
      let containerColor: string | undefined;
      let textColor: string | undefined;

      if (template) {
        subject = replace(template.subject);
        fullBodyHtml = replace(template.bodyHtml) + cartHtml;
        previewText = replace(template.preheader || template.subject);
        bgColor = template.bgColor;
        btnColor = template.btnColor;
        containerColor = template.containerColor;
        textColor = template.textColor;
      } else {
        subject = replace(settings.abandonedCart.subject);
        fullBodyHtml = replace(settings.abandonedCart.bodyHtml) + cartHtml;
        previewText = replace(settings.abandonedCart.preheader || settings.abandonedCart.subject);
        bgColor = settings.abandonedCart.bgColor;
        btnColor = settings.abandonedCart.btnColor;
        containerColor = settings.abandonedCart.containerColor;
        textColor = settings.abandonedCart.textColor;
      }

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
          bgColor,
          btnColor,
          containerColor,
          textColor,
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
