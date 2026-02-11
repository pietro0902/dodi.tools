interface PreviewOptions {
  subject: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  storeName: string;
  logoUrl: string;
  logoWidth?: number;
}

export function buildPreviewHtml(opts: PreviewOptions): string {
  const { subject, bodyHtml, ctaText, ctaUrl, storeName, logoUrl, logoWidth = 120 } = opts;

  const previewBody = bodyHtml.replace(/\{\{name\}\}/g, "Maria");

  const ctaBlock =
    ctaText && ctaUrl
      ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background-color:#111827;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px;margin:16px 0 24px">${escapeHtml(ctaText)}</a>`
      : "";

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)}" width="${logoWidth}" style="margin:0 auto 12px;display:block;height:auto" />`
    : "";

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject || "Anteprima")}</title>
</head>
<body style="background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px 0">
  <div style="background-color:#ffffff;margin:0 auto;padding:24px 32px;max-width:600px;border-radius:8px">

    <!-- Header -->
    <div style="text-align:center;padding:32px 0 24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px">
      ${logoBlock}
      ${!logoUrl ? `<p style="font-size:20px;font-weight:bold;color:#111827;margin:0">${escapeHtml(storeName)}</p>` : ""}
    </div>

    <!-- Body -->
    ${previewBody}

    <!-- CTA -->
    ${ctaBlock}

    <!-- Saluto -->
    <p style="font-size:16px;line-height:26px;color:#374151;margin:24px 0 0">
      A presto,<br />Il team di ${escapeHtml(storeName)}
    </p>

    <!-- Footer -->
    <div style="margin-top:32px;text-align:center">
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px" />
      <p style="font-size:12px;color:#6b7280;line-height:20px;margin:0 0 8px">
        Hai ricevuto questa email perch&eacute; ti sei iscritto alla newsletter di ${escapeHtml(storeName)}.
      </p>
      <p style="font-size:11px;color:#9ca3af;margin:16px 0 0">
        &copy; ${new Date().getFullYear()} ${escapeHtml(storeName)}. Tutti i diritti riservati.
      </p>
    </div>

  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
