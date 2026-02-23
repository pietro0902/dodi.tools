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
 * Card prodotto: immagine sopra, testo sotto.
 * Full-width, si adatta a qualsiasi larghezza.
 */
function buildProductCard(product: ShopifyProduct, btnColor?: string): string {
  const imgBlock = product.imageUrl
    ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" width="560"
          style="display:block;width:100%;max-width:100%;height:auto;border-radius:8px 8px 0 0;filter:none" />`
    : `<div style="height:200px;background:#f3f4f6;border-radius:8px 8px 0 0"></div>`;

  const compareBlock =
    product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)
      ? ` <span style="text-decoration:line-through;color:#9ca3af;font-size:14px;margin-left:8px">${formatPrice(product.compareAtPrice, product.currency)}</span>`
      : "";

  return `<div style="border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;overflow:hidden;margin:0 0 16px 0">
  ${imgBlock}
  <div style="padding:16px 20px 20px;text-align:center">
    <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 8px;line-height:1.4">${esc(product.title)}</p>
    <p style="font-size:18px;color:#111827;font-weight:700;margin:0 0 16px">
      ${formatPrice(product.price, product.currency)}${compareBlock}
    </p>
    <a href="${esc(product.url)}" style="display:inline-block;background-color:${btnColor || "#111827"};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:11px 28px;border-radius:6px">Acquista</a>
  </div>
</div>`;
}

/**
 * Card compatta per layout scroll orizzontale.
 */
function buildScrollCard(product: ShopifyProduct, btnColor?: string): string {
  const imgBlock = product.imageUrl
    ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" width="200"
          style="display:block;width:100%;max-width:100%;height:auto;border-radius:8px 8px 0 0;filter:none" />`
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

function buildGridLayout(products: ShopifyProduct[], btnColor?: string): string {
  const cards = products.map((p) => buildProductCard(p, btnColor)).join("\n");
  return `\n<!-- Prodotti -->\n<div style="margin:8px 0">\n${cards}\n</div>\n`;
}

function buildScrollLayout(products: ShopifyProduct[], btnColor?: string): string {
  const cells = products.map((p) => `<td style="padding:0 6px;vertical-align:top">${buildScrollCard(p, btnColor)}</td>`).join("\n");
  return `\n<!-- Prodotti (scorrimento) -->\n<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:16px 0;padding-bottom:8px">\n  <table cellpadding="0" cellspacing="0" border="0" style="white-space:nowrap"><tr>\n${cells}\n  </tr></table>\n</div>\n`;
}
