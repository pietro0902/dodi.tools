import { NextRequest, NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";
import { getSessionFromRequest } from "@/lib/session-token";
import CampaignEmail from "@/emails/campaign";

interface TestEmailBody {
  to: string;
  subject: string;
  previewText?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  bgColor?: string;
  btnColor?: string;
  containerColor?: string;
  textColor?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: TestEmailBody = await request.json();

    if (!body.to || !body.subject || !body.bodyHtml) {
      return NextResponse.json(
        { error: "to, subject e bodyHtml sono obbligatori" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      return NextResponse.json({ error: "Indirizzo email non valido" }, { status: 400 });
    }

    const resend = getResendClient();
    const storeName = process.env.STORE_NAME || "Store";

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: body.to,
      subject: `[TEST] ${body.subject}`,
      react: CampaignEmail({
        firstName: "Test",
        subject: body.subject,
        previewText: body.previewText || body.subject,
        bodyHtml: body.bodyHtml.replace(/\{\{name\}\}/g, "Test"),
        ctaText: body.ctaText,
        ctaUrl: body.ctaUrl,
        storeName,
        bgColor: body.bgColor,
        btnColor: body.btnColor,
        containerColor: body.containerColor,
        textColor: body.textColor,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json({ error: "Errore nell'invio" }, { status: 500 });
  }
}
