import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import { getFirstGiftCardProductImage } from "@/lib/shopify";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getFirstGiftCardProductImage();
    return NextResponse.json(result ?? { imageUrl: null, title: null, productUrl: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Gift card product fetch error:", message);
    return NextResponse.json({ imageUrl: null, title: null });
  }
}
