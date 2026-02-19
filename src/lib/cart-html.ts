interface CartLineItem {
  title: string;
  quantity: number;
  price: string;
  variantTitle?: string | null;
  imageUrl?: string | null;
}

interface CartColors {
  textColor?: string;
  btnColor?: string;
  btnTextColor?: string;
}

export function buildCartItemsHtml(
  lineItems: CartLineItem[],
  totalPrice: string,
  currency: string,
  checkoutUrl: string,
  colors: CartColors = {}
): string {
  const textColor = colors.textColor || "#374151";
  const btnColor = colors.btnColor || "#111827";
  const btnTextColor = colors.btnTextColor || "#ffffff";

  const formatPrice = (amount: string) => {
    const num = parseFloat(amount);
    if (currency === "EUR") return `\u20AC${num.toFixed(2)}`;
    return `${num.toFixed(2)} ${currency}`;
  };

  // Group items into rows of up to 3
  const rows: CartLineItem[][] = [];
  for (let i = 0; i < lineItems.length; i += 3) {
    rows.push(lineItems.slice(i, i + 3));
  }

  const cardWidth = lineItems.length === 1 ? "100%" : lineItems.length === 2 ? "48%" : "31%";

  const rowsHtml = rows
    .map((row) => {
      const cells = row
        .map((item) => {
          const variant = item.variantTitle ? item.variantTitle : null;
          const imgHtml = item.imageUrl
            ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" width="200" style="display:block;width:100%;height:180px;object-fit:cover;border-radius:8px 8px 0 0" />`
            : `<div style="width:100%;height:180px;background:#f3f4f6;border-radius:8px 8px 0 0;display:block"></div>`;

          return `<td style="width:${cardWidth};vertical-align:top;padding:0 6px">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px">
    <tr><td style="padding:0;line-height:0">${imgHtml}</td></tr>
    <tr>
      <td style="padding:12px;font-size:14px;color:${textColor}">
        <div style="font-weight:700;font-size:14px;color:${textColor};margin-bottom:4px;line-height:1.3">${escapeHtml(item.title)}</div>
        ${variant ? `<div style="font-size:13px;color:#9ca3af;margin-bottom:4px">${escapeHtml(variant)}</div>` : ""}
        <div style="font-size:13px;color:#6b7280;margin-bottom:6px">Qtà: ${item.quantity}</div>
        <div style="font-size:16px;font-weight:700;color:${textColor}">${formatPrice(item.price)}</div>
      </td>
    </tr>
  </table>
</td>`;
        })
        .join("\n");

      // Pad with empty cells if row has fewer than 3 items and there are multiple items
      const emptyCells = lineItems.length > 1
        ? Array(3 - row.length).fill(`<td style="width:${cardWidth};padding:0 6px"></td>`).join("")
        : "";

      return `<tr>${cells}${emptyCells}</tr>`;
    })
    .join("\n");

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse">
  ${rowsHtml}
  <tr>
    <td colspan="3" style="padding:12px 6px 0;font-size:16px;font-weight:bold;color:${textColor};text-align:right;border-top:1px solid #e5e7eb">
      Totale: ${formatPrice(totalPrice)}
    </td>
  </tr>
</table>
<div style="text-align:center;margin:24px 0">
  <a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;background-color:${btnColor};color:${btnTextColor};font-size:16px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px">
    Completa l&#8217;acquisto
  </a>
</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
