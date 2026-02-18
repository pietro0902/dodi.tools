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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "Cliente").toUpperCase();
  const amount = formatAmount(searchParams.get("amount") || "0");

  const baseUrl = process.env.APP_URL || new URL(request.url).origin;
  const templateUrl = `${baseUrl}/gift-card-template.png`;

  // Check whether the template file exists
  let hasTemplate = false;
  try {
    const probe = await fetch(templateUrl, { method: "HEAD" });
    hasTemplate = probe.ok;
  } catch {
    hasTemplate = false;
  }

  return new ImageResponse(
    hasTemplate ? (
      // ── With template background ──────────────────────────────────────
      <div style={{ position: "relative", width: W, height: H, display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={templateUrl}
          width={W}
          height={H}
          style={{ position: "absolute", top: 0, left: 0 }}
          alt=""
        />
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
    ) : (
      // ── Fallback: pure-CSS gift card ──────────────────────────────────
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          borderRadius: 24,
          padding: 64,
          justifyContent: "space-between",
        }}
      >
        {/* Top: store name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div
            style={{
              color: "#e2c97e",
              fontSize: 36,
              fontWeight: 700,
              fontFamily: "sans-serif",
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            BUONO REGALO
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 22,
              fontFamily: "sans-serif",
              marginTop: 8,
            }}
          >
            Gift Card
          </div>
        </div>

        {/* Middle: amount */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(226,201,126,0.12)",
            borderRadius: 16,
            border: "2px solid rgba(226,201,126,0.3)",
            padding: "40px 48px",
          }}
        >
          <div
            style={{
              color: "#e2c97e",
              fontSize: 120,
              fontWeight: 900,
              fontFamily: "sans-serif",
              lineHeight: 1,
            }}
          >
            €{amount}
          </div>
        </div>

        {/* Bottom: recipient */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 24,
              fontFamily: "sans-serif",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            A
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: FONT_SIZE,
              fontWeight: 900,
              fontFamily: "sans-serif",
              letterSpacing: 2,
            }}
          >
            {name}
          </div>
          <div
            style={{
              width: 80,
              height: 3,
              background: "#e2c97e",
              borderRadius: 2,
              marginTop: 8,
            }}
          />
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
