export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "blank",
    name: "Template vuoto",
    description: "Parti da zero con un form vuoto",
    subject: "",
    bodyHtml: "",
    ctaText: "",
    ctaUrl: "",
  },
  {
    id: "promo",
    name: "Promozione / Saldi",
    description: "Sconti stagionali con evidenza sulla percentuale di sconto",
    subject: "🔥 Saldi Dodi's: fino al -40% su tutto!",
    bodyHtml: `<p>È il momento perfetto per rinnovare il tuo guardaroba!</p>
<p>Solo per questa settimana, approfitta di <strong>sconti fino al 40%</strong> su tutta la collezione Dodi's.</p>
<p>Affrettati, le scorte sono limitate! 🛍️</p>`,
    ctaText: "Scopri i saldi",
    ctaUrl: "https://www.dodishop.it/collections/saldi",
  },
  {
    id: "new-collection",
    name: "Nuova Collezione",
    description: "Lancio di nuovi prodotti e collezioni",
    subject: "✨ Nuova Collezione Dodi's — Scoprila in anteprima!",
    bodyHtml: `<p>Siamo entusiasti di presentarti la nostra <strong>nuova collezione</strong>!</p>
<p>Capi selezionati con cura, pensati per il tuo stile unico. Qualità, comfort e design si incontrano in ogni pezzo.</p>
<p>Sii tra i primi a scoprire le novità! 🌟</p>`,
    ctaText: "Esplora la collezione",
    ctaUrl: "https://www.dodishop.it/collections/nuovi-arrivi",
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Aggiornamenti settimanali con sezioni separate",
    subject: "📬 Le novità della settimana da Dodi's",
    bodyHtml: `<p><strong>🆕 Novità in negozio</strong></p>
<p>Questa settimana abbiamo aggiunto nuovi capi alla collezione. Vieni a scoprirli!</p>

<p><strong>💡 Il consiglio di stile</strong></p>
<p>Abbina i nostri capi basic con accessori colorati per un look fresco e moderno.</p>

<p><strong>📅 Prossimi eventi</strong></p>
<p>Resta aggiornato sulle nostre promozioni e eventi speciali seguendoci sui social!</p>`,
    ctaText: "Visita il negozio",
    ctaUrl: "https://www.dodishop.it",
  },
];
