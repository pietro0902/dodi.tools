import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

function formatAmount(raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(".", ",");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "Cliente").toUpperCase();
  const amount = formatAmount(searchParams.get("amount") || "0");

  const templatePath = path.join(process.cwd(), "public", "gift-card-template.png");
  if (!fs.existsSync(templatePath)) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Dynamic import of sharp (it's a dependency of Next.js)
  const sharp = (await import("sharp")).default;

  const meta = await sharp(templatePath).metadata();
  const W = meta.width ?? 800;
  const H = meta.height ?? 1040;

  // Scale positions from reference 800x1040
  const sx = W / 800;
  const sy = H / 1040;
  const NAME_X = Math.round(52 * sx);
  const NAME_Y = Math.round(575 * sy);
  const AMOUNT_X = Math.round(52 * sx);
  const AMOUNT_Y = Math.round(665 * sy);
  const FONT_SIZE = Math.round(54 * sx);

  try {
    // Try sharp native text composite (requires pango on the server)
    const png = await sharp(templatePath)
      .composite([
        {
          input: {
            text: {
              text: `A: ${name}`,
              font: "sans",
              fontSize: FONT_SIZE,
              rgba: true,
              width: Math.round(700 * sx),
              height: Math.round(80 * sy),
            },
          },
          top: NAME_Y - FONT_SIZE,
          left: NAME_X,
          blend: "over",
        },
        {
          input: {
            text: {
              text: `VALORE: \u20AC${amount}`,
              font: "sans",
              fontSize: FONT_SIZE,
              rgba: true,
              width: Math.round(700 * sx),
              height: Math.round(80 * sy),
            },
          },
          top: AMOUNT_Y - FONT_SIZE,
          left: AMOUNT_X,
          blend: "over",
        },
      ])
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    // Fallback: return template as-is if text rendering fails
    const png = await sharp(templatePath).png().toBuffer();
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Fallback": "1" },
    });
  }
}
