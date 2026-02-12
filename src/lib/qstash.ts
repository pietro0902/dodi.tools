import { Client, Receiver } from "@upstash/qstash";

let clientInstance: Client | null = null;

export function getQStashClient(): Client {
  if (!clientInstance) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) {
      throw new Error("QSTASH_TOKEN environment variable is not set");
    }
    clientInstance = new Client({ token });
  }
  return clientInstance;
}

/**
 * Verifies a QStash request signature and returns the parsed body.
 * Returns null if verification fails.
 */
export async function verifyQStashRequest<T = unknown>(
  request: Request
): Promise<T | null> {
  const signature = request.headers.get("upstash-signature");
  if (!signature) {
    return null;
  }

  const body = await request.text();

  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  });

  try {
    const isValid = await receiver.verify({
      signature,
      body,
      url: getAppUrl(new URL(request.url).pathname),
    });

    if (!isValid) {
      return null;
    }

    return (body ? JSON.parse(body) : {}) as T;
  } catch {
    console.error("QStash signature verification failed");
    return null;
  }
}

/**
 * Returns absolute URL for a given path, using APP_URL or VERCEL_URL.
 */
export function getAppUrl(path: string): string {
  const base =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (!base) {
    throw new Error("APP_URL or VERCEL_URL environment variable must be set");
  }

  return `${base}${path}`;
}
