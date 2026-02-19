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

  const itemRows = lineItems
    .map((item) => {
      const variant = item.variantTitle ? ` — ${item.variantTitle}` : "";
      const imgCell = item.imageUrl
        ? `<td style="padding:8px 12px 8px 0;border-bottom:1px solid #f3f4f6;width:64px;vertical-align:middle">
            <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" width="56" height="56" style="display:block;border-radius:6px;object-fit:cover;width:56px;height:56px" />
          </td>`
        : "";
      return `<tr>
        ${imgCell}
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:${textColor};vertical-align:middle">
          <strong>${escapeHtml(item.title)}</strong>${variant ? `<br/><span style="color:#9ca3af;font-size:13px">${escapeHtml(variant)}</span>` : ""}
          <br/><span style="color:#6b7280;font-size:13px">Qtà: ${item.quantity}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:${textColor};text-align:right;vertical-align:middle;white-space:nowrap">
          ${formatPrice(item.price)}
        </td>
      </tr>`;
    })
    .join("\n");

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
  ${itemRows}
  <tr>
    <td colspan="3" style="padding:12px 0 0;font-size:16px;font-weight:bold;color:${textColor};text-align:right">
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
