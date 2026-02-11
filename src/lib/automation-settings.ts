import { graphqlQuery } from "@/lib/shopify";

export interface AutomationSettings {
  welcome: {
    enabled: boolean;
    subject: string;
    bodyHtml: string;
  };
  abandonedCart: {
    enabled: boolean;
    subject: string;
    bodyHtml: string;
    delayHours: number;
    maxAgeHours: number;
  };
}

const STORE_NAME = process.env.STORE_NAME || "Dodi's";

export function getDefaultSettings(): AutomationSettings {
  return {
    welcome: {
      enabled: true,
      subject: `Benvenuto in ${STORE_NAME}!`,
      bodyHtml: `<p>Ciao {{name}},</p>\n<p>Grazie per esserti iscritto a ${STORE_NAME}! Siamo felici di averti con noi.</p>\n<p>Scopri le nostre ultime novit\u00e0 e approfitta delle offerte riservate ai nuovi iscritti.</p>`,
    },
    abandonedCart: {
      enabled: true,
      subject: `Hai dimenticato qualcosa in ${STORE_NAME}!`,
      bodyHtml: `<p>Ciao {{name}},</p>\n<p>Hai lasciato degli articoli nel carrello. Non lasciarli scappare!</p>`,
      delayHours: 4,
      maxAgeHours: 48,
    },
  };
}

const NAMESPACE = "email_automation";
const KEY = "settings";

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

export async function getAutomationSettings(): Promise<AutomationSettings> {
  try {
    const data = await graphqlQuery<AppInstallationResponse>(
      `query GetAutomationSettings {
        currentAppInstallation {
          id
          metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
            value
          }
        }
      }`
    );

    if (data.currentAppInstallation.metafield?.value) {
      const saved = JSON.parse(data.currentAppInstallation.metafield.value);
      // Merge with defaults to fill in any missing keys from future updates
      const defaults = getDefaultSettings();
      return {
        welcome: { ...defaults.welcome, ...saved.welcome },
        abandonedCart: { ...defaults.abandonedCart, ...saved.abandonedCart },
      };
    }
  } catch (error) {
    console.error("Failed to read automation settings:", error);
  }

  return getDefaultSettings();
}

export async function saveAutomationSettings(settings: AutomationSettings): Promise<void> {
  // First get the app installation ID
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

  const data = await graphqlQuery<MetafieldsSetResponse>(
    `mutation SaveAutomationSettings($metafields: [MetafieldsSetInput!]!) {
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
          value: JSON.stringify(settings),
        },
      ],
    }
  );

  const errors = data.metafieldsSet.userErrors;
  if (errors.length > 0) {
    throw new Error(`Metafield save error: ${errors[0].message}`);
  }
}
