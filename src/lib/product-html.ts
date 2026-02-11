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

function buildProductCell(product: ShopifyProduct, widthPct: string): string {
  const imgBlock = product.imageUrl
    ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.title)}" style="width:100%;max-width:200px;height:auto;border-radius:6px;display:block;margin:0 auto" />`
    : "";

  const priceDisplay = formatPrice(product.price, product.currency);
  const compareBlock =
    product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price)
      ? `<br/><span style="text-decoration:line-through;color:#9ca3af;font-size:13px">${formatPrice(product.compareAtPrice, product.currency)}</span>`
      : "";

  return `<td width="${widthPct}" style="width:${widthPct};padding:8px;vertical-align:top;text-align:center">
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#ffffff">
    ${imgBlock}
    <p style="font-size:14px;font-weight:600;color:#111827;margin:8px 0 4px">${esc(product.title)}</p>
    <p style="font-size:15px;color:#111827;font-weight:700;margin:0 0 12px">${priceDisplay}${compareBlock}</p>
    <a href="${esc(product.url)}" style="display:inline-block;background-color:#111827;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:8px 20px;border-radius:6px">Acquista</a>
  </div>
</td>`;
}

export function buildProductBlockHtml(product: ShopifyProduct): string {
  return buildProductGridHtml([product]);
}

export function buildProductGridHtml(products: ShopifyProduct[]): string {
  if (products.length === 0) return "";

  // Build rows of 2 products each
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const hasTwo = i + 1 < products.length;
    const widthPct = hasTwo ? "50%" : "50%";

    let row = `<tr>\n${buildProductCell(products[i], widthPct)}`;
    if (hasTwo) {
      row += `\n${buildProductCell(products[i + 1], widthPct)}`;
    } else {
      row += `\n<td width="50%" style="width:50%"></td>`;
    }
    row += `\n</tr>`;
    rows.push(row);
  }

  return `\n<!-- Prodotti -->\n<table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:16px 0">\n${rows.join("\n")}\n</table>\n`;
}
