import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import { Header } from "./components/header";
import { Footer } from "./components/footer";

interface CampaignEmailProps {
  firstName: string;
  subject: string;
  previewText: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  storeName: string;
  logoUrl?: string;
}

export default function CampaignEmail({
  firstName = "Cliente",
  subject = "Novità dal tuo store",
  previewText = "Scopri le ultime novità",
  bodyHtml = "<p>Contenuto della campagna</p>",
  ctaText,
  ctaUrl,
  storeName = "Il Tuo Store",
  logoUrl,
}: CampaignEmailProps) {
  return (
    <Html>
      <Head>
        <title>{subject}</title>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header storeName={storeName} logoUrl={logoUrl} />

          <Text style={greeting}>Ciao {firstName}!</Text>

          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />

          {ctaText && ctaUrl && (
            <Link href={ctaUrl} style={button}>
              {ctaText}
            </Link>
          )}

          <Text style={saluto}>
            A presto,
            <br />
            Il team di {storeName}
          </Text>

          <Footer storeName={storeName} />
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "24px 32px",
  maxWidth: "600px",
  borderRadius: "8px",
};

const greeting: React.CSSProperties = {
  fontSize: "18px",
  color: "#111827",
  margin: "0 0 16px",
};

const button: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#111827",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  padding: "12px 32px",
  borderRadius: "6px",
  margin: "16px 0 24px",
};

const saluto: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "24px 0 0",
};
