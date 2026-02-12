import { graphqlQuery } from "@/lib/shopify";
import type { EmailBlock } from "@/lib/email-blocks";

export interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  blocks: EmailBlock[];
  bgColor: string;
  btnColor: string;
  containerColor: string;
  textColor: string;
  createdAt: string;
}

const NAMESPACE = "email_campaigns";
const KEY = "templates";

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

export async function getCustomTemplates(): Promise<CustomTemplate[]> {
  try {
    const data = await graphqlQuery<AppInstallationResponse>(
      `query GetCustomTemplates {
        currentAppInstallation {
          id
          metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
            value
          }
        }
      }`
    );

    if (data.currentAppInstallation.metafield?.value) {
      return JSON.parse(data.currentAppInstallation.metafield.value) as CustomTemplate[];
    }
  } catch (error) {
    console.error("Failed to read custom templates:", error);
  }

  return [];
}

export async function saveCustomTemplates(templates: CustomTemplate[]): Promise<void> {
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
    `mutation SaveCustomTemplates($metafields: [MetafieldsSetInput!]!) {
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
          value: JSON.stringify(templates),
        },
      ],
    }
  );

  const errors = data.metafieldsSet.userErrors;
  if (errors.length > 0) {
    throw new Error(`Metafield save error: ${errors[0].message}`);
  }
}

export async function addCustomTemplate(template: CustomTemplate): Promise<void> {
  const templates = await getCustomTemplates();
  templates.push(template);
  await saveCustomTemplates(templates);
}

export async function updateCustomTemplate(id: string, patch: Partial<CustomTemplate>): Promise<void> {
  const templates = await getCustomTemplates();
  const index = templates.findIndex((t) => t.id === id);
  if (index === -1) {
    throw new Error(`Template ${id} not found`);
  }
  templates[index] = { ...templates[index], ...patch };
  await saveCustomTemplates(templates);
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const templates = await getCustomTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  if (filtered.length === templates.length) {
    throw new Error(`Template ${id} not found`);
  }
  await saveCustomTemplates(filtered);
}
