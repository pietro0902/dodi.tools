import { NextResponse } from "next/server";
import { getGiftCardOrders } from "@/lib/shopify";
import { getSentGiftCardOrderIds } from "@/lib/sent-gift-cards";

export async function GET() {
  try {
    const [orders, sentOrderIds] = await Promise.all([
      getGiftCardOrders(),
      getSentGiftCardOrderIds(),
    ]);
    return NextResponse.json({ orders, sentOrderIds });
  } catch (error) {
    console.error("Gift card orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
