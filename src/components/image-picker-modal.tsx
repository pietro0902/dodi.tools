"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Modal,
  BlockStack,
  InlineStack,
  TextField,
  Button,
  Text,
  Box,
  Spinner,
  DropZone,
} from "@shopify/polaris";

interface ShopifyFileItem {
  id: string;
  alt: string;
  url: string;
  filename: string;
}

interface ImagePickerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (url: string, alt: string) => void;
  getToken: () => Promise<string>;
}

export function ImagePickerModal({
  open,
  onClose,
  onConfirm,
  getToken,
}: ImagePickerModalProps) {
  const [tab, setTab] = useState<"upload" | "browse">("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  // Browse state
  const [files, setFiles] = useState<ShopifyFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [fileSearch, setFileSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setImageUrl("");
      setImageAlt("");
      setTab("upload");
      setFiles([]);
      setFilesLoaded(false);
      setFileSearch("");
    }
  }, [open]);

  // Fetch files when switching to browse tab
  const fetchFiles = useCallback(
    async (query?: string) => {
      setFilesLoading(true);
      try {
        const token = await getToken();
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        params.set("limit", "24");
        const res = await fetch(`/api/files/list?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFiles(data.files || []);
        setFilesLoaded(true);
      } catch (err) {
        console.error("Files fetch error:", err);
        setFiles([]);
      } finally {
        setFilesLoading(false);
      }
    },
    [getToken]
  );

  const handleTabBrowse = useCallback(() => {
    setTab("browse");
    if (!filesLoaded) fetchFiles();
  }, [filesLoaded, fetchFiles]);

  const handleFileSearchChange = useCallback(
    (value: string) => {
      setFileSearch(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        fetchFiles(value || undefined);
      }, 400);
    },
    [fetchFiles]
  );

  const handleSelectFile = useCallback((file: ShopifyFileItem) => {
    setImageUrl(file.url);
    setImageAlt(file.alt || file.filename);
    setTab("upload"); // switch back to show the preview
  }, []);

  const handleImageDrop = useCallback(
    async (_dropFiles: File[], acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      setImageUploading(true);
      try {
        const token = await getToken();
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
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        setImageUploading(false);
      }
    },
    [getToken]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scegli immagine"
      primaryAction={{
        content: "Inserisci",
        onAction: () => onConfirm(imageUrl, imageAlt),
        disabled: !imageUrl || imageUploading,
      }}
      secondaryActions={[{ content: "Annulla", onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Tab buttons */}
          <InlineStack gap="200">
            <Button
              variant={tab === "upload" ? "primary" : "secondary"}
              size="slim"
              onClick={() => setTab("upload")}
            >
              Carica / URL
            </Button>
            <Button
              variant={tab === "browse" ? "primary" : "secondary"}
              size="slim"
              onClick={handleTabBrowse}
            >
              Libreria Shopify
            </Button>
          </InlineStack>

          {tab === "upload" ? (
            <BlockStack gap="400">
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

              <InlineStack align="center">
                <Text as="p" variant="bodySm" tone="subdued">
                  oppure inserisci un URL diretto
                </Text>
              </InlineStack>

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
          ) : (
            <BlockStack gap="400">
              <TextField
                label="Cerca per nome file"
                value={fileSearch}
                onChange={handleFileSearchChange}
                placeholder="logo, banner, promo..."
                autoComplete="off"
                clearButton
                onClearButtonClick={() => handleFileSearchChange("")}
              />

              {filesLoading ? (
                <InlineStack align="center">
                  <Spinner size="large" />
                </InlineStack>
              ) : files.length === 0 ? (
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Nessuna immagine trovata
                </Text>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                    maxHeight: "400px",
                    overflowY: "auto",
                  }}
                >
                  {files.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => handleSelectFile(file)}
                      style={{
                        border: imageUrl === file.url
                          ? "2px solid #2c6ecb"
                          : "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "4px",
                        cursor: "pointer",
                        backgroundColor: imageUrl === file.url ? "#f0f5ff" : "transparent",
                        textAlign: "center",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={file.url}
                        alt={file.alt || file.filename}
                        style={{
                          width: "100%",
                          height: "80px",
                          objectFit: "contain",
                          borderRadius: "4px",
                        }}
                      />
                      <Text as="p" variant="bodySm" tone="subdued" truncate>
                        {file.filename}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
