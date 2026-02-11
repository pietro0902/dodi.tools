"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Spinner,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
import { buildPreviewHtml } from "@/lib/preview-wrapper";
import type { AutomationSettings } from "@/lib/automation-settings";

function useShopifyGlobal() {
  const [bridge, setBridge] = useState<typeof shopify | null>(
    typeof window !== "undefined" && typeof shopify !== "undefined"
      ? shopify
      : null
  );

  useEffect(() => {
    if (bridge) return;
    let attempts = 0;
    const interval = setInterval(() => {
      if (typeof shopify !== "undefined") {
        setBridge(shopify);
        clearInterval(interval);
      } else if (++attempts >= 20) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [bridge]);

  return bridge;
}

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || "Dodi's";
const STORE_LOGO_URL = process.env.NEXT_PUBLIC_STORE_LOGO_URL || "";

export default function AutomationsPage() {
  const app = useShopifyGlobal();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"welcome" | "abandonedCart" | null>(null);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);

  // Preview state
  const [welcomePreview, setWelcomePreview] = useState("");
  const [cartPreview, setCartPreview] = useState("");

  const fetchSettings = useCallback(async () => {
    if (!app) return;
    setLoading(true);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/automations/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Fetch settings error:", err);
      if (app) {
        app.toast.show(
          err instanceof Error ? err.message : "Errore nel caricamento",
          { isError: true }
        );
      }
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Update previews when settings change
  useEffect(() => {
    if (!settings) return;
    setWelcomePreview(
      buildPreviewHtml({
        subject: settings.welcome.subject,
        bodyHtml: settings.welcome.bodyHtml,
        ctaText: "",
        ctaUrl: "",
        storeName: STORE_NAME,
        logoUrl: STORE_LOGO_URL,
      })
    );
    setCartPreview(
      buildPreviewHtml({
        subject: settings.abandonedCart.subject,
        bodyHtml: settings.abandonedCart.bodyHtml + "\n<p style=\"color:#6b7280;font-style:italic\">[Dettaglio prodotti nel carrello - auto-generato]</p>",
        ctaText: "Completa l'acquisto",
        ctaUrl: "#",
        storeName: STORE_NAME,
        logoUrl: STORE_LOGO_URL,
      })
    );
  }, [settings]);

  const handleSave = useCallback(
    async (section: "welcome" | "abandonedCart") => {
      if (!app || !settings) return;
      setSaving(section);
      try {
        const token = await app.idToken();
        const res = await fetch("/api/automations/settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(settings),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        app.toast.show("Impostazioni salvate");
      } catch (err) {
        app.toast.show(
          err instanceof Error ? err.message : "Errore nel salvataggio",
          { isError: true }
        );
      } finally {
        setSaving(null);
      }
    },
    [app, settings]
  );

  const updateWelcome = useCallback(
    (field: keyof AutomationSettings["welcome"], value: string | boolean) => {
      setSettings((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          welcome: { ...prev.welcome, [field]: value },
        };
      });
    },
    []
  );

  const updateCart = useCallback(
    (field: keyof AutomationSettings["abandonedCart"], value: string | boolean | number) => {
      setSettings((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          abandonedCart: { ...prev.abandonedCart, [field]: value },
        };
      });
    },
    []
  );

  if (loading) {
    return (
      <Page
        title="Automazioni"
        backAction={{ onAction: () => router.push("/") }}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <InlineStack align="center">
                <Spinner size="large" />
              </InlineStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (!settings) {
    return (
      <Page
        title="Automazioni"
        backAction={{ onAction: () => router.push("/") }}
      >
        <Layout>
          <Layout.Section>
            <Banner tone="critical">
              <p>Impossibile caricare le impostazioni. Riprova.</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Automazioni"
      backAction={{ onAction: () => router.push("/") }}
    >
      <Layout>
        {/* ──── Welcome Email ──── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Email di Benvenuto
                  </Text>
                  <Badge tone={settings.welcome.enabled ? "success" : undefined}>
                    {settings.welcome.enabled ? "Attiva" : "Disattiva"}
                  </Badge>
                </InlineStack>
                <Button
                  size="slim"
                  onClick={() => updateWelcome("enabled", !settings.welcome.enabled)}
                >
                  {settings.welcome.enabled ? "Disabilita" : "Abilita"}
                </Button>
              </InlineStack>

              <Text as="p" variant="bodySm" tone="subdued">
                Inviata automaticamente ai nuovi clienti con consenso marketing.
              </Text>

              <TextField
                label="Oggetto"
                value={settings.welcome.subject}
                onChange={(v) => updateWelcome("subject", v)}
                autoComplete="off"
                helpText="Usa {{name}} per il nome del cliente."
              />

              <TextField
                label="Corpo HTML"
                value={settings.welcome.bodyHtml}
                onChange={(v) => updateWelcome("bodyHtml", v)}
                multiline={6}
                autoComplete="off"
                helpText="Usa {{name}} per il nome del cliente."
              />

              {/* Preview */}
              {welcomePreview && (
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Anteprima:
                  </Text>
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      overflow: "hidden",
                      maxWidth: "600px",
                      height: "400px",
                    }}
                  >
                    <iframe
                      srcDoc={welcomePreview}
                      title="Anteprima benvenuto"
                      style={{ width: "100%", height: "100%", border: "none" }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                </BlockStack>
              )}

              <Button
                variant="primary"
                onClick={() => handleSave("welcome")}
                loading={saving === "welcome"}
              >
                Salva benvenuto
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ──── Abandoned Cart ──── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Carrello Abbandonato
                  </Text>
                  <Badge tone={settings.abandonedCart.enabled ? "success" : undefined}>
                    {settings.abandonedCart.enabled ? "Attiva" : "Disattiva"}
                  </Badge>
                </InlineStack>
                <Button
                  size="slim"
                  onClick={() => updateCart("enabled", !settings.abandonedCart.enabled)}
                >
                  {settings.abandonedCart.enabled ? "Disabilita" : "Abilita"}
                </Button>
              </InlineStack>

              <Text as="p" variant="bodySm" tone="subdued">
                Inviata ai clienti che hanno abbandonato il carrello. I dettagli
                dei prodotti nel carrello vengono aggiunti automaticamente.
              </Text>

              <TextField
                label="Oggetto"
                value={settings.abandonedCart.subject}
                onChange={(v) => updateCart("subject", v)}
                autoComplete="off"
                helpText="Usa {{name}} per il nome del cliente."
              />

              <TextField
                label="Testo introduttivo (HTML)"
                value={settings.abandonedCart.bodyHtml}
                onChange={(v) => updateCart("bodyHtml", v)}
                multiline={4}
                autoComplete="off"
                helpText="Questo testo appare prima della lista prodotti nel carrello. Usa {{name}} per il nome."
              />

              <InlineStack gap="400">
                <div style={{ width: "200px" }}>
                  <TextField
                    label="Ritardo (ore)"
                    type="number"
                    value={String(settings.abandonedCart.delayHours)}
                    onChange={(v) => {
                      const n = parseInt(v, 10);
                      if (!isNaN(n) && n >= 1) updateCart("delayHours", n);
                    }}
                    min={1}
                    max={72}
                    suffix="h"
                    autoComplete="off"
                    helpText="Ore di attesa prima dell'invio"
                  />
                </div>
                <div style={{ width: "200px" }}>
                  <TextField
                    label="Età massima (ore)"
                    type="number"
                    value={String(settings.abandonedCart.maxAgeHours)}
                    onChange={(v) => {
                      const n = parseInt(v, 10);
                      if (!isNaN(n) && n >= 1) updateCart("maxAgeHours", n);
                    }}
                    min={1}
                    max={168}
                    suffix="h"
                    autoComplete="off"
                    helpText="Non inviare per carrelli più vecchi di"
                  />
                </div>
              </InlineStack>

              {/* Preview */}
              {cartPreview && (
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Anteprima:
                  </Text>
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      overflow: "hidden",
                      maxWidth: "600px",
                      height: "400px",
                    }}
                  >
                    <iframe
                      srcDoc={cartPreview}
                      title="Anteprima carrello abbandonato"
                      style={{ width: "100%", height: "100%", border: "none" }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                </BlockStack>
              )}

              <Button
                variant="primary"
                onClick={() => handleSave("abandonedCart")}
                loading={saving === "abandonedCart"}
              >
                Salva carrello abbandonato
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
