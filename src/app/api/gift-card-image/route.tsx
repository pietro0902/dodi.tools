import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const W = 800;
const H = 1040;

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
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "Cliente").toUpperCase();
  const amount = formatAmount(searchParams.get("amount") || "0");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: W,
          height: H,
          background: "#ffffff",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <div style={{ color: "#ff0000", fontSize: 80, fontWeight: 900, fontFamily: "sans-serif" }}>
          A: {name}
        </div>
        <div style={{ color: "#ff0000", fontSize: 80, fontWeight: 900, fontFamily: "sans-serif" }}>
          VALORE: €{amount}
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
