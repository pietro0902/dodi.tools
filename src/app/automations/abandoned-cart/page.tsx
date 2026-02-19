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
  Modal,
  Box,
  Banner,
  Spinner,
  Badge,
  Select,
  Checkbox,
  Thumbnail,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
import type { AutomationSettings } from "@/lib/automation-settings";
import type { EmailBlock } from "@/lib/email-blocks";
import type { CampaignTemplate } from "@/lib/campaign-templates";
import type { CustomTemplate } from "@/lib/custom-templates";
import type { ProductLayout } from "@/lib/product-html";
import type { ShopifyProduct, ShopifyCollection } from "@/types/shopify";
import { blocksToHtml, templateToBlocks } from "@/lib/email-blocks";
import { buildCartItemsHtml } from "@/lib/cart-html";
import { buildPreviewHtml } from "@/lib/preview-wrapper";
import { BlockEditor } from "@/components/block-editor";
import { ImagePickerModal } from "@/components/image-picker-modal";

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || "Dodi's";

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

function formatPrice(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (currency === "EUR") return `\u20AC${num.toFixed(2)}`;
  return `${num.toFixed(2)} ${currency}`;
}

export default function AbandonedCartAutomationPage() {
  const app = useShopifyGlobal();
  const router = useRouter();

  // --- Settings state ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);

  // --- Editor fields ---
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [bgColor, setBgColor] = useState("#f9fafb");
  const [btnColor, setBtnColor] = useState("#111827");
  const [containerColor, setContainerColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#374151");
  const [delayHours, setDelayHours] = useState(4);
  const [maxAgeHours, setMaxAgeHours] = useState(48);

  // --- Import from template ---
  const [importOpen, setImportOpen] = useState(false);
  const [allTemplates, setAllTemplates] = useState<TemplateOption[]>([]);

  // --- Product picker ---
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeProductBlockId, setActiveProductBlockId] = useState<string | null>(null);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [selectedSort, setSelectedSort] = useState("BEST_SELLING");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [productLayout, setProductLayout] = useState<ProductLayout>("grid");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Image picker ---
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [activeImageBlockId, setActiveImageBlockId] = useState<string | null>(null);

  // --- Preview ---
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [debouncedPreviewHtml, setDebouncedPreviewHtml] = useState("");
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Fetch data ---
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
      const settingsData: AutomationSettings = await settingsRes.json();
      setSettings(settingsData);

      // Populate editor fields
      setSubject(settingsData.abandonedCart.subject);
      setPreheader(settingsData.abandonedCart.preheader || "");
      setBlocks(settingsData.abandonedCart.blocks || []);
      setBgColor(settingsData.abandonedCart.bgColor || "#f9fafb");
      setBtnColor(settingsData.abandonedCart.btnColor || "#111827");
      setContainerColor(settingsData.abandonedCart.containerColor || "#ffffff");
      setTextColor(settingsData.abandonedCart.textColor || "#374151");
      setDelayHours(settingsData.abandonedCart.delayHours);
      setMaxAgeHours(settingsData.abandonedCart.maxAgeHours);

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

  // --- Preview ---
  const previewInputs = useMemo(
    () => ({ blocks, bgColor, btnColor, containerColor, textColor, subject, preheader }),
    [blocks, bgColor, btnColor, containerColor, textColor, subject, preheader]
  );

  useEffect(() => {
    if (loading) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      let bodyHtml = blocksToHtml(previewInputs.blocks, previewInputs.btnColor, false);
      const cartBlock = previewInputs.blocks.find((b) => b.type === "cart_items");
      const cartColors = cartBlock?.type === "cart_items" ? {
        textColor: cartBlock.textColor,
        btnColor: cartBlock.btnColor,
        btnTextColor: cartBlock.btnTextColor,
      } : {};
      const sampleCartHtml = buildCartItemsHtml(
        [{ title: "Prodotto esempio", quantity: 1, price: "29.99", variantTitle: "Taglia M", imageUrl: "https://placehold.co/56x56/e5e7eb/9ca3af?text=IMG" }],
        "29.99",
        "EUR",
        "#",
        cartColors
      );
      if (bodyHtml.includes("__CART_ITEMS__")) {
        bodyHtml = bodyHtml.replace("__CART_ITEMS__", sampleCartHtml);
      } else {
        bodyHtml += sampleCartHtml;
      }
      const html = buildPreviewHtml({
        subject: previewInputs.subject,
        preheader: previewInputs.preheader,
        bodyHtml: bodyHtml || previewInputs.subject,
        ctaText: "",
        ctaUrl: "",
        storeName: STORE_NAME,
        bgColor: previewInputs.bgColor,
        btnColor: previewInputs.btnColor,
        containerColor: previewInputs.containerColor,
        textColor: previewInputs.textColor,
      });
      setDebouncedPreviewHtml(html);
    }, 300);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [loading, previewInputs]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    if (!app || !settings) return;
    setSaving(true);
    try {
      const token = await app.idToken();
      const updated: AutomationSettings = {
        ...settings,
        abandonedCart: {
          ...settings.abandonedCart,
          subject,
          preheader,
          blocks,
          bgColor,
          btnColor,
          containerColor,
          textColor,
          delayHours,
          maxAgeHours,
        },
      };
      const res = await fetch("/api/automations/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updated),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSettings(updated);
      app.toast.show("Carrello abbandonato salvato");
    } catch (err) {
      app.toast.show(
        err instanceof Error ? err.message : "Errore nel salvataggio",
        { isError: true }
      );
    } finally {
      setSaving(false);
    }
  }, [app, settings, subject, preheader, blocks, bgColor, btnColor, containerColor, textColor, delayHours, maxAgeHours]);

  // --- Import from template ---
  const handleImportTemplate = useCallback(
    (tpl: TemplateOption) => {
      setSubject(tpl.subject);
      setPreheader(tpl.preheader);
      setBlocks(tpl.blocks.map((b) => ({ ...b })));
      setBgColor(tpl.bgColor);
      setBtnColor(tpl.btnColor);
      setContainerColor(tpl.containerColor);
      setTextColor(tpl.textColor);
      setImportOpen(false);
      if (app) app.toast.show(`Template "${tpl.name}" importato`);
    },
    [app]
  );

  // --- Product picker ---
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
      } catch {
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    },
    [app]
  );

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

  const handleOpenProductPicker = useCallback(
    (blockId: string) => {
      setActiveProductBlockId(blockId);
      setPickerOpen(true);
      setSelectedProducts(new Set());
      setSearchQuery("");
      setSelectedCollection("");
      setSelectedSort("BEST_SELLING");
      const block = blocks.find((b) => b.id === blockId);
      if (block?.type === "products") setProductLayout(block.layout);
      else setProductLayout("grid");
      fetchCollections();
      fetchProducts(undefined, undefined, "BEST_SELLING");
    },
    [blocks, fetchCollections, fetchProducts]
  );

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

  const handleCollectionChange = useCallback(
    (value: string) => {
      setSelectedCollection(value);
      fetchProducts(searchQuery, value, selectedSort);
    },
    [fetchProducts, searchQuery, selectedSort]
  );

  const handleSortChange = useCallback(
    (value: string) => {
      setSelectedSort(value);
      fetchProducts(searchQuery, selectedCollection, value);
    },
    [fetchProducts, searchQuery, selectedCollection]
  );

  const handleToggleProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const handleInsertProducts = useCallback(() => {
    if (!activeProductBlockId) return;
    const selected = products.filter((p) => selectedProducts.has(p.id));
    if (selected.length === 0) return;
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === activeProductBlockId && b.type === "products"
          ? { ...b, products: selected, layout: productLayout }
          : b
      )
    );
    setPickerOpen(false);
    setSelectedProducts(new Set());
    setActiveProductBlockId(null);
    if (app) {
      app.toast.show(
        `${selected.length} prodott${selected.length === 1 ? "o selezionato" : "i selezionati"}`
      );
    }
  }, [activeProductBlockId, products, selectedProducts, productLayout, app]);

  const collectionOptions = useMemo(
    () => [
      { label: "Tutte le collezioni", value: "" },
      ...collections.map((c) => ({ label: c.title, value: c.id })),
    ],
    [collections]
  );

  const sortOptions = [
    { label: "Best seller", value: "BEST_SELLING" },
    { label: "Prezzo: basso \u2192 alto", value: "PRICE" },
    { label: "Prezzo: alto \u2192 basso", value: "PRICE_DESC" },
    { label: "Nome A-Z", value: "TITLE" },
    { label: "Pi\u00F9 recenti", value: "CREATED_AT" },
  ];

  // --- Image picker ---
  const handleOpenImageUploader = useCallback((blockId: string) => {
    setActiveImageBlockId(blockId);
    setImageModalOpen(true);
  }, []);

  const handleImagePickerConfirm = useCallback((url: string, alt: string) => {
    if (!activeImageBlockId || !url) return;
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== activeImageBlockId) return b;
        if (b.type === "image") return { ...b, src: url, alt };
        if (b.type === "logo") return { ...b, src: url, alt };
        return b;
      })
    );
    setImageModalOpen(false);
    setActiveImageBlockId(null);
    if (app) app.toast.show("Immagine inserita");
  }, [activeImageBlockId, app]);

  const handleImagePickerClose = useCallback(() => {
    setImageModalOpen(false);
    setActiveImageBlockId(null);
  }, []);

  const getAppToken = useCallback(async () => {
    if (!app) throw new Error("App not ready");
    return app.idToken();
  }, [app]);

  // --- Render ---
  if (loading) {
    return (
      <Page title="Carrello Abbandonato" backAction={{ onAction: () => router.push("/automations") }}>
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
      <Page title="Carrello Abbandonato" backAction={{ onAction: () => router.push("/automations") }}>
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
      title="Carrello Abbandonato"
      backAction={{ onAction: () => router.push("/automations") }}
      primaryAction={{
        content: "Salva",
        onAction: handleSave,
        loading: saving,
      }}
    >
      <Layout>
        {/* Subject + Preheader */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <TextField
                label="Oggetto"
                value={subject}
                onChange={setSubject}
                autoComplete="off"
                helpText="Usa {{name}} per il nome del cliente."
              />
              <TextField
                label="Preheader"
                value={preheader}
                onChange={setPreheader}
                autoComplete="off"
                helpText="Testo di anteprima visibile nell'inbox."
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Delay / Max age */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Tempistiche
              </Text>
              <InlineStack gap="400">
                <div style={{ width: "200px" }}>
                  <TextField
                    label="Ritardo (ore)"
                    type="number"
                    value={String(delayHours)}
                    onChange={(v) => {
                      const n = parseInt(v, 10);
                      if (!isNaN(n) && n >= 1) setDelayHours(n);
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
                    label="Et\u00E0 massima (ore)"
                    type="number"
                    value={String(maxAgeHours)}
                    onChange={(v) => {
                      const n = parseInt(v, 10);
                      if (!isNaN(n) && n >= 1) setMaxAgeHours(n);
                    }}
                    min={1}
                    max={168}
                    suffix="h"
                    autoComplete="off"
                    helpText="Non inviare per carrelli pi\u00F9 vecchi di"
                  />
                </div>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Block Editor */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Contenuto
                </Text>
                {allTemplates.length > 0 && (
                  <Button size="slim" onClick={() => setImportOpen(true)}>
                    Importa da template
                  </Button>
                )}
              </InlineStack>
              <BlockEditor
                blocks={blocks}
                onChange={setBlocks}
                onOpenProductPicker={handleOpenProductPicker}
                onOpenImageUploader={handleOpenImageUploader}
                showCartItemsBlock={true}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Colors */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Colori
              </Text>
              <InlineStack gap="300" wrap>
                <ColorPicker label="Sfondo" value={bgColor} onChange={setBgColor} />
                <ColorPicker label="Contenuto" value={containerColor} onChange={setContainerColor} />
                <ColorPicker label="Bottone" value={btnColor} onChange={setBtnColor} />
                <ColorPicker label="Testo" value={textColor} onChange={setTextColor} />
              </InlineStack>
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
                    size="slim"
                    variant={previewMode === "desktop" ? "primary" : "secondary"}
                    onClick={() => setPreviewMode("desktop")}
                  >
                    Desktop
                  </Button>
                  <Button
                    size="slim"
                    variant={previewMode === "mobile" ? "primary" : "secondary"}
                    onClick={() => setPreviewMode("mobile")}
                  >
                    Mobile
                  </Button>
                </InlineStack>
              </InlineStack>
              {debouncedPreviewHtml ? (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    overflow: "hidden",
                    display: "flex",
                    justifyContent: "center",
                    height: "600px",
                    backgroundColor: "#f9fafb",
                  }}
                >
                  <iframe
                    srcDoc={debouncedPreviewHtml}
                    title="Anteprima carrello abbandonato"
                    style={{ width: previewMode === "desktop" ? "600px" : "375px", height: "100%", border: "none", flexShrink: 0 }}
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <Banner tone="info">
                  <p>Aggiungi dei blocchi per vedere l&apos;anteprima.</p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Import from template modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importa da template"
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodySm" tone="subdued">
              Seleziona un template per copiarne blocchi, colori, oggetto e preheader.
            </Text>
            {allTemplates.map((tpl) => (
              <div
                key={tpl.id}
                style={{
                  padding: "12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
                onClick={() => handleImportTemplate(tpl)}
              >
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {tpl.name}
                    </Text>
                    {tpl.subject && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {tpl.subject}
                      </Text>
                    )}
                  </BlockStack>
                  <Button size="slim" variant="plain">
                    Importa
                  </Button>
                </InlineStack>
              </div>
            ))}
            {allTemplates.length === 0 && (
              <Banner tone="info">
                <p>Nessun template disponibile. Crea un template prima.</p>
              </Banner>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Product picker modal */}
      <Modal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setActiveProductBlockId(null); }}
        title="Scegli prodotti"
        primaryAction={{
          content: `Inserisci ${selectedProducts.size > 0 ? `(${selectedProducts.size})` : ""}`,
          onAction: handleInsertProducts,
          disabled: selectedProducts.size === 0,
        }}
        secondaryActions={[
          { content: "Annulla", onAction: () => { setPickerOpen(false); setActiveProductBlockId(null); } },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
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
                  trovat{products.length === 1 ? "o" : "i"}
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
                                {formatPrice(product.compareAtPrice, product.currency)}
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

      {/* Image picker modal */}
      <ImagePickerModal
        open={imageModalOpen}
        onClose={handleImagePickerClose}
        onConfirm={handleImagePickerConfirm}
        getToken={getAppToken}
      />
    </Page>
  );
}
