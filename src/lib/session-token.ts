import { createHmac } from "crypto";

interface SessionTokenPayload {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Verify and decode a Shopify session token (JWT signed with HMAC-SHA256 using client secret).
 */
export function verifySessionToken(token: string): SessionTokenPayload {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) {
    throw new Error("SHOPIFY_CLIENT_SECRET is not set");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid session token format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify signature
  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  if (expectedSig !== signatureB64) {
    throw new Error("Invalid session token signature");
  }

  const payload: SessionTokenPayload = JSON.parse(
    base64UrlDecode(payloadB64)
  );

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error("Session token expired");
  }

  // Check not-before
  if (payload.nbf > now + 60) {
    throw new Error("Session token not yet valid");
  }

  // Check audience matches our client ID
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  if (clientId && payload.aud !== clientId) {
    throw new Error("Session token audience mismatch");
  }

  return payload;
}

/**
 * Extract and verify the session token from an Authorization header.
 * Returns the decoded payload or null if invalid.
 */
export function getSessionFromRequest(
  request: Request
): SessionTokenPayload | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    return verifySessionToken(authHeader.slice(7));
  } catch {
    return null;
  }
}
