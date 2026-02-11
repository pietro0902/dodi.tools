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

interface WelcomeEmailProps {
  firstName: string;
  storeName: string;
  storeUrl: string;
  logoUrl?: string;
}

export default function WelcomeEmail({
  firstName = "Cliente",
  storeName = "Il Tuo Store",
  storeUrl = "https://example.com",
  logoUrl,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Benvenuto in {storeName}! Grazie per esserti registrato.
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Header storeName={storeName} logoUrl={logoUrl} />

          <Text style={heading}>Ciao {firstName}!</Text>

          <Text style={paragraph}>
            Benvenuto in <strong>{storeName}</strong>! Siamo felici di averti
            con noi.
          </Text>

          <Text style={paragraph}>
            Iscrivendoti alla nostra community, sarai il primo a scoprire le
            nostre novit&agrave;, offerte esclusive e promozioni speciali.
          </Text>

          <Link href={storeUrl} style={button}>
            Visita lo Store
          </Link>

          <Text style={paragraph}>
            Se hai domande, rispondi pure a questa email. Siamo qui per
            aiutarti!
          </Text>

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

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#111827",
  margin: "0 0 16px",
};

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
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
  margin: "8px 0 24px",
};

const saluto: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "24px 0 0",
};
