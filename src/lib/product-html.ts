import type { ShopifyProduct } from "@/types/shopify";

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

export function buildProductBlockHtml(product: ShopifyProduct): string {
  const imgBlock = product.imageUrl
    ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" width="260" style="width:100%;max-width:260px;height:auto;border-radius:6px;display:block;margin:0 auto" />`
    : "";

  const priceDisplay = formatPrice(product.price, product.currency);
  const compareBlock =
    product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)
      ? `<span style="text-decoration:line-through;color:#9ca3af;font-size:14px;margin-left:8px">${formatPrice(product.compareAtPrice, product.currency)}</span>`
      : "";

  return `<table cellpadding="0" cellspacing="0" border="0" width="280" style="display:inline-table;vertical-align:top;margin:8px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <tr>
    <td style="padding:12px;text-align:center">
      ${imgBlock}
    </td>
  </tr>
  <tr>
    <td style="padding:0 12px">
      <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px;text-align:center">${esc(product.title)}</p>
      <p style="font-size:16px;color:#111827;font-weight:700;margin:0 0 12px;text-align:center">${priceDisplay}${compareBlock}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 12px 16px;text-align:center">
      <a href="${esc(product.url)}" style="display:inline-block;background-color:#111827;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:6px">Acquista</a>
    </td>
  </tr>
</table>`;
}

export function buildProductGridHtml(products: ShopifyProduct[]): string {
  if (products.length === 0) return "";

  const cards = products.map(buildProductBlockHtml).join("\n");

  return `\n<!-- Prodotti -->\n<div style="text-align:center;margin:16px 0">\n${cards}\n</div>\n`;
}
