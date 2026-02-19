import { NextResponse } from "next/server";
import { getGiftCardOrders } from "@/lib/shopify";

export async function GET() {
  try {
    const orders = await getGiftCardOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Gift card orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
