import { graphqlQuery } from "@/lib/shopify";

export interface ActivityEntry {
  id: string;
  type:
    | "campaign_sent"
    | "campaign_scheduled"
    | "campaign_cancelled"
    | "scheduled_campaign_sent"
    | "abandoned_cart_batch"
    | "welcome_email"
    | "post_purchase_email";
  timestamp: string;
  summary: string;
  details?: {
    subject?: string;
    sent?: number;
    failed?: number;
    recipientCount?: number;
    customerEmail?: string;
    scheduledAt?: string;
  };
}

const NAMESPACE = "email_activities";
const KEY = "log";
const MAX_ENTRIES = 50;

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

export async function getActivityLog(): Promise<ActivityEntry[]> {
  try {
    const data = await graphqlQuery<AppInstallationResponse>(
      `query GetActivityLog {
        currentAppInstallation {
          id
          metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
            value
          }
        }
      }`
    );

    if (data.currentAppInstallation.metafield?.value) {
      return JSON.parse(data.currentAppInstallation.metafield.value) as ActivityEntry[];
    }
  } catch (error) {
    console.error("Failed to read activity log:", error);
  }

  return [];
}

export async function logActivity(
  entry: Omit<ActivityEntry, "id" | "timestamp">
): Promise<void> {
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

  let entries: ActivityEntry[] = [];
  if (installData.currentAppInstallation.metafield?.value) {
    entries = JSON.parse(installData.currentAppInstallation.metafield.value);
  }

  const newEntry: ActivityEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // Prepend new entry and keep max 50
  entries.unshift(newEntry);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(0, MAX_ENTRIES);
  }

  const data = await graphqlQuery<MetafieldsSetResponse>(
    `mutation SaveActivityLog($metafields: [MetafieldsSetInput!]!) {
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
          value: JSON.stringify(entries),
        },
      ],
    }
  );

  const errors = data.metafieldsSet.userErrors;
  if (errors.length > 0) {
    throw new Error(`Activity log save error: ${errors[0].message}`);
  }
}
