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
  RadioButton,
  Badge,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
import {
  CAMPAIGN_TEMPLATES,
  type CampaignTemplate,
} from "@/lib/campaign-templates";
import { buildPreviewHtml } from "@/lib/preview-wrapper";
import { buildProductGridHtml, type ProductLayout } from "@/lib/product-html";
import type { ShopifyProduct, ShopifyCollection } from "@/types/shopify";

interface CustomerListItem {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
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

function formatScheduleDate(date: string, time: string): string {
  if (!date || !time) return "";
  const d = new Date(`${date}T${time}`);
  return d.toLocaleString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isScheduleDatePast(date: string, time: string): boolean {
  if (!date || !time) return false;
  return new Date(`${date}T${time}`).getTime() <= Date.now();
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

  // --- Step flow ---
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recipientMode, setRecipientMode] = useState<"all" | "manual">("all");
  const [customerList, setCustomerList] = useState<CustomerListItem[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(new Set());
  const [customerSearch, setCustomerSearch] = useState("");
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);

  // --- Step 3: scheduling ---
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // --- Logo size ---
  const [logoWidth, setLogoWidth] = useState(120);
  const [logoWidthInput, setLogoWidthInput] = useState("120");

  // --- Email colors ---
  const [bgColor, setBgColor] = useState("#f9fafb");
  const [btnColor, setBtnColor] = useState("#111827");
  const [containerColor, setContainerColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#374151");

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
          bgColor,
          btnColor,
          containerColor,
          textColor,
        })
      );
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.subject, form.bodyHtml, form.ctaText, form.ctaUrl, logoWidth, bgColor, btnColor, containerColor, textColor]);

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

  // --- Step 2: fetch customers ---
  const fetchCustomers = useCallback(async () => {
    if (!app) return;
    setCustomersLoading(true);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/customers/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCustomerList(data.customers || []);
    } catch (err) {
      console.error("Customer fetch error:", err);
      if (app) {
        app.toast.show(
          err instanceof Error ? err.message : "Errore nel caricamento clienti",
          { isError: true }
        );
      }
    } finally {
      setCustomersLoading(false);
    }
  }, [app]);

  const handleGoToStep2 = useCallback(() => {
    if (!form.subject || !form.bodyHtml) {
      if (app) app.toast.show("Compila almeno oggetto e corpo HTML", { isError: true });
      return;
    }
    setStep(2);
    fetchCustomers();
  }, [form.subject, form.bodyHtml, app, fetchCustomers]);

  const handleBackToStep1 = useCallback(() => {
    setStep(1);
  }, []);

  const handleGoToStep3 = useCallback(() => {
    if (recipientMode === "manual" && selectedCustomerIds.size === 0) return;
    // Default schedule: tomorrow, same time rounded to 15 min
    if (!scheduleDate || !scheduleTime) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const dd = String(tomorrow.getDate()).padStart(2, "0");
      setScheduleDate(`${yyyy}-${mm}-${dd}`);
      const now = new Date();
      const minutes = Math.ceil(now.getMinutes() / 15) * 15;
      now.setMinutes(minutes, 0, 0);
      const hh = String(now.getHours()).padStart(2, "0");
      const mi = String(now.getMinutes()).padStart(2, "0");
      setScheduleTime(`${hh}:${mi}`);
    }
    setStep(3);
  }, [recipientMode, selectedCustomerIds.size, scheduleDate, scheduleTime]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customerList;
    const q = customerSearch.toLowerCase();
    return customerList.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.first_name && c.first_name.toLowerCase().includes(q)) ||
        (c.last_name && c.last_name.toLowerCase().includes(q))
    );
  }, [customerList, customerSearch]);

  const handleToggleCustomer = useCallback((id: number) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const recipientCount =
    recipientMode === "all" ? customerList.length : selectedCustomerIds.size;

  // --- Send or schedule campaign ---
  const handleSend = useCallback(async () => {
    if (!app) return;
    if (!form.subject || !form.bodyHtml) {
      app.toast.show("Compila almeno oggetto e corpo HTML", { isError: true });
      return;
    }

    setSendConfirmOpen(false);

    if (sendMode === "schedule") {
      // Schedule campaign
      setScheduling(true);
      try {
        const token = await app.idToken();
        const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

        const payload = {
          subject: form.subject,
          bodyHtml: form.bodyHtml,
          ctaText: form.ctaText,
          ctaUrl: form.ctaUrl,
          logoWidth,
          recipientMode,
          customerIds: recipientMode === "manual" ? Array.from(selectedCustomerIds) : undefined,
          scheduledAt,
          recipientCount,
          bgColor,
          btnColor,
          containerColor,
          textColor,
        };

        const res = await fetch("/api/campaigns/scheduled", {
          method: "POST",
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

        app.toast.show(`Campagna schedulata per ${formatScheduleDate(scheduleDate, scheduleTime)}`);
        applyTemplate("blank");
        setStep(1);
        setRecipientMode("all");
        setSelectedCustomerIds(new Set());
        setSendMode("now");
        setScheduleDate("");
        setScheduleTime("");
      } catch (err) {
        app.toast.show(
          err instanceof Error ? err.message : "Errore nella schedulazione",
          { isError: true }
        );
      } finally {
        setScheduling(false);
      }
      return;
    }

    // Send now
    setSending(true);
    try {
      const token = await app.idToken();

      const payload: Record<string, unknown> = {
        subject: form.subject,
        html: form.bodyHtml,
        ctaText: form.ctaText,
        ctaUrl: form.ctaUrl,
        logoWidth,
        bgColor,
        btnColor,
        containerColor,
        textColor,
      };

      if (recipientMode === "manual" && selectedCustomerIds.size > 0) {
        payload.customerIds = Array.from(selectedCustomerIds);
      }

      const res = await fetch("/api/campaigns/send", {
        method: "POST",
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

      const data = await res.json();
      app.toast.show(`Campagna inviata a ${data.sentTo ?? "?"} iscritti`);
      applyTemplate("blank");
      setStep(1);
      setRecipientMode("all");
      setSelectedCustomerIds(new Set());
      setSendMode("now");
    } catch (err) {
      app.toast.show(
        err instanceof Error ? err.message : "Errore nell'invio",
        { isError: true }
      );
    } finally {
      setSending(false);
    }
  }, [form, app, applyTemplate, logoWidth, recipientMode, selectedCustomerIds, sendMode, scheduleDate, scheduleTime, recipientCount, bgColor, btnColor, containerColor, textColor]);

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

    const html = buildProductGridHtml(selected, productLayout, btnColor);
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
  }, [products, selectedProducts, productLayout, app, btnColor]);

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
      backAction={{ onAction: () => step === 3 ? setStep(2) : step === 2 ? handleBackToStep1() : router.push("/") }}
    >
      {/* Step indicator */}
      <Layout>
        <Layout.Section>
          <InlineStack gap="400" align="center">
            <Badge tone={step === 1 ? "info" : undefined}>
              {`1. Contenuto`}
            </Badge>
            <Text as="span" tone="subdued">&rarr;</Text>
            <Badge tone={step === 2 ? "info" : undefined}>
              {`2. Destinatari`}
            </Badge>
            <Text as="span" tone="subdued">&rarr;</Text>
            <Badge tone={step === 3 ? "info" : undefined}>
              {`3. Invio`}
            </Badge>
          </InlineStack>
        </Layout.Section>
      </Layout>

      {step === 2 ? (
        /* ──── STEP 2: Recipients & Send ──── */
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Destinatari
                </Text>
                <RadioButton
                  label={`Tutti gli iscritti${customerList.length > 0 ? ` (${customerList.length})` : ""}`}
                  checked={recipientMode === "all"}
                  id="recipients-all"
                  name="recipientMode"
                  onChange={() => setRecipientMode("all")}
                  helpText="L'email verrà inviata a tutti i clienti con consenso marketing attivo."
                />
                <RadioButton
                  label="Seleziona manualmente"
                  checked={recipientMode === "manual"}
                  id="recipients-manual"
                  name="recipientMode"
                  onChange={() => setRecipientMode("manual")}
                  helpText="Scegli a chi inviare dalla lista sottostante."
                />

                {recipientMode === "manual" && (
                  <BlockStack gap="300">
                    <TextField
                      label="Cerca per nome o email"
                      value={customerSearch}
                      onChange={setCustomerSearch}
                      placeholder="es. mario@email.com"
                      autoComplete="off"
                      clearButton
                      onClearButtonClick={() => setCustomerSearch("")}
                    />

                    {customersLoading ? (
                      <InlineStack align="center">
                        <Spinner size="large" />
                      </InlineStack>
                    ) : filteredCustomers.length === 0 ? (
                      <Banner tone="warning">
                        <p>Nessun cliente trovato.</p>
                      </Banner>
                    ) : (
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodySm" tone="subdued">
                            {filteredCustomers.length} client{filteredCustomers.length === 1 ? "e" : "i"}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {selectedCustomerIds.size} selezionat{selectedCustomerIds.size === 1 ? "o" : "i"}
                          </Text>
                        </InlineStack>
                        <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                          {filteredCustomers.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #f3f4f6",
                                cursor: "pointer",
                                backgroundColor: selectedCustomerIds.has(c.id) ? "#f0f5ff" : "transparent",
                              }}
                              onClick={() => handleToggleCustomer(c.id)}
                            >
                              <InlineStack gap="300" blockAlign="center">
                                <Checkbox
                                  label=""
                                  checked={selectedCustomerIds.has(c.id)}
                                  onChange={() => handleToggleCustomer(c.id)}
                                />
                                <BlockStack gap="050">
                                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                                  </Text>
                                  <Text as="span" variant="bodySm" tone="subdued">
                                    {c.email}
                                  </Text>
                                </BlockStack>
                              </InlineStack>
                            </div>
                          ))}
                        </div>
                      </BlockStack>
                    )}
                  </BlockStack>
                )}

                <Banner tone="info">
                  <p>
                    {recipientMode === "all"
                      ? `Invierai a ${customerList.length} destinatar${customerList.length === 1 ? "io" : "i"}`
                      : `Invierai a ${selectedCustomerIds.size} destinatar${selectedCustomerIds.size === 1 ? "io" : "i"}`}
                  </p>
                </Banner>

                <InlineStack gap="300">
                  <Button onClick={handleBackToStep1}>&larr; Indietro</Button>
                  <Button
                    variant="primary"
                    onClick={handleGoToStep3}
                    disabled={recipientMode === "manual" && selectedCustomerIds.size === 0}
                  >
                    Continua &rarr;
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      ) : step === 3 ? (
        /* ──── STEP 3: Scheduling & Send ──── */
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Pianificazione invio
                </Text>
                <RadioButton
                  label="Invia ora"
                  checked={sendMode === "now"}
                  id="send-now"
                  name="sendMode"
                  onChange={() => setSendMode("now")}
                  helpText="La campagna verrà inviata immediatamente."
                />
                <RadioButton
                  label="Schedula per data e ora"
                  checked={sendMode === "schedule"}
                  id="send-schedule"
                  name="sendMode"
                  onChange={() => setSendMode("schedule")}
                  helpText="La campagna verrà inviata automaticamente alla data e ora scelte."
                />

                {sendMode === "schedule" && (
                  <InlineStack gap="300">
                    <Box minWidth="180px">
                      <TextField
                        label="Data"
                        type="date"
                        value={scheduleDate}
                        onChange={setScheduleDate}
                        autoComplete="off"
                      />
                    </Box>
                    <Box minWidth="140px">
                      <TextField
                        label="Ora"
                        type="time"
                        value={scheduleTime}
                        onChange={setScheduleTime}
                        autoComplete="off"
                      />
                    </Box>
                  </InlineStack>
                )}

                {/* Riepilogo */}
                <Banner tone="info">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Riepilogo
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {`Oggetto: ${form.subject}`}
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {`Destinatari: ${recipientCount}`}
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {sendMode === "now"
                        ? "Invio: ora"
                        : scheduleDate && scheduleTime
                          ? `Invio: ${formatScheduleDate(scheduleDate, scheduleTime)}`
                          : "Invio: seleziona data e ora"}
                    </Text>
                  </BlockStack>
                </Banner>

                <InlineStack gap="300">
                  <Button onClick={() => setStep(2)}>&larr; Indietro</Button>
                  <Button
                    variant="primary"
                    onClick={() => setSendConfirmOpen(true)}
                    loading={sending || scheduling}
                    disabled={sendMode === "schedule" && (!scheduleDate || !scheduleTime || isScheduleDatePast(scheduleDate, scheduleTime))}
                  >
                    {sendMode === "now" ? "Invia ora" : "Schedula campagna"}
                  </Button>
                </InlineStack>

                {sendMode === "schedule" && scheduleDate && scheduleTime && isScheduleDatePast(scheduleDate, scheduleTime) && (
                  <Banner tone="warning">
                    <p>La data e ora selezionate sono nel passato. Scegli un momento futuro.</p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      ) : (
      /* ──── STEP 1: Content editor (existing) ──── */
      <Layout>

      {/* Template selector */}
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

              {/* Colori email */}
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
                          backgroundColor: bgColor,
                          border: "1px solid #d1d5db",
                          cursor: "pointer",
                          flexShrink: 0,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <input
                          type="color"
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
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
                        value={bgColor}
                        onChange={setBgColor}
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
                          backgroundColor: containerColor,
                          border: "1px solid #d1d5db",
                          cursor: "pointer",
                          flexShrink: 0,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <input
                          type="color"
                          value={containerColor}
                          onChange={(e) => setContainerColor(e.target.value)}
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
                        value={containerColor}
                        onChange={setContainerColor}
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
                          backgroundColor: btnColor,
                          border: "1px solid #d1d5db",
                          cursor: "pointer",
                          flexShrink: 0,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <input
                          type="color"
                          value={btnColor}
                          onChange={(e) => setBtnColor(e.target.value)}
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
                        value={btnColor}
                        onChange={setBtnColor}
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
                          backgroundColor: textColor,
                          border: "1px solid #d1d5db",
                          cursor: "pointer",
                          flexShrink: 0,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
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
                        value={textColor}
                        onChange={setTextColor}
                        autoComplete="off"
                        monospaced
                      />
                    </InlineStack>
                  </BlockStack>
                </Box>
              </InlineStack>

              <Box>
                <Button
                  variant="primary"
                  onClick={handleGoToStep2}
                >
                  Continua &rarr;
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
      )}

      {/* Send/schedule confirmation modal */}
      <Modal
        open={sendConfirmOpen}
        onClose={() => setSendConfirmOpen(false)}
        title={sendMode === "now" ? "Conferma invio" : "Conferma schedulazione"}
        primaryAction={{
          content: sendMode === "now" ? "Invia ora" : "Schedula",
          onAction: handleSend,
          loading: sending || scheduling,
        }}
        secondaryActions={[
          { content: "Annulla", onAction: () => setSendConfirmOpen(false) },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            {sendMode === "now"
              ? recipientMode === "all"
                ? `Stai per inviare la campagna "${form.subject}" a tutti i ${customerList.length} iscritti. Confermi?`
                : `Stai per inviare la campagna "${form.subject}" a ${selectedCustomerIds.size} destinatar${selectedCustomerIds.size === 1 ? "io" : "i"} selezionat${selectedCustomerIds.size === 1 ? "o" : "i"}. Confermi?`
              : `Stai per schedulare la campagna "${form.subject}" per ${formatScheduleDate(scheduleDate, scheduleTime)} a ${recipientCount} destinatar${recipientCount === 1 ? "io" : "i"}. Confermi?`}
          </Text>
        </Modal.Section>
      </Modal>

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
