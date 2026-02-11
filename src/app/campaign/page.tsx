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
  DropZone,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
import {
  CAMPAIGN_TEMPLATES,
  type CampaignTemplate,
} from "@/lib/campaign-templates";
import { buildPreviewHtml } from "@/lib/preview-wrapper";
import { buildProductGridHtml, type ProductLayout } from "@/lib/product-html";
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

  // --- Logo size ---
  const [logoWidth, setLogoWidth] = useState(120);
  const [logoWidthInput, setLogoWidthInput] = useState("120");

  // --- Preview ---
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewScale, setPreviewScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Image inserter ---
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

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
  const [productLayout, setProductLayout] = useState<ProductLayout>("grid");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTemplate = useMemo(
    () => CAMPAIGN_TEMPLATES.find((t) => t.id === selectedTemplateId)!,
    [selectedTemplateId]
  );

  // --- Preview scale for desktop mode ---
  useEffect(() => {
    function updateScale() {
      if (previewMode === "desktop" && previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.offsetWidth;
        const desktopWidth = 800;
        setPreviewScale(Math.min(1, containerWidth / desktopWidth));
      } else {
        setPreviewScale(1);
      }
    }
    // Delay measurement to ensure DOM has updated after mode switch
    requestAnimationFrame(() => requestAnimationFrame(updateScale));
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [previewMode]);

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
          logoWidth,
        })
      );
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.subject, form.bodyHtml, form.ctaText, form.ctaUrl, logoWidth]);

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
          logoWidth,
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
  }, [form, app, applyTemplate, logoWidth]);

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
    setProductLayout("grid");
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

  // --- Insert image into body ---
  const handleInsertImage = useCallback(() => {
    if (!imageUrl) return;
    const alt = imageAlt || "Immagine";
    const imgHtml = `\n<img src="${imageUrl}" alt="${alt}" style="display:block;max-width:100%;height:auto;margin:16px auto;border-radius:8px" />\n`;
    setForm((prev) => ({
      ...prev,
      bodyHtml: prev.bodyHtml + imgHtml,
    }));
    setImageModalOpen(false);
    setImageUrl("");
    setImageAlt("");
    if (app) app.toast.show("Immagine inserita");
  }, [imageUrl, imageAlt, app]);

  // --- Upload image file to Shopify CDN ---
  const handleImageDrop = useCallback(
    async (_dropFiles: File[], acceptedFiles: File[]) => {
      if (!app || acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      setImageUploading(true);
      try {
        const token = await app.idToken();
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/files/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setImageUrl(data.url);
        app.toast.show("Immagine caricata");
      } catch (err) {
        app.toast.show(
          err instanceof Error ? err.message : "Errore nel caricamento",
          { isError: true }
        );
      } finally {
        setImageUploading(false);
      }
    },
    [app]
  );

  // --- Insert selected products into body ---
  const handleInsertProducts = useCallback(() => {
    const selected = products.filter((p) => selectedProducts.has(p.id));
    if (selected.length === 0) return;

    const html = buildProductGridHtml(selected, productLayout);
    setForm((prev) => {
      // Remove any existing product blocks before inserting new ones
      const cleaned = prev.bodyHtml
        .replace(/\n?<!-- Prodotti(?:\s*\(scorrimento\))? -->[\s\S]*?<\/div>\n?/g, "")
        .trimEnd();
      return {
        ...prev,
        bodyHtml: cleaned + html,
      };
    });
    setPickerOpen(false);
    setSelectedProducts(new Set());
    if (app) {
      app.toast.show(
        `${selected.length} prodott${selected.length === 1 ? "o inserito" : "i inseriti"}`
      );
    }
  }, [products, selectedProducts, productLayout, app]);

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
            <BlockStack gap="300">
              <Select
                label="Template"
                options={templateOptions}
                value={selectedTemplateId}
                onChange={handleTemplateChange}
              />
              <Text as="p" variant="bodySm" tone="subdued">
                {selectedDescription}
              </Text>
              <TextField
                label="Larghezza logo (px)"
                type="number"
                value={logoWidthInput}
                onChange={(v) => {
                  setLogoWidthInput(v);
                  const n = parseInt(v, 10);
                  if (!isNaN(n) && n > 0) setLogoWidth(n);
                }}
                onBlur={() => {
                  const clamped = Math.max(40, Math.min(400, logoWidth));
                  setLogoWidth(clamped);
                  setLogoWidthInput(String(clamped));
                }}
                min={40}
                max={400}
                suffix="px"
                autoComplete="off"
                helpText="Min 40px, max 400px"
              />
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
                <Button
                  onClick={() => setImageModalOpen(true)}
                  variant="secondary"
                >
                  Inserisci immagine
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
              {/* Hidden div to measure available width */}
              <div ref={previewContainerRef} style={{ width: "100%", height: 0, overflow: "hidden" }} />
              {!form.subject && !form.bodyHtml ? (
                <Banner tone="info">
                  <p>
                    Compila i campi sopra per visualizzare l&apos;anteprima
                    dell&apos;email.
                  </p>
                </Banner>
              ) : previewMode === "desktop" ? (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    overflow: "hidden",
                    width: `${800 * previewScale}px`,
                    height: `${700 * previewScale}px`,
                    margin: "0 auto",
                  }}
                >
                  <iframe
                    srcDoc={previewHtml}
                    title="Anteprima email desktop"
                    style={{
                      width: "800px",
                      height: "700px",
                      border: "none",
                      transform: `scale(${previewScale})`,
                      transformOrigin: "top left",
                    }}
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    overflow: "hidden",
                    maxWidth: "375px",
                    height: "667px",
                    margin: "0 auto",
                  }}
                >
                  <iframe
                    srcDoc={previewHtml}
                    title="Anteprima email mobile"
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
            <InlineStack gap="300" wrap>
              <Box minWidth="180px">
                <Select
                  label="Collezione"
                  options={collectionOptions}
                  value={selectedCollection}
                  onChange={handleCollectionChange}
                />
              </Box>
              <Box minWidth="180px">
                <Select
                  label="Ordina per"
                  options={sortOptions}
                  value={selectedSort}
                  onChange={handleSortChange}
                />
              </Box>
              <Box minWidth="180px">
                <Select
                  label="Layout"
                  options={[
                    { label: "Griglia", value: "grid" },
                    { label: "Scorrimento", value: "scroll" },
                  ]}
                  value={productLayout}
                  onChange={(v) => setProductLayout(v as ProductLayout)}
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

      {/* Image inserter modal */}
      <Modal
        open={imageModalOpen}
        onClose={() => {
          setImageModalOpen(false);
          setImageUrl("");
          setImageAlt("");
        }}
        title="Inserisci immagine"
        primaryAction={{
          content: "Inserisci nell'email",
          onAction: handleInsertImage,
          disabled: !imageUrl || imageUploading,
        }}
        secondaryActions={[
          {
            content: "Annulla",
            onAction: () => {
              setImageModalOpen(false);
              setImageUrl("");
              setImageAlt("");
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Drop zone / click to browse */}
            {imageUploading ? (
              <Box padding="800">
                <BlockStack gap="300" align="center">
                  <InlineStack align="center">
                    <Spinner size="large" />
                  </InlineStack>
                  <Text as="p" alignment="center" tone="subdued">
                    Caricamento in corso...
                  </Text>
                </BlockStack>
              </Box>
            ) : (
              <DropZone
                accept="image/jpeg, image/png, image/gif, image/webp"
                type="image"
                allowMultiple={false}
                onDrop={handleImageDrop}
              >
                <DropZone.FileUpload
                  actionTitle="Carica immagine"
                  actionHint="o trascina qui un file JPG, PNG, GIF, WebP"
                />
              </DropZone>
            )}

            {/* Separator */}
            <InlineStack align="center">
              <Text as="p" variant="bodySm" tone="subdued">
                oppure inserisci un URL diretto
              </Text>
            </InlineStack>

            {/* Manual URL fallback */}
            <TextField
              label="URL immagine"
              value={imageUrl}
              onChange={setImageUrl}
              placeholder="https://cdn.shopify.com/..."
              autoComplete="off"
            />
            <TextField
              label="Testo alternativo"
              value={imageAlt}
              onChange={setImageAlt}
              placeholder="Descrizione immagine"
              autoComplete="off"
              helpText="Opzionale. Viene mostrato se l'immagine non si carica."
            />

            {/* Preview */}
            {imageUrl && (
              <Box>
                <Text as="p" variant="bodySm" tone="subdued">
                  Anteprima:
                </Text>
                <div
                  style={{
                    marginTop: "8px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "8px",
                    textAlign: "center",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={imageAlt || "Anteprima"}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      borderRadius: "6px",
                    }}
                  />
                </div>
              </Box>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
