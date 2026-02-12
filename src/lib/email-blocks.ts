import type { ShopifyProduct } from "@/types/shopify";
import { buildProductGridHtml, type ProductLayout } from "@/lib/product-html";

// ── Block types ──

export interface TextBlock {
  id: string;
  type: "text";
  html: string;
}

export interface ImageBlock {
  id: string;
  type: "image";
  src: string;
  alt: string;
  width: "50%" | "75%" | "100%";
}

export interface ButtonBlock {
  id: string;
  type: "button";
  text: string;
  url: string;
  bgColor: string;
  textColor: string;
}

export interface ProductsBlock {
  id: string;
  type: "products";
  products: ShopifyProduct[];
  layout: ProductLayout;
}

export interface LogoBlock {
  id: string;
  type: "logo";
  src: string;
  alt: string;
  width: number;
}

export interface DividerBlock {
  id: string;
  type: "divider";
}

export type EmailBlock =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | ProductsBlock
  | LogoBlock
  | DividerBlock;

export type EmailBlockType = EmailBlock["type"];

// ── Helpers ──

export function generateBlockId(): string {
  return crypto.randomUUID();
}

export function createDefaultBlock(type: EmailBlockType): EmailBlock {
  const id = generateBlockId();
  switch (type) {
    case "text":
      return { id, type: "text", html: "" };
    case "image":
      return { id, type: "image", src: "", alt: "", width: "100%" };
    case "button":
      return { id, type: "button", text: "", url: "", bgColor: "#111827", textColor: "#ffffff" };
    case "products":
      return { id, type: "products", products: [], layout: "grid" };
    case "logo":
      return { id, type: "logo", src: "", alt: "", width: 120 };
    case "divider":
      return { id, type: "divider" };
  }
}

// ── Assemble blocks → single HTML string ──

export function blocksToHtml(blocks: EmailBlock[], btnColor: string): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "text":
          return block.html;

        case "image": {
          if (!block.src) return "";
          const w = block.width || "100%";
          return `<img src="${block.src}" alt="${block.alt || ""}" style="display:block;width:${w};max-width:100%;height:auto;margin:16px auto;border-radius:8px" />`;
        }

        case "button": {
          if (!block.text || !block.url) return "";
          const bg = block.bgColor || btnColor;
          const tc = block.textColor || "#ffffff";
          return `<div style="text-align:center;margin:16px 0"><a href="${block.url}" style="display:inline-block;background-color:${bg};color:${tc};font-size:16px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px">${block.text}</a></div>`;
        }

        case "products":
          if (block.products.length === 0) return "";
          return buildProductGridHtml(block.products, block.layout, btnColor);

        case "logo": {
          if (!block.src) return "";
          return `<div style="text-align:center;padding:24px 0"><img src="${block.src}" alt="${block.alt || ""}" width="${block.width}" style="display:block;margin:0 auto;height:auto" /></div>`;
        }

        case "divider":
          return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />`;
      }
    })
    .filter(Boolean)
    .join("\n");
}

// ── Convert legacy template (bodyHtml + CTA) → blocks ──

export function templateToBlocks(template: {
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
}): EmailBlock[] {
  const blocks: EmailBlock[] = [];

  if (template.bodyHtml) {
    blocks.push({
      id: generateBlockId(),
      type: "text",
      html: template.bodyHtml,
    });
  }

  if (template.ctaText && template.ctaUrl) {
    blocks.push({
      id: generateBlockId(),
      type: "button",
      text: template.ctaText,
      url: template.ctaUrl,
      bgColor: "#111827",
      textColor: "#ffffff",
    });
  }

  return blocks;
}
