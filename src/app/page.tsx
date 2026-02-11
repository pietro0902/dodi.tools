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
  TextField,
  FormLayout,
  BlockStack,
  InlineStack,
  Spinner,
  Box,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

interface DashboardStats {
  subscriberCount: number;
  webhooksActive: boolean;
  cronInterval: string;
  resendConfigured: boolean;
}

interface CampaignForm {
  subject: string;
  htmlBody: string;
  ctaText: string;
  ctaUrl: string;
}

export default function Dashboard() {
  const shopify = useAppBridge();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const [campaign, setCampaign] = useState<CampaignForm>({
    subject: "",
    htmlBody: "",
    ctaText: "",
    ctaUrl: "",
  });
  const [sending, setSending] = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const token = await shopify.idToken();
      const res = await fetch("/api/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setStatsError(
        err instanceof Error ? err.message : "Errore nel caricamento"
      );
    } finally {
      setStatsLoading(false);
    }
  }, [shopify]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleCampaignChange = useCallback(
    (field: keyof CampaignForm) => (value: string) => {
      setCampaign((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSendCampaign = useCallback(async () => {
    if (!campaign.subject || !campaign.htmlBody) {
      shopify.toast.show("Compila almeno oggetto e corpo HTML", {
        isError: true,
      });
      return;
    }

    setSending(true);
    try {
      const token = await shopify.idToken();
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: campaign.subject,
          html: campaign.htmlBody,
          ctaText: campaign.ctaText,
          ctaUrl: campaign.ctaUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      shopify.toast.show(
        `Campagna inviata a ${data.sentTo ?? "?"} iscritti`
      );
      setCampaign({ subject: "", htmlBody: "", ctaText: "", ctaUrl: "" });
    } catch (err) {
      shopify.toast.show(
        err instanceof Error ? err.message : "Errore nell'invio",
        { isError: true }
      );
    } finally {
      setSending(false);
    }
  }, [campaign, shopify]);

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

        {/* Manual Campaign */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Invia Campagna Manuale
              </Text>
              <FormLayout>
                <TextField
                  label="Oggetto"
                  value={campaign.subject}
                  onChange={handleCampaignChange("subject")}
                  placeholder="Es: Nuova collezione primavera"
                  autoComplete="off"
                />
                <TextField
                  label="Corpo HTML"
                  value={campaign.htmlBody}
                  onChange={handleCampaignChange("htmlBody")}
                  multiline={4}
                  placeholder="<p>Ciao {{name}}, scopri le novità...</p>"
                  autoComplete="off"
                />
                <FormLayout.Group>
                  <TextField
                    label="Testo CTA"
                    value={campaign.ctaText}
                    onChange={handleCampaignChange("ctaText")}
                    placeholder="Scopri ora"
                    autoComplete="off"
                  />
                  <TextField
                    label="URL CTA"
                    value={campaign.ctaUrl}
                    onChange={handleCampaignChange("ctaUrl")}
                    placeholder="https://www.dodishop.it/collections/new"
                    autoComplete="off"
                  />
                </FormLayout.Group>
              </FormLayout>
              <Box>
                <Button
                  variant="primary"
                  onClick={handleSendCampaign}
                  loading={sending}
                >
                  Invia campagna
                </Button>
              </Box>
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
