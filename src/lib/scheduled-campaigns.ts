import { graphqlQuery } from "@/lib/shopify";

export interface ScheduledCampaign {
  id: string;
  subject: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  logoWidth: number;
  recipientMode: "all" | "manual";
  customerIds?: number[];
  scheduledAt: string;
  status: "scheduled" | "sent" | "cancelled";
  createdAt: string;
  recipientCount: number;
  qstashMessageId?: string;
  bgColor?: string;
  btnColor?: string;
  containerColor?: string;
}

const NAMESPACE = "email_campaigns";
const KEY = "scheduled";

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

export async function getScheduledCampaigns(): Promise<ScheduledCampaign[]> {
  try {
    const data = await graphqlQuery<AppInstallationResponse>(
      `query GetScheduledCampaigns {
        currentAppInstallation {
          id
          metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
            value
          }
        }
      }`
    );

    if (data.currentAppInstallation.metafield?.value) {
      return JSON.parse(data.currentAppInstallation.metafield.value) as ScheduledCampaign[];
    }
  } catch (error) {
    console.error("Failed to read scheduled campaigns:", error);
  }

  return [];
}

export async function saveScheduledCampaigns(campaigns: ScheduledCampaign[]): Promise<void> {
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

  // Auto-cleanup: remove sent/cancelled campaigns older than 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const cleaned = campaigns.filter((c) => {
    if (c.status === "scheduled") return true;
    return new Date(c.createdAt).getTime() > sevenDaysAgo;
  });

  const data = await graphqlQuery<MetafieldsSetResponse>(
    `mutation SaveScheduledCampaigns($metafields: [MetafieldsSetInput!]!) {
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
          value: JSON.stringify(cleaned),
        },
      ],
    }
  );

  const errors = data.metafieldsSet.userErrors;
  if (errors.length > 0) {
    throw new Error(`Metafield save error: ${errors[0].message}`);
  }
}

export async function addScheduledCampaign(campaign: ScheduledCampaign): Promise<void> {
  const campaigns = await getScheduledCampaigns();
  campaigns.push(campaign);
  await saveScheduledCampaigns(campaigns);
}

export async function updateCampaignStatus(
  id: string,
  status: ScheduledCampaign["status"]
): Promise<void> {
  const campaigns = await getScheduledCampaigns();
  const campaign = campaigns.find((c) => c.id === id);
  if (!campaign) {
    throw new Error(`Campaign ${id} not found`);
  }
  campaign.status = status;
  await saveScheduledCampaigns(campaigns);
}
