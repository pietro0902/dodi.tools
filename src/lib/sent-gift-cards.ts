import { graphqlQuery } from "@/lib/shopify";

const NAMESPACE = "email_gift_cards";
const KEY = "sent_order_ids";

interface AppInstallationResponse {
  currentAppInstallation: {
    id: string;
    metafield: { value: string } | null;
  };
}

interface MetafieldsSetResponse {
  metafieldsSet: {
    metafields: Array<{ id: string }>;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

export async function getSentGiftCardOrderIds(): Promise<number[]> {
  try {
    const data = await graphqlQuery<AppInstallationResponse>(
      `query GetSentGiftCards {
        currentAppInstallation {
          id
          metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
            value
          }
        }
      }`
    );
    if (data.currentAppInstallation.metafield?.value) {
      return JSON.parse(data.currentAppInstallation.metafield.value) as number[];
    }
  } catch {}
  return [];
}

export async function markGiftCardOrderSent(orderId: number): Promise<void> {
  const installData = await graphqlQuery<AppInstallationResponse>(
    `query GetAppInstallation {
      currentAppInstallation {
        id
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
          value
        }
      }
    }`
  );

  const ownerId = installData.currentAppInstallation.id;
  let ids: number[] = [];
  if (installData.currentAppInstallation.metafield?.value) {
    ids = JSON.parse(installData.currentAppInstallation.metafield.value);
  }

  if (!ids.includes(orderId)) {
    ids.push(orderId);
  }

  await graphqlQuery<MetafieldsSetResponse>(
    `mutation SaveSentGiftCards($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      metafields: [
        {
          ownerId,
          namespace: NAMESPACE,
          key: KEY,
          type: "json",
          value: JSON.stringify(ids),
        },
      ],
    }
  );
}
