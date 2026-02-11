import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import { searchProducts } from "@/lib/shopify";
import type { ProductSortKey } from "@/types/shopify";

const VALID_SORT_KEYS: ProductSortKey[] = [
  "BEST_SELLING",
  "PRICE",
  "PRICE_DESC",
  "TITLE",
  "CREATED_AT",
  "RELEVANCE",
];

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q") || undefined;
  const collectionId = searchParams.get("collection") || undefined;
  const sortParam = searchParams.get("sort") || "BEST_SELLING";
  const limitParam = searchParams.get("limit");

  const sortKey = VALID_SORT_KEYS.includes(sortParam as ProductSortKey)
    ? (sortParam as ProductSortKey)
    : "BEST_SELLING";
  const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 50);

  try {
    const products = await searchProducts({ query, collectionId, sortKey, limit });
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Product search error:", message);
    return NextResponse.json(
      { error: `Failed to fetch products: ${message}` },
      { status: 500 }
    );
  }
}
