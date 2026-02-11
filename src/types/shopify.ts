// Webhook Payloads

export interface EmailMarketingConsent {
  state: "subscribed" | "not_subscribed" | "unsubscribed" | "pending" | "redacted";
  opt_in_level: "single_opt_in" | "confirmed_opt_in" | "unknown";
  consent_updated_at: string | null;
}

export interface CustomerWebhookPayload {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  email_marketing_consent: EmailMarketingConsent | null;
  created_at: string;
  updated_at: string;
  tags: string;
}

export interface OrderLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string;
  variant_title: string | null;
}

export interface OrderAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  zip: string;
}

export interface OrderWebhookPayload {
  id: number;
  order_number: number;
  email: string;
  created_at: string;
  total_price: string;
  currency: string;
  line_items: OrderLineItem[];
  shipping_address: OrderAddress | null;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    email_marketing_consent: EmailMarketingConsent | null;
  };
}

// Admin API Responses

export interface AbandonedCheckout {
  id: number;
  token: string;
  email: string;
  created_at: string;
  updated_at: string;
  abandoned_checkout_url: string;
  total_price: string;
  currency: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    email_marketing_consent: EmailMarketingConsent | null;
  };
  line_items: {
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
  }[];
}

export interface AbandonedCheckoutsResponse {
  checkouts: AbandonedCheckout[];
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  email_marketing_consent: EmailMarketingConsent | null;
  tags: string;
}

export interface CustomersResponse {
  customers: ShopifyCustomer[];
}

// Products & Collections (GraphQL)

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  url: string;
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
}

export type ProductSortKey =
  | "BEST_SELLING"
  | "PRICE"
  | "PRICE_DESC"
  | "TITLE"
  | "CREATED_AT"
  | "RELEVANCE";
