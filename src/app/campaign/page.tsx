"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  TextField,
  Select,
  Button,
  BlockStack,
  InlineGrid,
  Modal,
  Box,
  Banner,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
import {
  CAMPAIGN_TEMPLATES,
  type CampaignTemplate,
} from "@/lib/campaign-templates";
import { buildPreviewHtml } from "@/lib/preview-wrapper";

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

const templateOptions = CAMPAIGN_TEMPLATES.map((t) => ({
  label: t.name,
  value: t.id,
}));

function isFormDirty(form: CampaignTemplate, template: CampaignTemplate) {
  return (
    form.subject !== template.subject ||
    form.bodyHtml !== template.bodyHtml ||
    form.ctaText !== template.ctaText ||
    form.ctaUrl !== template.ctaUrl
  );
}

export default function CampaignEditor() {
  const app = useShopifyGlobal();
  const router = useRouter();

  const [selectedTemplateId, setSelectedTemplateId] = useState("blank");
  const [form, setForm] = useState<CampaignTemplate>({
    ...CAMPAIGN_TEMPLATES[0],
  });
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(
    null
  );

  // Debounced preview
  const [previewHtml, setPreviewHtml] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTemplate = useMemo(
    () => CAMPAIGN_TEMPLATES.find((t) => t.id === selectedTemplateId)!,
    [selectedTemplateId]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewHtml(
        buildPreviewHtml({
          subject: form.subject,
          bodyHtml: form.bodyHtml,
          ctaText: form.ctaText,
          ctaUrl: form.ctaUrl,
          storeName: STORE_NAME,
          logoUrl: STORE_LOGO_URL,
        })
      );
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.subject, form.bodyHtml, form.ctaText, form.ctaUrl]);

  const applyTemplate = useCallback((id: string) => {
    const tpl = CAMPAIGN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setSelectedTemplateId(id);
    setForm({ ...tpl });
  }, []);

  const handleTemplateChange = useCallback(
    (value: string) => {
      if (isFormDirty(form, currentTemplate)) {
        setPendingTemplateId(value);
        setConfirmOpen(true);
      } else {
        applyTemplate(value);
      }
    },
    [form, currentTemplate, applyTemplate]
  );

  const handleConfirmSwitch = useCallback(() => {
    if (pendingTemplateId) applyTemplate(pendingTemplateId);
    setConfirmOpen(false);
    setPendingTemplateId(null);
  }, [pendingTemplateId, applyTemplate]);

  const handleCancelSwitch = useCallback(() => {
    setConfirmOpen(false);
    setPendingTemplateId(null);
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof CampaignTemplate) => (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSend = useCallback(async () => {
    if (!app) return;
    if (!form.subject || !form.bodyHtml) {
      app.toast.show("Compila almeno oggetto e corpo HTML", { isError: true });
      return;
    }

    setSending(true);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: form.subject,
          html: form.bodyHtml,
          ctaText: form.ctaText,
          ctaUrl: form.ctaUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      app.toast.show(`Campagna inviata a ${data.sentTo ?? "?"} iscritti`);
      applyTemplate("blank");
    } catch (err) {
      app.toast.show(
        err instanceof Error ? err.message : "Errore nell'invio",
        { isError: true }
      );
    } finally {
      setSending(false);
    }
  }, [form, app, applyTemplate]);

  const selectedDescription =
    CAMPAIGN_TEMPLATES.find((t) => t.id === selectedTemplateId)?.description ||
    "";

  return (
    <Page
      title="Editor Campagna"
      backAction={{ onAction: () => router.push("/") }}
    >
      {/* Template selector */}
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Select
                label="Template"
                options={templateOptions}
                value={selectedTemplateId}
                onChange={handleTemplateChange}
              />
              <Text as="p" variant="bodySm" tone="subdued">
                {selectedDescription}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Split: Editor + Preview */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: ["oneHalf", "oneHalf"] }} gap="400">
            {/* Editor */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Contenuto
                </Text>
                <TextField
                  label="Oggetto"
                  value={form.subject}
                  onChange={handleFieldChange("subject")}
                  placeholder="Es: Nuova collezione primavera"
                  autoComplete="off"
                />
                <TextField
                  label="Corpo HTML"
                  value={form.bodyHtml}
                  onChange={handleFieldChange("bodyHtml")}
                  multiline={12}
                  placeholder="<p>Ciao {{name}}, scopri le novità...</p>"
                  helpText="Usa {{name}} per inserire il nome del destinatario"
                  autoComplete="off"
                />
                <TextField
                  label="Testo CTA"
                  value={form.ctaText}
                  onChange={handleFieldChange("ctaText")}
                  placeholder="Scopri ora"
                  autoComplete="off"
                />
                <TextField
                  label="URL CTA"
                  value={form.ctaUrl}
                  onChange={handleFieldChange("ctaUrl")}
                  placeholder="https://www.dodishop.it/collections/new"
                  autoComplete="off"
                />
                <Box>
                  <Button
                    variant="primary"
                    onClick={handleSend}
                    loading={sending}
                  >
                    Invia campagna
                  </Button>
                </Box>
              </BlockStack>
            </Card>

            {/* Preview */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Anteprima
                </Text>
                {!form.subject && !form.bodyHtml ? (
                  <Banner tone="info">
                    <p>
                      Compila i campi a sinistra per visualizzare l&apos;anteprima
                      dell&apos;email.
                    </p>
                  </Banner>
                ) : (
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <iframe
                      srcDoc={previewHtml}
                      title="Anteprima email"
                      style={{
                        width: "100%",
                        height: "600px",
                        border: "none",
                      }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                )}
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>
      </Layout>

      {/* Confirm template switch modal */}
      <Modal
        open={confirmOpen}
        onClose={handleCancelSwitch}
        title="Cambiare template?"
        primaryAction={{
          content: "Cambia template",
          onAction: handleConfirmSwitch,
          destructive: true,
        }}
        secondaryActions={[
          { content: "Annulla", onAction: handleCancelSwitch },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Hai modificato il contenuto attuale. Cambiando template perderai le
            modifiche non salvate.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
