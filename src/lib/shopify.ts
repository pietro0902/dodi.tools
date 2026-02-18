import type {
  AbandonedCheckoutsResponse,
  CustomersResponse,
  ShopifyCustomer,
  AbandonedCheckout,
  ShopifyProduct,
  ShopifyCollection,
  ProductSortKey,
  OrderWebhookPayload,
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

export async function getOrder(orderId: number): Promise<OrderWebhookPayload | null> {
  const headers = await getHeaders();
  const res = await fetch(`${getBaseUrl()}/orders/${orderId}.json`, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.order as OrderWebhookPayload) || null;
}

export async function getProductImageUrl(productId: number): Promise<string | null> {
  const headers = await getHeaders();
  const res = await fetch(`${getBaseUrl()}/products/${productId}.json?fields=images`, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const src = data.product?.images?.[0]?.src as string | undefined;
  return src || null;
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

export async function graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
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
  collectionId?: string;
  sortKey?: ProductSortKey;
  limit?: number;
}

const PRODUCT_FIELDS = `
  id
  title
  handle
  featuredImage { url }
  priceRange {
    minVariantPrice { amount currencyCode }
  }
  compareAtPriceRange {
    minVariantCompareAtPrice { amount }
  }
`;

interface ProductNode {
  id: string;
  title: string;
  handle: string;
  featuredImage: { url: string } | null;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  compareAtPriceRange: {
    minVariantCompareAtPrice: { amount: string } | null;
  } | null;
}

export async function searchProducts(opts: SearchProductsOpts = {}): Promise<ShopifyProduct[]> {
  const { query, collectionId, sortKey = "BEST_SELLING", limit = 20 } = opts;

  // If filtering by collection, use collection query (supports BEST_SELLING and PRICE sort)
  if (collectionId) {
    return searchProductsByCollection(collectionId, query, sortKey, limit);
  }

  // ProductSortKeys only supports: TITLE, PRODUCT_TYPE, VENDOR, INVENTORY_TOTAL,
  // UPDATED_AT, CREATED_AT, PUBLISHED_AT, RELEVANCE, ID.
  // BEST_SELLING and PRICE are NOT valid here — we fetch and sort client-side.
  const needsClientSort = ["BEST_SELLING", "PRICE", "PRICE_DESC"].includes(sortKey);
  const gqlSortKey = needsClientSort ? "UPDATED_AT" : sortKey === "CREATED_AT" ? "CREATED_AT" : sortKey;
  const reverse = needsClientSort ? true : false;
  const fetchLimit = needsClientSort ? 50 : limit;

  // Use query filter only when there's a search term — empty string returns no results
  const hasQuery = !!query;
  const gqlQuery = hasQuery
    ? `query SearchProducts($first: Int!, $query: String!, $sortKey: ProductSortKeys!, $reverse: Boolean!) {
        products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse) {
          edges { node { ${PRODUCT_FIELDS} } }
        }
      }`
    : `query ListProducts($first: Int!, $sortKey: ProductSortKeys!, $reverse: Boolean!) {
        products(first: $first, sortKey: $sortKey, reverse: $reverse) {
          edges { node { ${PRODUCT_FIELDS} } }
        }
      }`;

  const variables: Record<string, unknown> = { first: fetchLimit, sortKey: gqlSortKey, reverse };
  if (hasQuery) variables.query = `title:*${query}*`;

  const data = await graphqlQuery<{
    products: { edges: Array<{ node: ProductNode }> };
  }>(gqlQuery, variables);

  let products = data.products.edges.map(({ node }) => mapProduct(node));

  // Client-side sort for PRICE / PRICE_DESC (BEST_SELLING keeps server order as-is)
  if (sortKey === "PRICE") {
    products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  } else if (sortKey === "PRICE_DESC") {
    products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  }

  return products.slice(0, limit);
}

async function searchProductsByCollection(
  collectionId: string,
  query: string | undefined,
  sortKey: ProductSortKey,
  limit: number
): Promise<ShopifyProduct[]> {
  const reverse = sortKey === "PRICE_DESC";
  const gqlSortKey = sortKey === "PRICE_DESC" ? "PRICE" : sortKey;

  // ProductCollectionSortKeys: MANUAL, BEST_SELLING, ALPHA, PRICE, CREATED, COLLECTION_DEFAULT, RELEVANCE, ID
  const collSortKey = gqlSortKey === "BEST_SELLING" ? "BEST_SELLING"
    : gqlSortKey === "PRICE" ? "PRICE"
    : gqlSortKey === "TITLE" ? "ALPHA"
    : gqlSortKey === "CREATED_AT" ? "CREATED"
    : "BEST_SELLING";

  const data = await graphqlQuery<{
    collection: {
      products: { edges: Array<{ node: ProductNode }> };
    } | null;
  }>(
    `query CollectionProducts($id: ID!, $first: Int!, $sortKey: ProductCollectionSortKeys!, $reverse: Boolean!) {
      collection(id: $id) {
        products(first: $first, sortKey: $sortKey, reverse: $reverse) {
          edges { node { ${PRODUCT_FIELDS} } }
        }
      }
    }`,
    { id: collectionId, first: limit, sortKey: collSortKey, reverse }
  );

  if (!data.collection) return [];

  let products = data.collection.products.edges.map(({ node }) => mapProduct(node));

  // Client-side title filter if query provided (collection query doesn't support title filter)
  if (query) {
    const q = query.toLowerCase();
    products = products.filter((p) => p.title.toLowerCase().includes(q));
  }

  return products;
}

// Shopify GraphQL returns MoneyV2.amount in minor units (centesimi) for this store
function toMajorUnits(amount: string): string {
  return (parseFloat(amount) / 100).toFixed(2);
}

function mapProduct(node: ProductNode): ShopifyProduct {
  const compareAtStr = node.compareAtPriceRange?.minVariantCompareAtPrice?.amount;
  const compareAtMajor = compareAtStr ? toMajorUnits(compareAtStr) : null;
  const compareAt = compareAtMajor ? parseFloat(compareAtMajor) : 0;
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    imageUrl: node.featuredImage?.url || null,
    price: toMajorUnits(node.priceRange.minVariantPrice.amount),
    compareAtPrice: compareAt > 0 ? compareAtMajor : null,
    currency: node.priceRange.minVariantPrice.currencyCode,
    url: `${STORE_URL}/products/${node.handle}`,
  };
}

// --- File uploads (Shopify Files API) ---

interface StagedUploadTarget {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
}

export async function uploadFileToShopify(
  file: Buffer,
  filename: string,
  mimeType: string,
  fileSize: number
): Promise<string> {
  const staged = await createStagedUpload(filename, mimeType, fileSize);
  await uploadToStagedUrl(staged, file, filename, mimeType);
  const fileId = await createShopifyFile(staged.resourceUrl);
  return await pollForFileUrl(fileId);
}

async function createStagedUpload(
  filename: string,
  mimeType: string,
  fileSize: number
): Promise<StagedUploadTarget> {
  const data = await graphqlQuery<{
    stagedUploadsCreate: {
      stagedTargets: StagedUploadTarget[];
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(
    `mutation StagedUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          resource: "IMAGE",
          filename,
          mimeType,
          fileSize: fileSize.toString(),
          httpMethod: "POST",
        },
      ],
    }
  );

  const errors = data.stagedUploadsCreate.userErrors;
  if (errors.length > 0) {
    throw new Error(`Staged upload: ${errors[0].message}`);
  }

  return data.stagedUploadsCreate.stagedTargets[0];
}

async function uploadToStagedUrl(
  target: StagedUploadTarget,
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<void> {
  const formData = new FormData();
  for (const param of target.parameters) {
    formData.append(param.name, param.value);
  }
  const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  formData.append("file", new Blob([arrayBuffer], { type: mimeType }), filename);

  const res = await fetch(target.url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }
}

async function createShopifyFile(resourceUrl: string): Promise<string> {
  const data = await graphqlQuery<{
    fileCreate: {
      files: Array<{ id: string }>;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(
    `mutation FileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id }
        userErrors { field message }
      }
    }`,
    {
      files: [{ originalSource: resourceUrl, contentType: "IMAGE" }],
    }
  );

  const errors = data.fileCreate.userErrors;
  if (errors.length > 0) {
    throw new Error(`File create: ${errors[0].message}`);
  }

  return data.fileCreate.files[0].id;
}

async function pollForFileUrl(
  fileId: string,
  maxAttempts = 15
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await graphqlQuery<{
      node: {
        image?: { url: string };
        fileStatus: string;
      } | null;
    }>(
      `query FileStatus($id: ID!) {
        node(id: $id) {
          ... on MediaImage {
            image { url }
            fileStatus
          }
        }
      }`,
      { id: fileId }
    );

    if (data.node?.image?.url && data.node.fileStatus === "READY") {
      return data.node.image.url;
    }

    if (data.node?.fileStatus === "FAILED") {
      throw new Error("Elaborazione immagine fallita");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Timeout: elaborazione immagine troppo lunga");
}

export async function getCollections(): Promise<ShopifyCollection[]> {
  const all: Array<{ id: string; title: string; handle: string }> = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const variables: Record<string, unknown> = { first: 250 };
    if (cursor) variables.after = cursor;

    const cursorParam: string = cursor ? ", $after: String" : "";
    const cursorArg: string = cursor ? ", after: $after" : "";

    const data = await graphqlQuery<{
      collections: {
        edges: Array<{
          node: { id: string; title: string; handle: string };
          cursor: string;
        }>;
        pageInfo: { hasNextPage: boolean };
      };
    }>(
      `query Collections($first: Int!${cursorParam}) {
        collections(first: $first, sortKey: TITLE${cursorArg}) {
          edges {
            node { id title handle }
            cursor
          }
          pageInfo { hasNextPage }
        }
      }`,
      variables
    );

    for (const edge of data.collections.edges) {
      all.push(edge.node);
      cursor = edge.cursor;
    }
    hasNext = data.collections.pageInfo.hasNextPage;
  }

  return all.map((node) => ({
    id: node.id,
    title: node.title,
    handle: node.handle,
  }));
}

export interface ShopifyFile {
  id: string;
  alt: string;
  url: string;
  filename: string;
  createdAt: string;
}

export async function getShopifyFiles(query?: string, limit = 24): Promise<ShopifyFile[]> {
  const searchQuery = query ? `${query}` : "";

  const data = await graphqlQuery<{
    files: {
      edges: Array<{
        node: {
          id: string;
          alt: string | null;
          createdAt: string;
          fileStatus: string;
          image?: { url: string; originalSrc?: string };
          preview?: { image?: { url: string } };
        };
      }>;
    };
  }>(
    `query Files($first: Int!${searchQuery ? ", $query: String" : ""}) {
      files(first: $first, sortKey: CREATED_AT, reverse: true${searchQuery ? ", query: $query" : ""}) {
        edges {
          node {
            id
            alt
            createdAt
            fileStatus
            preview {
              image { url }
            }
            ... on MediaImage {
              image { url }
            }
          }
        }
      }
    }`,
    searchQuery ? { first: limit, query: searchQuery } : { first: limit }
  );

  return data.files.edges
    .filter(({ node }) => {
      if (node.fileStatus !== "READY") return false;
      const url = node.image?.url || node.preview?.image?.url;
      return !!url;
    })
    .map(({ node }) => {
      const url = node.image?.url || node.preview?.image?.url || "";
      // Extract filename from URL
      const urlPath = url.split("?")[0];
      const filename = urlPath.split("/").pop() || "file";
      return {
        id: node.id,
        alt: node.alt || "",
        url,
        filename,
        createdAt: node.createdAt,
      };
    });
}
