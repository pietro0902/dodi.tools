import type { EmailMarketingConsent } from "@/types/shopify";

export function hasMarketingConsent(
  consent: EmailMarketingConsent | null | undefined
): boolean {
  return consent?.state === "subscribed";
}
