import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import path from "path";
import fs from "fs";

function formatAmount(raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(".", ",");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = escapeXml((searchParams.get("name") || "Cliente").toUpperCase());
  const amount = escapeXml(formatAmount(searchParams.get("amount") || "0"));

  const templatePath = path.join(process.cwd(), "public", "gift-card-template.png");

  if (!fs.existsSync(templatePath)) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Get actual template dimensions
  const meta = await sharp(templatePath).metadata();
  const W = meta.width ?? 800;
  const H = meta.height ?? 1040;

  // SVG overlay with the text
  const NAME_X = 52;
  const NAME_Y = 575;
  const AMOUNT_X = 52;
  const AMOUNT_Y = 665;
  const FONT_SIZE = 54;

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${NAME_X}"
        y="${NAME_Y}"
        font-family="Arial, sans-serif"
        font-size="${FONT_SIZE}"
        font-weight="900"
        fill="#1a1a1a"
      >A: ${name}</text>
      <text
        x="${AMOUNT_X}"
        y="${AMOUNT_Y}"
        font-family="Arial, sans-serif"
        font-size="${FONT_SIZE}"
        font-weight="900"
        fill="#1a1a1a"
      >VALORE: \u20AC${amount}</text>
    </svg>
  `;

  const png = await sharp(templatePath)
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png()
    .toBuffer();

  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
