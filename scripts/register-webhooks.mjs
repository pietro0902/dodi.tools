// Script to register Shopify webhooks
// Usage: node scripts/register-webhooks.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env manually (no external deps needed)
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "..", ".env");
try {
  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  // .env not found, rely on existing env vars
}

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
// APP_URL can come from env or be passed as first CLI argument
const appUrl = process.env.APP_URL || process.argv[2];

if (!domain || !clientId || !clientSecret || !appUrl) {
  console.error("Missing required env vars: SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET");
  console.error("Pass APP_URL as argument: node scripts/register-webhooks.mjs https://your-app.vercel.app");
  process.exit(1);
}

const BASE_URL = `https://${domain}/admin/api/2024-10`;

async function getAccessToken() {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function listWebhooks(token) {
  const res = await fetch(`${BASE_URL}/webhooks.json`, {
    headers: { "X-Shopify-Access-Token": token },
  });
  if (!res.ok) throw new Error(`List webhooks error: ${res.status}`);
  const data = await res.json();
  return data.webhooks;
}

async function createWebhook(token, topic, address) {
  const res = await fetch(`${BASE_URL}/webhooks.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      webhook: { topic, address, format: "json" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Create webhook error: ${res.status} ${JSON.stringify(data)}`);
  return data.webhook;
}

async function main() {
  console.log(`\nConnecting to: ${domain}`);
  console.log(`App URL: ${appUrl}\n`);

  const token = await getAccessToken();
  console.log("✓ Access token obtained\n");

  const existing = await listWebhooks(token);
  console.log(`Found ${existing.length} existing webhook(s):`);
  for (const wh of existing) {
    console.log(`  [${wh.id}] ${wh.topic} → ${wh.address}`);
  }

  const WEBHOOKS_TO_REGISTER = [
    {
      topic: "orders/create",
      path: "/api/webhooks/orders-gift-card",
    },
  ];

  console.log("");

  for (const { topic, path } of WEBHOOKS_TO_REGISTER) {
    const address = `${appUrl}${path}`;
    const alreadyExists = existing.find(
      (wh) => wh.topic === topic && wh.address === address
    );

    if (alreadyExists) {
      console.log(`✓ Already registered: ${topic}`);
    } else {
      const wh = await createWebhook(token, topic, address);
      console.log(`✓ Registered: ${topic} → ${address} (id: ${wh.id})`);
    }
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message);
  process.exit(1);
});
