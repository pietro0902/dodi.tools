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

function buildProductCard(product: ShopifyProduct): string {
  const imgBlock = product.imageUrl
    ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" style="width:100%;max-width:180px;height:auto;border-radius:6px;display:block;margin:0 auto" />`
    : "";

  const priceDisplay = formatPrice(product.price, product.currency);
  const compareBlock =
    product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)
      ? `<br/><span style="text-decoration:line-through;color:#9ca3af;font-size:13px">${formatPrice(product.compareAtPrice, product.currency)}</span>`
      : "";

  return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#ffffff;text-align:center">
  ${imgBlock}
  <p style="font-size:14px;font-weight:600;color:#111827;margin:8px 0 4px">${esc(product.title)}</p>
  <p style="font-size:15px;color:#111827;font-weight:700;margin:0 0 12px">${priceDisplay}${compareBlock}</p>
  <a href="${esc(product.url)}" style="display:inline-block;background-color:#111827;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:8px 20px;border-radius:6px">Acquista</a>
</div>`;
}

export function buildProductBlockHtml(product: ShopifyProduct): string {
  return buildProductGridHtml([product], "grid");
}

export function buildProductGridHtml(products: ShopifyProduct[], layout: ProductLayout = "grid"): string {
  if (products.length === 0) return "";

  if (layout === "scroll") {
    return buildScrollLayout(products);
  }
  return buildGridLayout(products);
}

/**
 * Grid layout: inline-block cards at 260px width.
 * On desktop (600px email) they fit 2 per row.
 * On mobile (<400px) they stack vertically.
 */
function buildGridLayout(products: ShopifyProduct[]): string {
  const cards = products.map((p) => {
    return `<div style="display:inline-block;vertical-align:top;width:260px;max-width:100%;margin:8px;box-sizing:border-box">
${buildProductCard(p)}
</div>`;
  });

  return `\n<!-- Prodotti -->\n<div style="text-align:center;margin:16px 0;font-size:0">\n${cards.join("\n")}\n</div>\n`;
}

/**
 * Scroll layout: horizontal scrollable row.
 * Works in Gmail web, Apple Mail, iOS Mail. Degrades to wrapped layout in others.
 */
function buildScrollLayout(products: ShopifyProduct[]): string {
  const cards = products.map((p) => {
    return `<div style="display:inline-block;vertical-align:top;width:200px;min-width:200px;margin:0 8px;box-sizing:border-box">
${buildProductCard(p)}
</div>`;
  });

  return `\n<!-- Prodotti (scorrimento) -->\n<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap;margin:16px 0;padding:4px 0;font-size:0">\n${cards.join("\n")}\n</div>\n`;
}
