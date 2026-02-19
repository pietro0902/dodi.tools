import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

let wasmInitPromise: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      // Try public folder first (works on Vercel), fall back to node_modules
      const publicWasm = path.join(process.cwd(), "public", "resvg.wasm");
      if (fs.existsSync(publicWasm)) {
        await initWasm(fs.readFileSync(publicWasm));
      } else {
        const nodeWasm = path.join(
          process.cwd(),
          "node_modules/@resvg/resvg-wasm/index_bg.wasm"
        );
        await initWasm(fs.readFileSync(nodeWasm));
      }
    })();
  }
  return wasmInitPromise;
}

let cachedFont: Buffer | null = null;

function getFont(): Buffer {
  if (cachedFont) return cachedFont;
  const fontPath = path.join(process.cwd(), "public", "inter-bold.ttf");
  cachedFont = fs.readFileSync(fontPath);
  return cachedFont;
}

function formatAmount(raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(".", ",");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = escapeXml((searchParams.get("name") || "Cliente").toUpperCase());
    const amount = escapeXml(formatAmount(searchParams.get("amount") || "0"));

    const templatePath = path.join(process.cwd(), "public", "gift-card-template.png");
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const templateBuffer = fs.readFileSync(templatePath);
    const sharp = (await import("sharp")).default;
    const meta = await sharp(templateBuffer).metadata();
    const W = meta.width ?? 800;
    const H = meta.height ?? 1040;

    const sx = W / 800;
    const sy = H / 1040;
    const NAME_X = Math.round(210 * sx);
    const NAME_Y = Math.round(765 * sy); // SVG text baseline
    const AMOUNT_X = Math.round(350 * sx);
    const AMOUNT_Y = Math.round(840 * sy);
    const FONT_SIZE = Math.round(54 * sx);

    await ensureWasm();
    const fontBuffer = getFont();

    // Build SVG with only the text overlay (transparent background)
    const textSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${NAME_X}" y="${NAME_Y}" font-family="Inter" font-size="${FONT_SIZE}" font-weight="700" fill="#1a1a1a">${name}</text>
  <text x="${AMOUNT_X}" y="${AMOUNT_Y}" font-family="Inter" font-size="${FONT_SIZE}" font-weight="700" fill="#1a1a1a">&#8364;${amount}</text>
</svg>`;

    // Convert text SVG → PNG with resvg-wasm, passing the TTF font directly
    const resvg = new Resvg(textSvg, {
      fitTo: { mode: "width", value: W },
      font: {
        fontBuffers: [new Uint8Array(fontBuffer)],
        loadSystemFonts: false,
      },
    });
    const textPngBuffer = Buffer.from(resvg.render().asPng());

    // Composite text PNG on top of template PNG with sharp
    const finalBuffer = await sharp(templateBuffer)
      .composite([{ input: textPngBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();

    return new NextResponse(finalBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Gift card image error:", err);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
