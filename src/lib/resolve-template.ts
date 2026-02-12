import { getCustomTemplates } from "@/lib/custom-templates";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaign-templates";
import { blocksToHtml, templateToBlocks } from "@/lib/email-blocks";

export interface ResolvedTemplate {
  subject: string;
  bodyHtml: string;
  preheader: string;
  bgColor?: string;
  btnColor?: string;
  containerColor?: string;
  textColor?: string;
}

/**
 * Resolve a templateId to its rendered HTML + colors.
 * Checks custom templates first, then default campaign templates.
 * Returns null if template not found.
 */
export async function resolveTemplate(templateId: string): Promise<ResolvedTemplate | null> {
  // Check custom templates
  const customs = await getCustomTemplates();
  const custom = customs.find((t) => t.id === templateId);
  if (custom) {
    return {
      subject: custom.subject,
      bodyHtml: blocksToHtml(custom.blocks || [], custom.btnColor || "#111827"),
      preheader: custom.preheader || "",
      bgColor: custom.bgColor,
      btnColor: custom.btnColor,
      containerColor: custom.containerColor,
      textColor: custom.textColor,
    };
  }

  // Check default campaign templates
  const defaultTpl = CAMPAIGN_TEMPLATES.find((t) => t.id === templateId);
  if (defaultTpl) {
    const blocks = defaultTpl.blocks
      ? defaultTpl.blocks.map((b) => ({ ...b }))
      : templateToBlocks(defaultTpl);
    const btnColor = defaultTpl.btnColor || "#111827";
    return {
      subject: defaultTpl.subject,
      bodyHtml: blocksToHtml(blocks, btnColor),
      preheader: "",
      bgColor: defaultTpl.bgColor,
      btnColor: defaultTpl.btnColor,
      containerColor: defaultTpl.containerColor,
      textColor: defaultTpl.textColor,
    };
  }

  return null;
}
