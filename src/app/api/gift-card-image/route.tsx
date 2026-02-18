import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// ── Dimensions — must match your template image exactly ──
const W = 800;
const H = 1040;

// ── Text positions (px from top-left) — adjust to match your template ──
const NAME_X = 52;
const NAME_Y = 575;
const AMOUNT_X = 52;
const AMOUNT_Y = 665;
const FONT_SIZE = 54;
const TEXT_COLOR = "#1a1a1a";

function formatAmount(raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(".", ",");
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "Cliente").toUpperCase();
  const amount = formatAmount(searchParams.get("amount") || "0");

  const baseUrl = process.env.APP_URL || new URL(request.url).origin;
  const templateDataUrl = await toDataUrl(`${baseUrl}/gift-card-template.png`);

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: W,
          height: H,
          display: "flex",
          ...(templateDataUrl
            ? { backgroundImage: `url(${templateDataUrl})`, backgroundSize: "cover" }
            : { backgroundColor: "#ffffff" }),
        }}
      >
        <div
          style={{
            position: "absolute",
            top: NAME_Y,
            left: NAME_X,
            color: TEXT_COLOR,
            fontSize: FONT_SIZE,
            fontWeight: 900,
            fontFamily: "sans-serif",
            lineHeight: 1.1,
          }}
        >
          A: {name}
        </div>

        <div
          style={{
            position: "absolute",
            top: AMOUNT_Y,
            left: AMOUNT_X,
            color: TEXT_COLOR,
            fontSize: FONT_SIZE,
            fontWeight: 900,
            fontFamily: "sans-serif",
            lineHeight: 1.1,
          }}
        >
          VALORE: €{amount}
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
