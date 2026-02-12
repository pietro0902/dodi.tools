import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import { getShopifyFiles } from "@/lib/shopify";

export async function GET(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "24", 10), 50);

    const files = await getShopifyFiles(query, limit);

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Files list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
