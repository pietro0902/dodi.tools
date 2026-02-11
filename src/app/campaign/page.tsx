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
  InlineStack,
  Modal,
  Box,
  Banner,
  Spinner,
  Checkbox,
  Thumbnail,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
import {
  CAMPAIGN_TEMPLATES,
  type CampaignTemplate,
} from "@/lib/campaign-templates";
import { buildPreviewHtml } from "@/lib/preview-wrapper";
import { buildProductGridHtml } from "@/lib/product-html";
import type { ShopifyProduct, ShopifyCollection } from "@/types/shopify";

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

const sortOptions = [
  { label: "Best seller", value: "BEST_SELLING" },
  { label: "Prezzo: basso → alto", value: "PRICE" },
  { label: "Prezzo: alto → basso", value: "PRICE_DESC" },
  { label: "Nome A-Z", value: "TITLE" },
  { label: "Più recenti", value: "CREATED_AT" },
];

function isFormDirty(form: CampaignTemplate, template: CampaignTemplate) {
  return (
    form.subject !== template.subject ||
    form.bodyHtml !== template.bodyHtml ||
    form.ctaText !== template.ctaText ||
    form.ctaUrl !== template.ctaUrl
  );
}

function formatPrice(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (currency === "EUR") return `€${num.toFixed(2)}`;
  return `${num.toFixed(2)} ${currency}`;
}

export default function CampaignEditor() {
  const app = useShopifyGlobal();
  const router = useRouter();

  // --- Template & form state ---
  const [selectedTemplateId, setSelectedTemplateId] = useState("blank");
  const [form, setForm] = useState<CampaignTemplate>({
    ...CAMPAIGN_TEMPLATES[0],
  });
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(
    null
  );

  // --- Preview ---
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Product picker ---
  const [pickerOpen, setPickerOpen] = useState(false);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [selectedSort, setSelectedSort] = useState("BEST_SELLING");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  );
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTemplate = useMemo(
    () => CAMPAIGN_TEMPLATES.find((t) => t.id === selectedTemplateId)!,
    [selectedTemplateId]
  );

  // --- Preview debounce ---
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

  // --- Template handlers ---
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

  // --- Send campaign ---
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

  // --- Product picker: fetch products ---
  const fetchProducts = useCallback(
    async (query?: string, collection?: string, sort?: string) => {
      if (!app) return;
      setProductsLoading(true);
      try {
        const token = await app.idToken();
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (collection) params.set("collection", collection);
        if (sort) params.set("sort", sort);
        params.set("limit", "50");

        const res = await fetch(`/api/products/search?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setProducts(data.products || []);
      } catch (err) {
        console.error("Product fetch error:", err);
        setProducts([]);
        if (app) {
          app.toast.show(
            err instanceof Error ? err.message : "Errore nel caricamento prodotti",
            { isError: true }
          );
        }
      } finally {
        setProductsLoading(false);
      }
    },
    [app]
  );

  // --- Product picker: fetch collections ---
  const fetchCollections = useCallback(async () => {
    if (!app || collectionsLoaded) return;
    try {
      const token = await app.idToken();
      const res = await fetch("/api/collections/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCollections(data.collections || []);
      setCollectionsLoaded(true);
    } catch {
      setCollections([]);
    }
  }, [app, collectionsLoaded]);

  // --- Open picker ---
  const handleOpenPicker = useCallback(() => {
    setPickerOpen(true);
    setSelectedProducts(new Set());
    setSearchQuery("");
    setSelectedCollection("");
    setSelectedSort("BEST_SELLING");
    fetchCollections();
    fetchProducts(undefined, undefined, "BEST_SELLING");
  }, [fetchCollections, fetchProducts]);

  // --- Search with debounce ---
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        fetchProducts(value, selectedCollection, selectedSort);
      }, 400);
    },
    [fetchProducts, selectedCollection, selectedSort]
  );

  // --- Collection filter ---
  const handleCollectionChange = useCallback(
    (value: string) => {
      setSelectedCollection(value);
      fetchProducts(searchQuery, value, selectedSort);
    },
    [fetchProducts, searchQuery, selectedSort]
  );

  // --- Sort filter ---
  const handleSortChange = useCallback(
    (value: string) => {
      setSelectedSort(value);
      fetchProducts(searchQuery, selectedCollection, value);
    },
    [fetchProducts, searchQuery, selectedCollection]
  );

  // --- Toggle product selection ---
  const handleToggleProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  // --- Insert selected products into body ---
  const handleInsertProducts = useCallback(() => {
    const selected = products.filter((p) => selectedProducts.has(p.id));
    if (selected.length === 0) return;

    const html = buildProductGridHtml(selected);
    setForm((prev) => ({
      ...prev,
      bodyHtml: prev.bodyHtml + html,
    }));
    setPickerOpen(false);
    setSelectedProducts(new Set());
    if (app) {
      app.toast.show(
        `${selected.length} prodott${selected.length === 1 ? "o inserito" : "i inseriti"}`
      );
    }
  }, [products, selectedProducts, app]);

  const collectionOptions = useMemo(
    () => [
      { label: "Tutte le collezioni", value: "" },
      ...collections.map((c) => ({ label: c.title, value: c.id })),
    ],
    [collections]
  );

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

        {/* Editor */}
        <Layout.Section>
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
                helpText="Usa {{name}} per il nome destinatario. Usa il bottone qui sotto per inserire prodotti."
                autoComplete="off"
              />
              <InlineStack gap="300">
                <Button onClick={handleOpenPicker} variant="secondary">
                  Inserisci prodotti
                </Button>
              </InlineStack>
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
        </Layout.Section>

        {/* Preview */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Anteprima
                </Text>
                <InlineStack gap="200">
                  <Button
                    variant={previewMode === "desktop" ? "primary" : "secondary"}
                    size="slim"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    Desktop
                  </Button>
                  <Button
                    variant={previewMode === "mobile" ? "primary" : "secondary"}
                    size="slim"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    Mobile
                  </Button>
                </InlineStack>
              </InlineStack>
              {!form.subject && !form.bodyHtml ? (
                <Banner tone="info">
                  <p>
                    Compila i campi sopra per visualizzare l&apos;anteprima
                    dell&apos;email.
                  </p>
                </Banner>
              ) : (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    overflow: "hidden",
                    maxWidth: previewMode === "desktop" ? "660px" : "375px",
                    height: previewMode === "desktop" ? "800px" : "667px",
                    margin: "0 auto",
                    transition: "max-width 0.3s ease, height 0.3s ease",
                  }}
                >
                  <iframe
                    srcDoc={previewHtml}
                    title={`Anteprima email ${previewMode}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                    }}
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </BlockStack>
          </Card>
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

      {/* Product picker modal */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Inserisci prodotti"
        primaryAction={{
          content: `Inserisci ${selectedProducts.size > 0 ? `(${selectedProducts.size})` : ""}`,
          onAction: handleInsertProducts,
          disabled: selectedProducts.size === 0,
        }}
        secondaryActions={[
          { content: "Annulla", onAction: () => setPickerOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Search and filters */}
            <TextField
              label="Cerca prodotti"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Nome prodotto..."
              autoComplete="off"
              clearButton
              onClearButtonClick={() => handleSearchChange("")}
            />
            <InlineStack gap="300" wrap={false}>
              <Box minWidth="200px">
                <Select
                  label="Collezione"
                  options={collectionOptions}
                  value={selectedCollection}
                  onChange={handleCollectionChange}
                />
              </Box>
              <Box minWidth="200px">
                <Select
                  label="Ordina per"
                  options={sortOptions}
                  value={selectedSort}
                  onChange={handleSortChange}
                />
              </Box>
            </InlineStack>

            {/* Product grid */}
            {productsLoading ? (
              <InlineStack align="center">
                <Spinner size="large" />
              </InlineStack>
            ) : products.length === 0 ? (
              <Banner tone="warning">
                <p>Nessun prodotto trovato. Prova a cambiare i filtri.</p>
              </Banner>
            ) : (
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  {products.length} prodott{products.length === 1 ? "o" : "i"}{" "}
                  trovat{products.length === 1 ? "o" : "i"} — seleziona quelli
                  da inserire
                </Text>
                {products.map((product) => (
                  <div
                    key={product.id}
                    style={{
                      padding: "12px",
                      border: selectedProducts.has(product.id)
                        ? "2px solid #2c6ecb"
                        : "1px solid #e5e7eb",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor: selectedProducts.has(product.id)
                        ? "#f0f5ff"
                        : "transparent",
                    }}
                    onClick={() => handleToggleProduct(product.id)}
                  >
                    <InlineStack gap="300" align="start" blockAlign="center">
                      <Checkbox
                        label=""
                        checked={selectedProducts.has(product.id)}
                        onChange={() => handleToggleProduct(product.id)}
                      />
                      <Thumbnail
                        source={product.imageUrl || ""}
                        alt={product.title}
                        size="medium"
                      />
                      <BlockStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {product.title}
                        </Text>
                        <InlineStack gap="200">
                          <Text as="span" variant="bodyMd" fontWeight="bold">
                            {formatPrice(product.price, product.currency)}
                          </Text>
                          {product.compareAtPrice &&
                            parseFloat(product.compareAtPrice) >
                              parseFloat(product.price) && (
                              <Text
                                as="span"
                                variant="bodySm"
                                tone="subdued"
                                textDecorationLine="line-through"
                              >
                                {formatPrice(
                                  product.compareAtPrice,
                                  product.currency
                                )}
                              </Text>
                            )}
                        </InlineStack>
                      </BlockStack>
                    </InlineStack>
                  </div>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
