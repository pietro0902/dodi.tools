interface CartLineItem {
  title: string;
  quantity: number;
  price: string;
  variantTitle?: string | null;
}

export function buildCartItemsHtml(
  lineItems: CartLineItem[],
  totalPrice: string,
  currency: string,
  checkoutUrl: string
): string {
  const formatPrice = (amount: string) => {
    const num = parseFloat(amount);
    if (currency === "EUR") return `\u20AC${num.toFixed(2)}`;
    return `${num.toFixed(2)} ${currency}`;
  };

  const itemRows = lineItems
    .map((item) => {
      const variant = item.variantTitle ? ` — ${item.variantTitle}` : "";
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151">
          ${escapeHtml(item.title)}${escapeHtml(variant)} &times; ${item.quantity}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;text-align:right;white-space:nowrap">
          ${formatPrice(item.price)}
        </td>
      </tr>`;
    })
    .join("\n");

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
  ${itemRows}
  <tr>
    <td style="padding:12px 0 0;font-size:16px;font-weight:bold;color:#111827">
      Totale
    </td>
    <td style="padding:12px 0 0;font-size:16px;font-weight:bold;color:#111827;text-align:right">
      ${formatPrice(totalPrice)}
    </td>
  </tr>
</table>
<div style="text-align:center;margin:24px 0">
  <a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;background-color:#111827;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px">
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
