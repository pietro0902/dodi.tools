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

/**
 * Horizontal card: image on the left (180x180), details on the right.
 * Works at full email width (536px content area).
 */
function buildHorizontalCard(product: ShopifyProduct, btnColor?: string): string {
  const imgBlock = product.imageUrl
    ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" width="160" height="160"
          style="display:block;width:160px;height:160px;object-fit:cover;border-radius:8px;filter:none" />`
    : `<div style="width:160px;height:160px;background:#f3f4f6;border-radius:8px;flex-shrink:0"></div>`;

  const compareBlock =
    product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)
      ? ` <span style="text-decoration:line-through;color:#9ca3af;font-size:13px;margin-left:6px">${formatPrice(product.compareAtPrice, product.currency)}</span>`
      : "";

  return `<div style="border:1px solid #e5e7eb;border-radius:10px;background:#ffffff;margin:10px 0;display:flex;align-items:center;gap:16px;padding:16px;box-sizing:border-box;overflow:hidden">
  <div style="flex-shrink:0">${imgBlock}</div>
  <div style="flex:1;min-width:0;text-align:left">
    <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 6px;line-height:1.3">${esc(product.title)}</p>
    <p style="font-size:16px;color:#111827;font-weight:700;margin:0 0 14px">
      ${formatPrice(product.price, product.currency)}${compareBlock}
    </p>
    <a href="${esc(product.url)}" style="display:inline-block;background-color:${btnColor || "#111827"};color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:9px 22px;border-radius:6px">Acquista</a>
  </div>
</div>`;
}

/**
 * Square card for scroll layout: image on top, details below.
 * Fixed width 200px, designed for horizontal scrolling.
 */
function buildSquareCard(product: ShopifyProduct, btnColor?: string): string {
  const imgBlock = product.imageUrl
    ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" width="200"
          style="display:block;width:100%;height:160px;object-fit:cover;border-radius:8px 8px 0 0;filter:none" />`
    : `<div style="height:160px;background:#f3f4f6;border-radius:8px 8px 0 0"></div>`;

  const compareBlock =
    product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)
      ? `<br/><span style="text-decoration:line-through;color:#9ca3af;font-size:12px">${formatPrice(product.compareAtPrice, product.currency)}</span>`
      : "";

  return `<div style="border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;overflow:hidden;width:200px">
  ${imgBlock}
  <div style="padding:10px 12px 14px;text-align:center">
    <p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(product.title)}</p>
    <p style="font-size:14px;color:#111827;font-weight:700;margin:0 0 10px">${formatPrice(product.price, product.currency)}${compareBlock}</p>
    <a href="${esc(product.url)}" style="display:inline-block;background-color:${btnColor || "#111827"};color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;padding:7px 16px;border-radius:6px">Acquista</a>
  </div>
</div>`;
}

export function buildProductBlockHtml(product: ShopifyProduct, btnColor?: string): string {
  return buildProductGridHtml([product], "grid", btnColor);
}

export function buildProductGridHtml(
  products: ShopifyProduct[],
  layout: ProductLayout = "grid",
  btnColor?: string
): string {
  if (products.length === 0) return "";
  if (layout === "scroll") return buildScrollLayout(products, btnColor);
  return buildGridLayout(products, btnColor);
}

/**
 * Grid layout: stacked horizontal cards, one per row, full width.
 * Clean and readable at any screen size.
 */
function buildGridLayout(products: ShopifyProduct[], btnColor?: string): string {
  const cards = products.map((p) => buildHorizontalCard(p, btnColor)).join("\n");
  return `\n<!-- Prodotti -->\n<div style="margin:16px 0">\n${cards}\n</div>\n`;
}

/**
 * Scroll layout: horizontal scrollable row of square cards.
 */
function buildScrollLayout(products: ShopifyProduct[], btnColor?: string): string {
  const cells = products.map((p) => {
    return `<td style="padding:0 6px;vertical-align:top">
  ${buildSquareCard(p, btnColor)}
</td>`;
  }).join("\n");

  return `\n<!-- Prodotti (scorrimento) -->\n<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:16px 0;padding-bottom:8px">\n  <table cellpadding="0" cellspacing="0" border="0" style="white-space:nowrap"><tr>\n${cells}\n  </tr></table>\n</div>\n`;
}
