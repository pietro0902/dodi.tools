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
import type { CampaignTemplate } from "@/lib/campaign-templates";
import type { CustomTemplate } from "@/lib/custom-templates";
import type { EmailBlock } from "@/lib/email-blocks";
import { templateToBlocks } from "@/lib/email-blocks";
import { BlockEditor } from "@/components/block-editor";
import { ImagePickerModal } from "@/components/image-picker-modal";
import { blocksToHtml } from "@/lib/email-blocks";
import { buildPreviewHtml } from "@/lib/preview-wrapper";
import type { ProductLayout } from "@/lib/product-html";
import type { ShopifyProduct, ShopifyCollection } from "@/types/shopify";

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || "Dodi's";

interface TemplateItem {
  id: string;
  name: string;
  description: string;
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

function formatPrice(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (currency === "EUR") return `\u20AC${num.toFixed(2)}`;
  return `${num.toFixed(2)} ${currency}`;
}

export default function TemplatesPage() {
  const app = useShopifyGlobal();
  const router = useRouter();

  // --- Data ---
  const [defaults, setDefaults] = useState<CampaignTemplate[]>([]);
  const [custom, setCustom] = useState<CustomTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Editor modal ---
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = new
  const [editorName, setEditorName] = useState("");
  const [editorDescription, setEditorDescription] = useState("");
  const [editorSubject, setEditorSubject] = useState("");
  const [editorPreheader, setEditorPreheader] = useState("");
  const [editorBlocks, setEditorBlocks] = useState<EmailBlock[]>([]);
  const [editorBgColor, setEditorBgColor] = useState("#f9fafb");
  const [editorBtnColor, setEditorBtnColor] = useState("#111827");
  const [editorContainerColor, setEditorContainerColor] = useState("#ffffff");
  const [editorTextColor, setEditorTextColor] = useState("#374151");
  const [saving, setSaving] = useState(false);

  // --- Delete confirmation ---
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Product picker (for block editor) ---
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

  const previewInputs = useMemo(
    () => ({ editorBlocks, editorBgColor, editorBtnColor, editorContainerColor, editorTextColor, editorSubject, editorPreheader }),
    [editorBlocks, editorBgColor, editorBtnColor, editorContainerColor, editorTextColor, editorSubject, editorPreheader]
  );

  useEffect(() => {
    if (!editorOpen) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      const bodyHtml = blocksToHtml(previewInputs.editorBlocks, previewInputs.editorBtnColor);
      const html = buildPreviewHtml({
        subject: previewInputs.editorSubject,
        preheader: previewInputs.editorPreheader,
        bodyHtml,
        ctaText: "",
        ctaUrl: "",
        storeName: STORE_NAME,
        bgColor: previewInputs.editorBgColor,
        btnColor: previewInputs.editorBtnColor,
        containerColor: previewInputs.editorContainerColor,
        textColor: previewInputs.editorTextColor,
      });
      setDebouncedPreviewHtml(html);
    }, 300);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [editorOpen, previewInputs]);

  const sortOptions = [
    { label: "Best seller", value: "BEST_SELLING" },
    { label: "Prezzo: basso \u2192 alto", value: "PRICE" },
    { label: "Prezzo: alto \u2192 basso", value: "PRICE_DESC" },
    { label: "Nome A-Z", value: "TITLE" },
    { label: "Pi\u00F9 recenti", value: "CREATED_AT" },
  ];

  // --- Fetch templates ---
  const fetchTemplates = useCallback(async () => {
    if (!app) return;
    setLoading(true);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDefaults(data.defaults || []);
      setCustom(data.custom || []);
    } catch (err) {
      console.error("Templates fetch error:", err);
      if (app) {
        app.toast.show(
          err instanceof Error ? err.message : "Errore nel caricamento template",
          { isError: true }
        );
      }
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // --- Merged list ---
  const allTemplates: TemplateItem[] = useMemo(() => {
    const defaultItems: TemplateItem[] = defaults.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      subject: d.subject,
      preheader: "",
      blocks: d.blocks ? d.blocks.map((b) => ({ ...b })) : templateToBlocks(d),
      bgColor: d.bgColor || "#f9fafb",
      btnColor: d.btnColor || "#111827",
      containerColor: d.containerColor || "#ffffff",
      textColor: d.textColor || "#374151",
      isDefault: true,
    }));
    const customItems: TemplateItem[] = custom.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      subject: c.subject,
      preheader: c.preheader || "",
      blocks: c.blocks || [],
      bgColor: c.bgColor || "#f9fafb",
      btnColor: c.btnColor || "#111827",
      containerColor: c.containerColor || "#ffffff",
      textColor: c.textColor || "#374151",
      isDefault: false,
    }));
    return [...defaultItems, ...customItems];
  }, [defaults, custom]);

  // --- Open editor for new template ---
  const handleNew = useCallback(() => {
    setEditingId(null);
    setEditorName("");
    setEditorDescription("");
    setEditorSubject("");
    setEditorPreheader("");
    setEditorBlocks([]);
    setEditorBgColor("#f9fafb");
    setEditorBtnColor("#111827");
    setEditorContainerColor("#ffffff");
    setEditorTextColor("#374151");
    setEditorOpen(true);
  }, []);

  // --- Open editor for editing custom template ---
  const handleEdit = useCallback(
    (id: string) => {
      const tpl = allTemplates.find((t) => t.id === id);
      if (!tpl || tpl.isDefault) return;
      setEditingId(id);
      setEditorName(tpl.name);
      setEditorDescription(tpl.description);
      setEditorSubject(tpl.subject);
      setEditorPreheader(tpl.preheader);
      setEditorBlocks(tpl.blocks.map((b) => ({ ...b })));
      setEditorBgColor(tpl.bgColor);
      setEditorBtnColor(tpl.btnColor);
      setEditorContainerColor(tpl.containerColor);
      setEditorTextColor(tpl.textColor);
      setEditorOpen(true);
    },
    [allTemplates]
  );

  // --- Duplicate default template as custom ---
  const handleDuplicate = useCallback(
    (id: string) => {
      const tpl = allTemplates.find((t) => t.id === id);
      if (!tpl) return;
      setEditingId(null);
      setEditorName(`${tpl.name} (copia)`);
      setEditorDescription(tpl.description);
      setEditorSubject(tpl.subject);
      setEditorPreheader(tpl.preheader);
      setEditorBlocks(tpl.blocks.map((b) => ({ ...b })));
      setEditorBgColor(tpl.bgColor);
      setEditorBtnColor(tpl.btnColor);
      setEditorContainerColor(tpl.containerColor);
      setEditorTextColor(tpl.textColor);
      setEditorOpen(true);
    },
    [allTemplates]
  );

  // --- Save template (create or update) ---
  const handleSave = useCallback(async () => {
    if (!app) return;
    if (!editorName.trim()) {
      app.toast.show("Inserisci un nome per il template", { isError: true });
      return;
    }
    setSaving(true);
    try {
      const token = await app.idToken();
      const payload = {
        id: editingId,
        name: editorName,
        description: editorDescription,
        subject: editorSubject,
        preheader: editorPreheader,
        blocks: editorBlocks,
        bgColor: editorBgColor,
        btnColor: editorBtnColor,
        containerColor: editorContainerColor,
        textColor: editorTextColor,
      };

      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/templates", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      app.toast.show(editingId ? "Template aggiornato" : "Template creato");
      setEditorOpen(false);
      await fetchTemplates();
    } catch (err) {
      app.toast.show(
        err instanceof Error ? err.message : "Errore nel salvataggio",
        { isError: true }
      );
    } finally {
      setSaving(false);
    }
  }, [app, editingId, editorName, editorDescription, editorSubject, editorPreheader, editorBlocks, editorBgColor, editorBtnColor, editorContainerColor, editorTextColor, fetchTemplates]);

  // --- Delete custom template ---
  const handleDelete = useCallback(async () => {
    if (!app || !deleteConfirmId) return;
    setDeleting(true);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/templates", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: deleteConfirmId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      app.toast.show("Template eliminato");
      setDeleteConfirmId(null);
      await fetchTemplates();
    } catch (err) {
      app.toast.show(
        err instanceof Error ? err.message : "Errore nell'eliminazione",
        { isError: true }
      );
    } finally {
      setDeleting(false);
    }
  }, [app, deleteConfirmId, fetchTemplates]);

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
      } catch (err) {
        console.error("Product fetch error:", err);
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
      const block = editorBlocks.find((b) => b.id === blockId);
      if (block?.type === "products") {
        setProductLayout(block.layout);
      } else {
        setProductLayout("grid");
      }
      fetchCollections();
      fetchProducts(undefined, undefined, "BEST_SELLING");
    },
    [editorBlocks, fetchCollections, fetchProducts]
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

    setEditorBlocks((prev) =>
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

  const handleOpenImageUploader = useCallback((blockId: string) => {
    setActiveImageBlockId(blockId);
    setImageModalOpen(true);
  }, []);

  const handleImagePickerConfirm = useCallback((url: string, alt: string) => {
    if (!activeImageBlockId || !url) return;
    setEditorBlocks((prev) =>
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

  return (
    <Page
      title="Template Email"
      backAction={{ onAction: () => router.push("/") }}
      primaryAction={{
        content: "Nuovo template",
        onAction: handleNew,
      }}
    >
      <Layout>
        {loading ? (
          <Layout.Section>
            <Card>
              <InlineStack align="center">
                <Spinner size="large" />
              </InlineStack>
            </Card>
          </Layout.Section>
        ) : allTemplates.length === 0 ? (
          <Layout.Section>
            <Banner tone="info">
              <p>Nessun template trovato. Crea il tuo primo template.</p>
            </Banner>
          </Layout.Section>
        ) : (
          <Layout.Section>
            <BlockStack gap="400">
              {allTemplates.map((tpl) => (
                <Card key={tpl.id}>
                  <InlineStack align="space-between" blockAlign="start" wrap>
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h3" variant="headingSm">
                          {tpl.name}
                        </Text>
                        <Badge tone={tpl.isDefault ? "info" : "success"}>
                          {tpl.isDefault ? "Default" : "Custom"}
                        </Badge>
                      </InlineStack>
                      {tpl.description && (
                        <Text as="p" variant="bodySm" tone="subdued">
                          {tpl.description}
                        </Text>
                      )}
                      {tpl.subject && (
                        <Text as="p" variant="bodySm">
                          {`Oggetto: ${tpl.subject}`}
                        </Text>
                      )}
                    </BlockStack>
                    <InlineStack gap="200">
                      {tpl.isDefault ? (
                        <Button size="slim" onClick={() => handleDuplicate(tpl.id)}>
                          Duplica
                        </Button>
                      ) : (
                        <>
                          <Button size="slim" onClick={() => handleEdit(tpl.id)}>
                            Modifica
                          </Button>
                          <Button
                            size="slim"
                            tone="critical"
                            onClick={() => setDeleteConfirmId(tpl.id)}
                          >
                            Elimina
                          </Button>
                        </>
                      )}
                    </InlineStack>
                  </InlineStack>
                </Card>
              ))}
            </BlockStack>
          </Layout.Section>
        )}
      </Layout>

      {/* Template editor modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? "Modifica template" : "Nuovo template"}
        primaryAction={{
          content: "Salva",
          onAction: handleSave,
          loading: saving,
        }}
        secondaryActions={[
          { content: "Annulla", onAction: () => setEditorOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Nome template"
              value={editorName}
              onChange={setEditorName}
              placeholder="Es: Promo Black Friday"
              autoComplete="off"
            />
            <TextField
              label="Descrizione"
              value={editorDescription}
              onChange={setEditorDescription}
              placeholder="Breve descrizione del template"
              autoComplete="off"
            />
            <TextField
              label="Oggetto email"
              value={editorSubject}
              onChange={setEditorSubject}
              placeholder="Es: Offerta speciale per te!"
              autoComplete="off"
            />
            <TextField
              label="Preheader"
              value={editorPreheader}
              onChange={setEditorPreheader}
              placeholder="Testo di anteprima visibile nell'inbox"
              autoComplete="off"
              helpText="Appare dopo l'oggetto nella lista email del destinatario."
            />

            <Text as="h3" variant="headingSm">
              Blocchi contenuto
            </Text>
            <BlockEditor
              blocks={editorBlocks}
              onChange={setEditorBlocks}
              onOpenProductPicker={handleOpenProductPicker}
              onOpenImageUploader={handleOpenImageUploader}
            />

            {/* Colors */}
            <Text as="h3" variant="headingSm">
              Colori email
            </Text>
            <InlineStack gap="300" wrap>
              <Box minWidth="160px">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm">Sfondo email</Text>
                  <InlineStack gap="200" blockAlign="center">
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "4px",
                        backgroundColor: editorBgColor,
                        border: "1px solid #d1d5db",
                        cursor: "pointer",
                        flexShrink: 0,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <input
                        type="color"
                        value={editorBgColor}
                        onChange={(e) => setEditorBgColor(e.target.value)}
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
                    <TextField
                      label=""
                      labelHidden
                      value={editorBgColor}
                      onChange={setEditorBgColor}
                      autoComplete="off"
                      monospaced
                    />
                  </InlineStack>
                </BlockStack>
              </Box>
              <Box minWidth="160px">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm">Sfondo contenuto</Text>
                  <InlineStack gap="200" blockAlign="center">
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "4px",
                        backgroundColor: editorContainerColor,
                        border: "1px solid #d1d5db",
                        cursor: "pointer",
                        flexShrink: 0,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <input
                        type="color"
                        value={editorContainerColor}
                        onChange={(e) => setEditorContainerColor(e.target.value)}
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
                    <TextField
                      label=""
                      labelHidden
                      value={editorContainerColor}
                      onChange={setEditorContainerColor}
                      autoComplete="off"
                      monospaced
                    />
                  </InlineStack>
                </BlockStack>
              </Box>
              <Box minWidth="160px">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm">Bottone</Text>
                  <InlineStack gap="200" blockAlign="center">
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "4px",
                        backgroundColor: editorBtnColor,
                        border: "1px solid #d1d5db",
                        cursor: "pointer",
                        flexShrink: 0,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <input
                        type="color"
                        value={editorBtnColor}
                        onChange={(e) => setEditorBtnColor(e.target.value)}
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
                    <TextField
                      label=""
                      labelHidden
                      value={editorBtnColor}
                      onChange={setEditorBtnColor}
                      autoComplete="off"
                      monospaced
                    />
                  </InlineStack>
                </BlockStack>
              </Box>
              <Box minWidth="160px">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm">Testo</Text>
                  <InlineStack gap="200" blockAlign="center">
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "4px",
                        backgroundColor: editorTextColor,
                        border: "1px solid #d1d5db",
                        cursor: "pointer",
                        flexShrink: 0,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <input
                        type="color"
                        value={editorTextColor}
                        onChange={(e) => setEditorTextColor(e.target.value)}
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
                    <TextField
                      label=""
                      labelHidden
                      value={editorTextColor}
                      onChange={setEditorTextColor}
                      autoComplete="off"
                      monospaced
                    />
                  </InlineStack>
                </BlockStack>
              </Box>
            </InlineStack>

            {/* Preview */}
            <Text as="h3" variant="headingSm">
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
            {debouncedPreviewHtml ? (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  overflow: "hidden",
                  maxWidth: previewMode === "mobile" ? "375px" : "600px",
                  margin: "0 auto",
                  height: "500px",
                  transition: "max-width 0.3s ease",
                }}
              >
                <iframe
                  srcDoc={debouncedPreviewHtml}
                  title="Anteprima template"
                  style={{ width: "100%", height: "100%", border: "none" }}
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <Banner tone="info">
                <p>Aggiungi dei blocchi per vedere l&apos;anteprima.</p>
              </Banner>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Elimina template"
        primaryAction={{
          content: "Elimina",
          onAction: handleDelete,
          destructive: true,
          loading: deleting,
        }}
        secondaryActions={[
          { content: "Annulla", onAction: () => setDeleteConfirmId(null) },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            {`Vuoi eliminare il template "${allTemplates.find((t) => t.id === deleteConfirmId)?.name || ""}"? Questa azione non pu\u00F2 essere annullata.`}
          </Text>
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
