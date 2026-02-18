import { NextRequest, NextResponse } from "next/server";
import { createCanvas, loadImage } from "@napi-rs/canvas";
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

  const template = await loadImage(templatePath);
  const W = template.width;
  const H = template.height;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Draw template background
  ctx.drawImage(template, 0, 0, W, H);

  // Scale text positions from reference 800x1040
  const sx = W / 800;
  const sy = H / 1040;
  const NAME_X = Math.round(52 * sx);
  const NAME_Y = Math.round(575 * sy);
  const AMOUNT_X = Math.round(52 * sx);
  const AMOUNT_Y = Math.round(665 * sy);
  const FONT_SIZE = Math.round(54 * sx);

  ctx.fillStyle = "#1a1a1a";
  ctx.font = `900 ${FONT_SIZE}px Arial, sans-serif`;
  ctx.fillText(`A: ${name}`, NAME_X, NAME_Y);
  ctx.fillText(`VALORE: \u20AC${amount}`, AMOUNT_X, AMOUNT_Y);

  const buffer = canvas.toBuffer("image/png");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
