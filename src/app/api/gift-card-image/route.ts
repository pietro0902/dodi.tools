import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

let wasmInited = false;
let cachedFont: ArrayBuffer | null = null;

async function ensureWasm() {
  if (wasmInited) return;
  const wasmPath = path.join(
    process.cwd(),
    "node_modules/@resvg/resvg-wasm/index_bg.wasm"
  );
  await initWasm(fs.readFileSync(wasmPath));
  wasmInited = true;
}

async function getFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const res = await fetch(
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff"
  );
  cachedFont = await res.arrayBuffer();
  return cachedFont;
}

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

  const templateBase64 = fs.readFileSync(templatePath).toString("base64");
  const dataUrl = `data:image/png;base64,${templateBase64}`;

  const sharp = (await import("sharp")).default;
  const meta = await sharp(templatePath).metadata();
  const W = meta.width ?? 800;
  const H = meta.height ?? 1040;

  const sx = W / 800;
  const sy = H / 1040;
  const NAME_X = Math.round(210 * sx);
  const NAME_Y = Math.round(720 * sy); // top of text (satori uses top, not baseline)
  const AMOUNT_X = Math.round(350 * sx);
  const AMOUNT_Y = Math.round(793 * sy);
  const FONT_SIZE = Math.round(54 * sx);

  await ensureWasm();
  const font = await getFont();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: W,
          height: H,
          position: "relative",
        },
        children: [
          {
            type: "img",
            props: {
              src: dataUrl,
              width: W,
              height: H,
              style: { position: "absolute", top: 0, left: 0 },
            },
          },
          {
            type: "span",
            props: {
              style: {
                position: "absolute",
                left: NAME_X,
                top: NAME_Y,
                fontSize: FONT_SIZE,
                fontWeight: 700,
                color: "#1a1a1a",
                fontFamily: "Inter",
              },
              children: name,
            },
          },
          {
            type: "span",
            props: {
              style: {
                position: "absolute",
                left: AMOUNT_X,
                top: AMOUNT_Y,
                fontSize: FONT_SIZE,
                fontWeight: 700,
                color: "#1a1a1a",
                fontFamily: "Inter",
              },
              children: `€${amount}`,
            },
          },
        ],
      },
  };

  const svg = await satori(element, {
    width: W,
    height: H,
    fonts: [
      {
        name: "Inter",
        data: font,
        weight: 700,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
  });
  const pngData = resvg.render();
  const pngBuffer = Buffer.from(pngData.asPng());

  return new NextResponse(pngBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
