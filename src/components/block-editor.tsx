"use client";

import {
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Select,
  Text,
  Badge,
  Box,
} from "@shopify/polaris";
import type {
  EmailBlock,
  EmailBlockType,
} from "@/lib/email-blocks";
import { createDefaultBlock } from "@/lib/email-blocks";
import type { ProductLayout } from "@/lib/product-html";

interface BlockEditorProps {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
  onOpenProductPicker: (blockId: string) => void;
  onOpenImageUploader: (blockId: string) => void;
}

const BLOCK_LABELS: Record<EmailBlockType, string> = {
  text: "Testo",
  image: "Immagine",
  button: "Bottone",
  products: "Prodotti",
  divider: "Separatore",
};

export function BlockEditor({
  blocks,
  onChange,
  onOpenProductPicker,
  onOpenImageUploader,
}: BlockEditorProps) {
  function updateBlock(id: string, patch: Partial<EmailBlock>) {
    onChange(
      blocks.map((b) => (b.id === id ? { ...b, ...patch } as EmailBlock : b))
    );
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function removeBlock(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }

  function addBlock(type: EmailBlockType) {
    onChange([...blocks, createDefaultBlock(type)]);
  }

  return (
    <BlockStack gap="400">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "12px",
          }}
        >
          <BlockStack gap="300">
            {/* Header */}
            <InlineStack align="space-between" blockAlign="center">
              <Badge>{BLOCK_LABELS[block.type]}</Badge>
              <InlineStack gap="100">
                <Button
                  size="slim"
                  variant="plain"
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                >
                  ▲
                </Button>
                <Button
                  size="slim"
                  variant="plain"
                  disabled={index === blocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                >
                  ▼
                </Button>
                <Button
                  size="slim"
                  variant="plain"
                  tone="critical"
                  onClick={() => removeBlock(block.id)}
                >
                  ✕
                </Button>
              </InlineStack>
            </InlineStack>

            {/* Block-specific fields */}
            {block.type === "text" && (
              <TextField
                label="HTML"
                labelHidden
                value={block.html}
                onChange={(v) => updateBlock(block.id, { html: v })}
                multiline={6}
                placeholder="<p>Ciao {{name}}, scopri le novità...</p>"
                autoComplete="off"
              />
            )}

            {block.type === "image" && (
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="end">
                  <Box minWidth="0" width="100%">
                    <TextField
                      label="URL immagine"
                      value={block.src}
                      onChange={(v) => updateBlock(block.id, { src: v })}
                      placeholder="https://cdn.shopify.com/..."
                      autoComplete="off"
                    />
                  </Box>
                  <Button
                    onClick={() => onOpenImageUploader(block.id)}
                    variant="secondary"
                    size="slim"
                  >
                    Carica
                  </Button>
                </InlineStack>
                <TextField
                  label="Testo alternativo"
                  value={block.alt}
                  onChange={(v) => updateBlock(block.id, { alt: v })}
                  placeholder="Descrizione immagine"
                  autoComplete="off"
                />
                <Select
                  label="Larghezza"
                  options={[
                    { label: "50%", value: "50%" },
                    { label: "75%", value: "75%" },
                    { label: "100%", value: "100%" },
                  ]}
                  value={block.width}
                  onChange={(v) =>
                    updateBlock(block.id, {
                      width: v as "50%" | "75%" | "100%",
                    })
                  }
                />
                {block.src && (
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={block.src}
                      alt={block.alt || "Anteprima"}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "150px",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                )}
              </BlockStack>
            )}

            {block.type === "button" && (
              <BlockStack gap="200">
                <TextField
                  label="Testo bottone"
                  value={block.text}
                  onChange={(v) => updateBlock(block.id, { text: v })}
                  placeholder="Scopri ora"
                  autoComplete="off"
                />
                <TextField
                  label="URL"
                  value={block.url}
                  onChange={(v) => updateBlock(block.id, { url: v })}
                  placeholder="https://www.dodishop.it/..."
                  autoComplete="off"
                />
                <InlineStack gap="300" wrap>
                  <Box minWidth="140px">
                    <BlockStack gap="100">
                      <Text as="span" variant="bodySm">Sfondo bottone</Text>
                      <InlineStack gap="200" blockAlign="center">
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "4px",
                            backgroundColor: block.bgColor,
                            border: "1px solid #d1d5db",
                            cursor: "pointer",
                            flexShrink: 0,
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <input
                            type="color"
                            value={block.bgColor}
                            onChange={(e) =>
                              updateBlock(block.id, { bgColor: e.target.value })
                            }
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
                          value={block.bgColor}
                          onChange={(v) => updateBlock(block.id, { bgColor: v })}
                          autoComplete="off"
                          monospaced
                        />
                      </InlineStack>
                    </BlockStack>
                  </Box>
                  <Box minWidth="140px">
                    <BlockStack gap="100">
                      <Text as="span" variant="bodySm">Colore testo</Text>
                      <InlineStack gap="200" blockAlign="center">
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "4px",
                            backgroundColor: block.textColor,
                            border: "1px solid #d1d5db",
                            cursor: "pointer",
                            flexShrink: 0,
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <input
                            type="color"
                            value={block.textColor}
                            onChange={(e) =>
                              updateBlock(block.id, { textColor: e.target.value })
                            }
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
                          value={block.textColor}
                          onChange={(v) => updateBlock(block.id, { textColor: v })}
                          autoComplete="off"
                          monospaced
                        />
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            )}

            {block.type === "products" && (
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Button
                    onClick={() => onOpenProductPicker(block.id)}
                    variant="secondary"
                    size="slim"
                  >
                    Scegli prodotti
                  </Button>
                  {block.products.length > 0 && (
                    <Badge tone="info">
                      {`${block.products.length} prodott${block.products.length === 1 ? "o" : "i"}`}
                    </Badge>
                  )}
                </InlineStack>
                <Select
                  label="Layout"
                  options={[
                    { label: "Griglia", value: "grid" },
                    { label: "Scorrimento", value: "scroll" },
                  ]}
                  value={block.layout}
                  onChange={(v) =>
                    updateBlock(block.id, { layout: v as ProductLayout })
                  }
                />
              </BlockStack>
            )}

            {block.type === "divider" && (
              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid #e5e7eb",
                  margin: "8px 0",
                }}
              />
            )}
          </BlockStack>
        </div>
      ))}

      {/* Add block menu */}
      <InlineStack gap="200" wrap>
        <Text as="span" variant="bodySm" tone="subdued">
          Aggiungi:
        </Text>
        <Button size="slim" onClick={() => addBlock("text")}>
          + Testo
        </Button>
        <Button size="slim" onClick={() => addBlock("image")}>
          + Immagine
        </Button>
        <Button size="slim" onClick={() => addBlock("button")}>
          + Bottone
        </Button>
        <Button size="slim" onClick={() => addBlock("products")}>
          + Prodotti
        </Button>
        <Button size="slim" onClick={() => addBlock("divider")}>
          + Separatore
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
