"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Banner,
  Button,
  BlockStack,
  InlineStack,
  Spinner,
} from "@shopify/polaris";
import { useRouter } from "next/navigation";

interface DashboardStats {
  subscriberCount: number;
  webhooksActive: boolean;
  cronInterval: string;
  resendConfigured: boolean;
}

interface AutomationStatus {
  welcome: { enabled: boolean };
  abandonedCart: { enabled: boolean };
}

function useShopifyGlobal() {
  const [bridge, setBridge] = useState<typeof shopify | null>(
    typeof window !== "undefined" && typeof shopify !== "undefined"
      ? shopify
      : null
  );

  useEffect(() => {
    if (bridge) return;
    // Poll briefly in case the script loads after first render
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

export default function Dashboard() {
  const app = useShopifyGlobal();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);

  const router = useRouter();

  const fetchStats = useCallback(async () => {
    if (!app) {
      setStatsLoading(false);
      setStatsError("Apri questa app da Shopify Admin per visualizzare i dati.");
      return;
    }
    setStatsLoading(true);
    setStatsError("");
    try {
      const token = await app.idToken();
      const res = await fetch("/api/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);

      // Also fetch automation settings status
      try {
        const autoRes = await fetch("/api/automations/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (autoRes.ok) {
          const autoData = await autoRes.json();
          setAutomationStatus({
            welcome: { enabled: autoData.welcome?.enabled ?? true },
            abandonedCart: { enabled: autoData.abandonedCart?.enabled ?? true },
          });
        }
      } catch {
        // Non-critical, ignore
      }
    } catch (err) {
      setStatsError(
        err instanceof Error ? err.message : "Errore nel caricamento"
      );
    } finally {
      setStatsLoading(false);
    }
  }, [app]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <Page title="Email Marketing Dashboard">
      <Layout>
        {statsError && (
          <Layout.Section>
            <Banner
              title="Errore"
              tone="critical"
              onDismiss={() => setStatsError("")}
            >
              <p>{statsError}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* System Status */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Stato Sistema
              </Text>
              {statsLoading ? (
                <InlineStack align="center">
                  <Spinner size="small" />
                </InlineStack>
              ) : (
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Webhook
                    </Text>
                    <Badge tone={stats?.webhooksActive ? "success" : "critical"}>
                      {stats?.webhooksActive ? "Attivi" : "Inattivi"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Cron carrelli abbandonati
                    </Text>
                    <Badge tone="info">
                      {`Ogni ${stats?.cronInterval ?? "6h"}`}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Resend
                    </Text>
                    <Badge tone={stats?.resendConfigured ? "success" : "critical"}>
                      {stats?.resendConfigured ? "Configurato" : "Non configurato"}
                    </Badge>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Subscriber Count */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Iscritti Marketing
              </Text>
              {statsLoading ? (
                <InlineStack align="center">
                  <Spinner size="small" />
                </InlineStack>
              ) : (
                <BlockStack gap="200">
                  <Text as="p" variant="headingXl">
                    {stats?.subscriberCount ?? 0}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Clienti con consenso email marketing attivo
                  </Text>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Campaign Editor */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Campagne Email
              </Text>
              <Text as="p" variant="bodyMd">
                Crea campagne con template brandizzati, anteprima live e
                personalizzazione automatica del nome.
              </Text>
              <Button
                variant="primary"
                onClick={() => router.push("/campaign")}
              >
                Crea nuova campagna
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Automations */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Automazioni
              </Text>
              {statsLoading ? (
                <InlineStack align="center">
                  <Spinner size="small" />
                </InlineStack>
              ) : (
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Email di benvenuto
                    </Text>
                    <Badge tone={automationStatus?.welcome.enabled ? "success" : "critical"}>
                      {automationStatus?.welcome.enabled ? "Attiva" : "Disattiva"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">
                      Carrello abbandonato
                    </Text>
                    <Badge tone={automationStatus?.abandonedCart.enabled ? "success" : "critical"}>
                      {automationStatus?.abandonedCart.enabled ? "Attiva" : "Disattiva"}
                    </Badge>
                  </InlineStack>
                  <Button onClick={() => router.push("/automations")}>
                    Gestisci automazioni
                  </Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Activity Log */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Attività Recenti
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Il log delle attività sarà disponibile in una prossima versione.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
