import type {
  AbandonedCheckoutsResponse,
  CustomersResponse,
  ShopifyCustomer,
  AbandonedCheckout,
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
