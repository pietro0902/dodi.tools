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
    ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" width="100%" style="display:block;width:100%;height:180px;object-fit:cover;border-radius:6px 6px 0 0" />`
    : `<div style="height:180px;background:#f3f4f6;border-radius:6px 6px 0 0"></div>`;

  const compareBlock =
    product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)
      ? `<br/><span style="text-decoration:line-through;color:#9ca3af;font-size:13px">${formatPrice(product.compareAtPrice, product.currency)}</span>`
      : "";

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;overflow:hidden">
  <tr><td style="padding:0">${imgBlock}</td></tr>
  <tr><td style="padding:10px 12px 14px;text-align:center">
    <p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(product.title)}</p>
    <p style="font-size:15px;color:#111827;font-weight:700;margin:0 0 10px">${formatPrice(product.price, product.currency)}${compareBlock}</p>
    <a href="${esc(product.url)}" style="display:inline-block;background-color:${btnColor || "#111827"};color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:8px 20px;border-radius:6px">Acquista</a>
  </td></tr>
</table>`;
}

export function buildProductBlockHtml(product: ShopifyProduct, btnColor?: string): string {
  return buildProductGridHtml([product], "grid", btnColor);
}

/**
 * Grid layout: table-based, 2 columns on desktop, 1 column on mobile.
 * Uses media queries for stacking (supported by Gmail, Apple Mail, iOS, Android).
 */
export function buildProductGridHtml(products: ShopifyProduct[], layout: ProductLayout = "grid", btnColor?: string): string {
  if (products.length === 0) return "";

  if (layout === "scroll") {
    return buildScrollLayout(products, btnColor);
  }
  return buildGridLayout(products, btnColor);
}

function buildGridLayout(products: ShopifyProduct[], btnColor?: string): string {
  // Pair products into rows of 2
  const rows: ShopifyProduct[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(products.slice(i, i + 2));
  }

  const rowsHtml = rows.map((row) => {
    if (row.length === 1) {
      // Single product: full width
      return `<tr>
  <td class="product-col" style="padding:8px;width:100%;display:block" width="100%">
    ${buildProductCard(row[0], btnColor)}
  </td>
</tr>`;
    }
    // Two products: 50/50
    return `<tr>
  <td class="product-col" style="padding:8px;width:50%;vertical-align:top" width="50%">
    ${buildProductCard(row[0], btnColor)}
  </td>
  <td class="product-col" style="padding:8px;width:50%;vertical-align:top" width="50%">
    ${buildProductCard(row[1], btnColor)}
  </td>
</tr>`;
  }).join("\n");

  return `
<!-- Prodotti -->
<style>
  @media only screen and (max-width: 480px) {
    .product-col { display:block !important; width:100% !important; padding:8px 4px !important; }
  }
</style>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
${rowsHtml}
</table>`;
}

/**
 * Scroll layout: horizontal scrollable row.
 */
function buildScrollLayout(products: ShopifyProduct[], btnColor?: string): string {
  const cards = products.map((p) => {
    return `<td style="padding:0 8px;vertical-align:top;width:200px;min-width:200px">
${buildProductCard(p, btnColor)}
</td>`;
  });

  return `
<!-- Prodotti (scorrimento) -->
<style>.ps::-webkit-scrollbar{height:4px}.ps::-webkit-scrollbar-track{background:transparent}.ps::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}</style>
<div class="ps" style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:16px 0">
  <table cellpadding="0" cellspacing="0" border="0" style="white-space:nowrap">
    <tr>${cards.join("")}</tr>
  </table>
</div>`;
}
