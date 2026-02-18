"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Spinner,
  Banner,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";
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

export default function AutomationsPage() {
  const app = useShopifyGlobal();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [toggling, setToggling] = useState<"welcome" | "abandonedCart" | "giftCard" | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!app) return;
    setLoading(true);
    try {
      const token = await app.idToken();
      const res = await fetch("/api/automations/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSettings(await res.json());
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
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = useCallback(
    async (section: "welcome" | "abandonedCart" | "giftCard") => {
      if (!app || !settings) return;
      setToggling(section);
      try {
        const token = await app.idToken();
        const updated = {
          ...settings,
          [section]: {
            ...settings[section],
            enabled: !settings[section].enabled,
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
        const label =
          section === "welcome"
            ? "Benvenuto"
            : section === "abandonedCart"
            ? "Carrello abbandonato"
            : "Gift card";
        app.toast.show(
          `${label} ${updated[section].enabled ? "attivata" : "disattivata"}`
        );
      } catch (err) {
        app.toast.show(
          err instanceof Error ? err.message : "Errore",
          { isError: true }
        );
      } finally {
        setToggling(null);
      }
    },
    [app, settings]
  );

  if (loading) {
    return (
      <Page title="Automazioni" backAction={{ onAction: () => router.push("/") }}>
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
      <Page title="Automazioni" backAction={{ onAction: () => router.push("/") }}>
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
    <Page title="Automazioni" backAction={{ onAction: () => router.push("/") }}>
      <Layout>
        {/* Welcome Email */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Email di Benvenuto
                  </Text>
                  <Badge tone={settings.welcome.enabled ? "success" : undefined}>
                    {settings.welcome.enabled ? "Attiva" : "Disattiva"}
                  </Badge>
                </InlineStack>
                <InlineStack gap="200">
                  <Button
                    size="slim"
                    onClick={() => handleToggle("welcome")}
                    loading={toggling === "welcome"}
                  >
                    {settings.welcome.enabled ? "Disabilita" : "Abilita"}
                  </Button>
                  <Button
                    variant="primary"
                    size="slim"
                    onClick={() => router.push("/automations/welcome")}
                  >
                    Modifica
                  </Button>
                </InlineStack>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Inviata automaticamente ai nuovi clienti con consenso marketing.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Abandoned Cart */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Carrello Abbandonato
                  </Text>
                  <Badge tone={settings.abandonedCart.enabled ? "success" : undefined}>
                    {settings.abandonedCart.enabled ? "Attiva" : "Disattiva"}
                  </Badge>
                </InlineStack>
                <InlineStack gap="200">
                  <Button
                    size="slim"
                    onClick={() => handleToggle("abandonedCart")}
                    loading={toggling === "abandonedCart"}
                  >
                    {settings.abandonedCart.enabled ? "Disabilita" : "Abilita"}
                  </Button>
                  <Button
                    variant="primary"
                    size="slim"
                    onClick={() => router.push("/automations/abandoned-cart")}
                  >
                    Modifica
                  </Button>
                </InlineStack>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Inviata ai clienti che hanno abbandonato il carrello.
                I dettagli dei prodotti vengono aggiunti automaticamente.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Gift Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Gift Card Acquistata
                  </Text>
                  <Badge tone={settings.giftCard.enabled ? "success" : undefined}>
                    {settings.giftCard.enabled ? "Attiva" : "Disattiva"}
                  </Badge>
                </InlineStack>
                <InlineStack gap="200">
                  <Button
                    size="slim"
                    onClick={() => handleToggle("giftCard")}
                    loading={toggling === "giftCard"}
                  >
                    {settings.giftCard.enabled ? "Disabilita" : "Abilita"}
                  </Button>
                  <Button
                    variant="primary"
                    size="slim"
                    onClick={() => router.push("/automations/gift-card")}
                  >
                    Modifica
                  </Button>
                </InlineStack>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Inviata all&apos;acquirente quando viene comprata una gift card sul sito.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
