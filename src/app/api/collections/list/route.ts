import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import { getCollections } from "@/lib/shopify";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const collections = await getCollections();
    return NextResponse.json({ collections });
  } catch (error) {
    console.error("Collections list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
}
