"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  Select,
  Box,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
import { buildPreviewHtml } from "@/lib/preview-wrapper";
import { blocksToHtml, templateToBlocks } from "@/lib/email-blocks";
import type { EmailBlock } from "@/lib/email-blocks";
import type { AutomationSettings } from "@/lib/automation-settings";
import type { CampaignTemplate } from "@/lib/campaign-templates";
import type { CustomTemplate } from "@/lib/custom-templates";

/** Normalized template for the dropdown */
interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  blocks: EmailBlock[];
  bgColor: string;
  btnColor: string;
  containerColor: string;
  textColor: string;
  isDefault: boolean;
}

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

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Box minWidth="140px">
      <BlockStack gap="100">
        <Text as="span" variant="bodySm">{label}</Text>
        <InlineStack gap="200" blockAlign="center">
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "4px",
              backgroundColor: value,
              border: "1px solid #d1d5db",
              cursor: "pointer",
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer",
              }}
            />
          </div>
          <div style={{ width: "90px" }}>
            <TextField
              label=""
              labelHidden
              value={value}
              onChange={onChange}
              autoComplete="off"
              monospaced
            />
          </div>
        </InlineStack>
      </BlockStack>
    </Box>
  );
}

export default function AutomationsPage() {
  const app = useShopifyGlobal();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"welcome" | "abandonedCart" | null>(null);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [allTemplates, setAllTemplates] = useState<TemplateOption[]>([]);

  // Debounced previews
  const [welcomePreview, setWelcomePreview] = useState("");
  const [cartPreview, setCartPreview] = useState("");
  const welcomeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (!app) return;
    setLoading(true);
    try {
      const token = await app.idToken();
      const [settingsRes, templatesRes] = await Promise.all([
        fetch("/api/automations/settings", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/templates", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!settingsRes.ok) throw new Error(`HTTP ${settingsRes.status}`);
      const settingsData = await settingsRes.json();
      setSettings(settingsData);

      if (templatesRes.ok) {
        const tplData = await templatesRes.json();
        const defaults: TemplateOption[] = ((tplData.defaults || []) as CampaignTemplate[])
          .filter((d) => d.id !== "blank")
          .map((d) => ({
            id: d.id,
            name: d.name,
            subject: d.subject,
            preheader: "",
            blocks: d.blocks ? d.blocks.map((b) => ({ ...b })) : templateToBlocks(d),
            bgColor: d.bgColor || "#f9fafb",
            btnColor: d.btnColor || "#111827",
            containerColor: d.containerColor || "#ffffff",
            textColor: d.textColor || "#374151",
            isDefault: true,
          }));
        const customs: TemplateOption[] = ((tplData.custom || []) as CustomTemplate[]).map((c) => ({
          id: c.id,
          name: c.name,
          subject: c.subject,
          preheader: c.preheader || "",
          blocks: c.blocks || [],
          bgColor: c.bgColor || "#f9fafb",
          btnColor: c.btnColor || "#111827",
          containerColor: c.containerColor || "#ffffff",
          textColor: c.textColor || "#374151",
          isDefault: false,
        }));
        setAllTemplates([...defaults, ...customs]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
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
    fetchData();
  }, [fetchData]);

  // Template select options
  const templateOptions = useMemo(
    () => [
      { label: "Personalizzato", value: "" },
      ...allTemplates.map((t) => ({
        label: t.isDefault ? `${t.name} (default)` : t.name,
        value: t.id,
      })),
    ],
    [allTemplates]
  );

  // Find selected template
  const welcomeTemplate = useMemo(
    () => (settings?.welcome.templateId ? allTemplates.find((t) => t.id === settings.welcome.templateId) : null),
    [settings?.welcome.templateId, allTemplates]
  );
  const cartTemplate = useMemo(
    () => (settings?.abandonedCart.templateId ? allTemplates.find((t) => t.id === settings.abandonedCart.templateId) : null),
    [settings?.abandonedCart.templateId, allTemplates]
  );

  // Preview generation - welcome
  useEffect(() => {
    if (!settings) return;
    if (welcomeDebounceRef.current) clearTimeout(welcomeDebounceRef.current);
    welcomeDebounceRef.current = setTimeout(() => {
      let bodyHtml: string;
      let bgColor: string | undefined;
      let btnColor: string | undefined;
      let containerColor: string | undefined;
      let textColor: string | undefined;
      let preheader: string | undefined;

      if (welcomeTemplate) {
        bodyHtml = blocksToHtml(welcomeTemplate.blocks || [], welcomeTemplate.btnColor || "#111827");
        bgColor = welcomeTemplate.bgColor;
        btnColor = welcomeTemplate.btnColor;
        containerColor = welcomeTemplate.containerColor;
        textColor = welcomeTemplate.textColor;
        preheader = welcomeTemplate.preheader;
      } else {
        bodyHtml = settings.welcome.bodyHtml;
        bgColor = settings.welcome.bgColor;
        btnColor = settings.welcome.btnColor;
        containerColor = settings.welcome.containerColor;
        textColor = settings.welcome.textColor;
        preheader = settings.welcome.preheader;
      }

      setWelcomePreview(
        buildPreviewHtml({
          subject: welcomeTemplate ? welcomeTemplate.subject : settings.welcome.subject,
          preheader,
          bodyHtml,
          ctaText: "",
          ctaUrl: "",
          storeName: STORE_NAME,
          bgColor,
          btnColor,
          containerColor,
          textColor,
        })
      );
    }, 300);
    return () => { if (welcomeDebounceRef.current) clearTimeout(welcomeDebounceRef.current); };
  }, [settings, welcomeTemplate]);

  // Preview generation - cart
  useEffect(() => {
    if (!settings) return;
    if (cartDebounceRef.current) clearTimeout(cartDebounceRef.current);
    cartDebounceRef.current = setTimeout(() => {
      let bodyHtml: string;
      let bgColor: string | undefined;
      let btnColor: string | undefined;
      let containerColor: string | undefined;
      let textColor: string | undefined;
      let preheader: string | undefined;

      if (cartTemplate) {
        bodyHtml = blocksToHtml(cartTemplate.blocks || [], cartTemplate.btnColor || "#111827");
        bgColor = cartTemplate.bgColor;
        btnColor = cartTemplate.btnColor;
        containerColor = cartTemplate.containerColor;
        textColor = cartTemplate.textColor;
        preheader = cartTemplate.preheader;
      } else {
        bodyHtml = settings.abandonedCart.bodyHtml;
        bgColor = settings.abandonedCart.bgColor;
        btnColor = settings.abandonedCart.btnColor;
        containerColor = settings.abandonedCart.containerColor;
        textColor = settings.abandonedCart.textColor;
        preheader = settings.abandonedCart.preheader;
      }

      bodyHtml += '\n<p style="color:#6b7280;font-style:italic">[Dettaglio prodotti nel carrello - auto-generato]</p>';

      setCartPreview(
        buildPreviewHtml({
          subject: cartTemplate ? cartTemplate.subject : settings.abandonedCart.subject,
          preheader,
          bodyHtml,
          ctaText: "",
          ctaUrl: "",
          storeName: STORE_NAME,
          bgColor,
          btnColor,
          containerColor,
          textColor,
        })
      );
    }, 300);
    return () => { if (cartDebounceRef.current) clearTimeout(cartDebounceRef.current); };
  }, [settings, cartTemplate]);

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
    (field: keyof AutomationSettings["welcome"], value: string | boolean | undefined) => {
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
    (field: keyof AutomationSettings["abandonedCart"], value: string | boolean | number | undefined) => {
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

              {allTemplates.length > 0 && (
                <Select
                  label="Template"
                  options={templateOptions}
                  value={settings.welcome.templateId || ""}
                  onChange={(v) => updateWelcome("templateId", v || undefined)}
                  helpText="Scegli un template o usa contenuto personalizzato."
                />
              )}

              {welcomeTemplate ? (
                <BlockStack gap="200">
                  <Banner tone="info">
                    <p>
                      Usando il template &quot;{welcomeTemplate.name}&quot;. L&apos;oggetto e il contenuto
                      sono definiti nel template.{" "}
                      <Button variant="plain" onClick={() => router.push("/templates")}>
                        Modifica template
                      </Button>
                    </p>
                  </Banner>
                </BlockStack>
              ) : (
                <>
                  <TextField
                    label="Oggetto"
                    value={settings.welcome.subject}
                    onChange={(v) => updateWelcome("subject", v)}
                    autoComplete="off"
                    helpText="Usa {{name}} per il nome del cliente."
                  />

                  <TextField
                    label="Preheader"
                    value={settings.welcome.preheader || ""}
                    onChange={(v) => updateWelcome("preheader", v)}
                    autoComplete="off"
                    helpText="Testo di anteprima visibile nell'inbox."
                  />

                  <TextField
                    label="Corpo HTML"
                    value={settings.welcome.bodyHtml}
                    onChange={(v) => updateWelcome("bodyHtml", v)}
                    multiline={6}
                    autoComplete="off"
                    helpText="Usa {{name}} per il nome del cliente."
                  />

                  <Text as="h3" variant="headingSm">
                    Colori
                  </Text>
                  <InlineStack gap="300" wrap>
                    <ColorPicker
                      label="Sfondo"
                      value={settings.welcome.bgColor || "#f9fafb"}
                      onChange={(v) => updateWelcome("bgColor", v)}
                    />
                    <ColorPicker
                      label="Contenuto"
                      value={settings.welcome.containerColor || "#ffffff"}
                      onChange={(v) => updateWelcome("containerColor", v)}
                    />
                    <ColorPicker
                      label="Bottone"
                      value={settings.welcome.btnColor || "#111827"}
                      onChange={(v) => updateWelcome("btnColor", v)}
                    />
                    <ColorPicker
                      label="Testo"
                      value={settings.welcome.textColor || "#374151"}
                      onChange={(v) => updateWelcome("textColor", v)}
                    />
                  </InlineStack>
                </>
              )}

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

              {allTemplates.length > 0 && (
                <Select
                  label="Template"
                  options={templateOptions}
                  value={settings.abandonedCart.templateId || ""}
                  onChange={(v) => updateCart("templateId", v || undefined)}
                  helpText="Scegli un template o usa contenuto personalizzato. I prodotti del carrello vengono sempre appesi."
                />
              )}

              {cartTemplate ? (
                <BlockStack gap="200">
                  <Banner tone="info">
                    <p>
                      Usando il template &quot;{cartTemplate.name}&quot;. L&apos;oggetto e il contenuto
                      sono definiti nel template. I prodotti del carrello vengono appesi automaticamente.{" "}
                      <Button variant="plain" onClick={() => router.push("/templates")}>
                        Modifica template
                      </Button>
                    </p>
                  </Banner>
                </BlockStack>
              ) : (
                <>
                  <TextField
                    label="Oggetto"
                    value={settings.abandonedCart.subject}
                    onChange={(v) => updateCart("subject", v)}
                    autoComplete="off"
                    helpText="Usa {{name}} per il nome del cliente."
                  />

                  <TextField
                    label="Preheader"
                    value={settings.abandonedCart.preheader || ""}
                    onChange={(v) => updateCart("preheader", v)}
                    autoComplete="off"
                    helpText="Testo di anteprima visibile nell'inbox."
                  />

                  <TextField
                    label="Testo introduttivo (HTML)"
                    value={settings.abandonedCart.bodyHtml}
                    onChange={(v) => updateCart("bodyHtml", v)}
                    multiline={4}
                    autoComplete="off"
                    helpText="Questo testo appare prima della lista prodotti nel carrello. Usa {{name}} per il nome."
                  />

                  <Text as="h3" variant="headingSm">
                    Colori
                  </Text>
                  <InlineStack gap="300" wrap>
                    <ColorPicker
                      label="Sfondo"
                      value={settings.abandonedCart.bgColor || "#f9fafb"}
                      onChange={(v) => updateCart("bgColor", v)}
                    />
                    <ColorPicker
                      label="Contenuto"
                      value={settings.abandonedCart.containerColor || "#ffffff"}
                      onChange={(v) => updateCart("containerColor", v)}
                    />
                    <ColorPicker
                      label="Bottone"
                      value={settings.abandonedCart.btnColor || "#111827"}
                      onChange={(v) => updateCart("btnColor", v)}
                    />
                    <ColorPicker
                      label="Testo"
                      value={settings.abandonedCart.textColor || "#374151"}
                      onChange={(v) => updateCart("textColor", v)}
                    />
                  </InlineStack>
                </>
              )}

              {/* Delay / max age - always visible */}
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
