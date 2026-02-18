import { NextRequest, NextResponse } from "next/server";
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

  const templateBase64 = fs.readFileSync(templatePath).toString("base64");
  const dataUrl = `data:image/png;base64,${templateBase64}`;

  // Use sharp (Next.js dep) only for dimensions — no bundling issues
  const sharp = (await import("sharp")).default;
  const meta = await sharp(templatePath).metadata();
  const W = meta.width ?? 800;
  const H = meta.height ?? 1040;

  const sx = W / 800;
  const sy = H / 1040;
  const NAME_X = Math.round(210 * sx);
  const NAME_Y = Math.round(768 * sy);
  const AMOUNT_X = Math.round(350 * sx);
  const AMOUNT_Y = Math.round(845 * sy);
  const FONT_SIZE = Math.round(54 * sx);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image href="${dataUrl}" x="0" y="0" width="${W}" height="${H}"/>
  <text x="${NAME_X}" y="${NAME_Y}" font-family="Arial, Helvetica, sans-serif" font-size="${FONT_SIZE}" font-weight="bold" fill="#1a1a1a">${name}</text>
  <text x="${AMOUNT_X}" y="${AMOUNT_Y}" font-family="Arial, Helvetica, sans-serif" font-size="${FONT_SIZE}" font-weight="bold" fill="#1a1a1a">&#8364;${amount}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
