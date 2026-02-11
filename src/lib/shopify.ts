import type {
  AbandonedCheckoutsResponse,
  CustomersResponse,
  ShopifyCustomer,
  AbandonedCheckout,
  ShopifyProduct,
  ShopifyCollection,
  ProductSortKey,
} from "@/types/shopify";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    throw new Error("SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET must be set");
  }

  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to get access token: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000, // refresh 5 min early
  };

  return cachedToken.value;
}

function getBaseUrl(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error("SHOPIFY_STORE_DOMAIN is not set");
  return `https://${domain}/admin/api/2024-10`;
}

async function getHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  return {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  };
}

function parseLinkHeader(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

export async function getAbandonedCheckouts(): Promise<AbandonedCheckout[]> {
  const all: AbandonedCheckout[] = [];
  const headers = await getHeaders();
  let url: string | null = `${getBaseUrl()}/checkouts.json?status=open&limit=250`;

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
    }
    const data: AbandonedCheckoutsResponse = await res.json();
    all.push(...data.checkouts);
    url = parseLinkHeader(res.headers.get("link"));
  }

  return all;
}

export async function getOptInCustomers(): Promise<ShopifyCustomer[]> {
  const all: ShopifyCustomer[] = [];
  const headers = await getHeaders();
  let url: string | null = `${getBaseUrl()}/customers.json?limit=250`;

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
    }
    const data: CustomersResponse = await res.json();
    all.push(...data.customers);
    url = parseLinkHeader(res.headers.get("link"));
  }

  return all.filter(
    (c) => c.email_marketing_consent?.state === "subscribed"
  );
}

// --- GraphQL ---

function getGraphqlUrl(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error("SHOPIFY_STORE_DOMAIN is not set");
  return `https://${domain}/admin/api/2024-10/graphql.json`;
}

async function graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch(getGraphqlUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify GraphQL error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`GraphQL: ${json.errors[0].message}`);
  }
  return json.data as T;
}

const STORE_URL = process.env.STORE_URL || "https://www.dodishop.it";

interface SearchProductsOpts {
  query?: string;
  collectionHandle?: string;
  sortKey?: ProductSortKey;
  limit?: number;
}

export async function searchProducts(opts: SearchProductsOpts = {}): Promise<ShopifyProduct[]> {
  const { query, collectionHandle, sortKey = "BEST_SELLING", limit = 20 } = opts;

  // If filtering by collection, use collection query
  if (collectionHandle) {
    return searchProductsByCollection(collectionHandle, query, sortKey, limit);
  }

  // Map our sort keys to GraphQL ProductSortKeys
  const reverse = sortKey === "PRICE_DESC";
  const gqlSortKey = sortKey === "PRICE_DESC" ? "PRICE" : sortKey;

  const searchQuery = query ? `title:*${query}*` : "";

  const data = await graphqlQuery<{
    products: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          handle: string;
          featuredImage: { url: string } | null;
          priceRangeV2: {
            minVariantPrice: { amount: string; currencyCode: string };
          };
          compareAtPriceRange: {
            minVariantPrice: { amount: string };
          };
        };
      }>;
    };
  }>(
    `query SearchProducts($first: Int!, $query: String!, $sortKey: ProductSortKeys!, $reverse: Boolean!) {
      products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse) {
        edges {
          node {
            id
            title
            handle
            featuredImage { url }
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
            }
            compareAtPriceRange {
              minVariantPrice { amount }
            }
          }
        }
      }
    }`,
    { first: limit, query: searchQuery, sortKey: gqlSortKey, reverse }
  );

  return data.products.edges.map(({ node }) => mapProduct(node));
}

async function searchProductsByCollection(
  collectionHandle: string,
  query: string | undefined,
  sortKey: ProductSortKey,
  limit: number
): Promise<ShopifyProduct[]> {
  const reverse = sortKey === "PRICE_DESC";
  const gqlSortKey = sortKey === "PRICE_DESC" ? "PRICE" : sortKey;

  // Collection products have a different sort key enum
  const collSortKey = gqlSortKey === "BEST_SELLING" ? "BEST_SELLING"
    : gqlSortKey === "PRICE" ? "PRICE"
    : gqlSortKey === "TITLE" ? "TITLE"
    : gqlSortKey === "CREATED_AT" ? "CREATED"
    : "BEST_SELLING";

  const data = await graphqlQuery<{
    collectionByHandle: {
      products: {
        edges: Array<{
          node: {
            id: string;
            title: string;
            handle: string;
            featuredImage: { url: string } | null;
            priceRangeV2: {
              minVariantPrice: { amount: string; currencyCode: string };
            };
            compareAtPriceRange: {
              minVariantPrice: { amount: string };
            };
          };
        }>;
      };
    } | null;
  }>(
    `query CollectionProducts($handle: String!, $first: Int!, $sortKey: ProductCollectionSortKeys!, $reverse: Boolean!) {
      collectionByHandle(handle: $handle) {
        products(first: $first, sortKey: $sortKey, reverse: $reverse) {
          edges {
            node {
              id
              title
              handle
              featuredImage { url }
              priceRangeV2 {
                minVariantPrice { amount currencyCode }
              }
              compareAtPriceRange {
                minVariantPrice { amount }
              }
            }
          }
        }
      }
    }`,
    { handle: collectionHandle, first: limit, sortKey: collSortKey, reverse }
  );

  if (!data.collectionByHandle) return [];

  let products = data.collectionByHandle.products.edges.map(({ node }) => mapProduct(node));

  // Client-side title filter if query provided (collection query doesn't support title filter)
  if (query) {
    const q = query.toLowerCase();
    products = products.filter((p) => p.title.toLowerCase().includes(q));
  }

  return products;
}

function mapProduct(node: {
  id: string;
  title: string;
  handle: string;
  featuredImage: { url: string } | null;
  priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } };
  compareAtPriceRange: { minVariantPrice: { amount: string } };
}): ShopifyProduct {
  const compareAt = parseFloat(node.compareAtPriceRange.minVariantPrice.amount);
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    imageUrl: node.featuredImage?.url || null,
    price: node.priceRangeV2.minVariantPrice.amount,
    compareAtPrice: compareAt > 0 ? node.compareAtPriceRange.minVariantPrice.amount : null,
    currency: node.priceRangeV2.minVariantPrice.currencyCode,
    url: `${STORE_URL}/products/${node.handle}`,
  };
}

export async function getCollections(): Promise<ShopifyCollection[]> {
  const data = await graphqlQuery<{
    collections: {
      edges: Array<{
        node: { id: string; title: string; handle: string };
      }>;
    };
  }>(
    `query Collections {
      collections(first: 100, sortKey: TITLE) {
        edges {
          node { id title handle }
        }
      }
    }`
  );

  return data.collections.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    handle: node.handle,
  }));
}
