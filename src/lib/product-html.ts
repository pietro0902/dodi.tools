import type { ShopifyProduct } from "@/types/shopify";

export type ProductLayout = "grid" | "scroll";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrice(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (currency === "EUR") return `€${num.toFixed(2)}`;
  return `${num.toFixed(2)} ${currency}`;
}

function buildProductCard(product: ShopifyProduct, btnColor?: string): string {
  const imgBlock = product.imageUrl
    ? `<div style="height:160px;text-align:center;line-height:160px;overflow:hidden"><img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" style="max-width:100%;max-height:160px;width:auto;height:auto;border-radius:6px;vertical-align:middle" /></div>`
    : `<div style="height:160px"></div>`;

  const priceDisplay = formatPrice(product.price, product.currency);
  const compareBlock =
    product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)
      ? `<br/><span style="text-decoration:line-through;color:#9ca3af;font-size:13px">${formatPrice(product.compareAtPrice, product.currency)}</span>`
      : "";

  return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#ffffff;text-align:center">
  ${imgBlock}
  <p style="font-size:14px;font-weight:600;color:#111827;margin:8px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(product.title)}</p>
  <p style="font-size:15px;color:#111827;font-weight:700;margin:0 0 12px">${priceDisplay}${compareBlock}</p>
  <a href="${esc(product.url)}" style="display:inline-block;background-color:${btnColor || "#111827"};color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:8px 20px;border-radius:6px">Acquista</a>
</div>`;
}

export function buildProductBlockHtml(product: ShopifyProduct, btnColor?: string): string {
  return buildProductGridHtml([product], "grid", btnColor);
}

export function buildProductGridHtml(products: ShopifyProduct[], layout: ProductLayout = "grid", btnColor?: string): string {
  if (products.length === 0) return "";

  if (layout === "scroll") {
    return buildScrollLayout(products, btnColor);
  }
  return buildGridLayout(products, btnColor);
}

/**
 * Grid layout: inline-block cards at 260px width.
 * On desktop (600px email) they fit 2 per row.
 * On mobile (<400px) they stack vertically.
 */
function buildGridLayout(products: ShopifyProduct[], btnColor?: string): string {
  const cards = products.map((p) => {
    return `<div style="display:inline-block;vertical-align:top;width:260px;max-width:100%;margin:8px;box-sizing:border-box">
${buildProductCard(p, btnColor)}
</div>`;
  });

  return `\n<!-- Prodotti -->\n<div style="text-align:center;margin:16px 0;font-size:0">\n${cards.join("\n")}\n</div>\n`;
}

/**
 * Scroll layout: horizontal scrollable row.
 * Works in Gmail web, Apple Mail, iOS Mail. Degrades to wrapped layout in others.
 */
function buildScrollLayout(products: ShopifyProduct[], btnColor?: string): string {
  const cards = products.map((p) => {
    return `<div style="display:inline-block;vertical-align:top;width:200px;min-width:200px;margin:0 8px;box-sizing:border-box">
${buildProductCard(p, btnColor)}
</div>`;
  });

  return `\n<!-- Prodotti (scorrimento) -->\n<style>.ps::-webkit-scrollbar{height:4px}.ps::-webkit-scrollbar-track{background:transparent}.ps::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}.ps::-webkit-scrollbar-thumb:hover{background:#9ca3af}</style>\n<div class="ps" style="overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:#d1d5db transparent;white-space:nowrap;margin:16px 0;padding:4px 0 8px;font-size:0">\n${cards.join("\n")}\n</div>\n`;
}
