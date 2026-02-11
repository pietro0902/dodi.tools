import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { Header } from "./components/header";
import { Footer } from "./components/footer";

interface CartItem {
  title: string;
  quantity: number;
  price: string;
  variantTitle?: string | null;
}

interface AbandonedCartEmailProps {
  firstName: string;
  checkoutUrl: string;
  totalPrice: string;
  currency: string;
  lineItems: CartItem[];
  storeName: string;
  logoUrl?: string;
}

export default function AbandonedCartEmail({
  firstName = "Cliente",
  checkoutUrl = "https://example.com/checkout",
  totalPrice = "59.00",
  currency = "EUR",
  lineItems = [{ title: "Prodotto esempio", quantity: 1, price: "59.00" }],
  storeName = "Il Tuo Store",
  logoUrl,
}: AbandonedCartEmailProps) {
  const currencySymbol = currency === "EUR" ? "€" : currency;

  return (
    <Html>
      <Head />
      <Preview>
        Hai dimenticato qualcosa nel carrello!
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Header storeName={storeName} logoUrl={logoUrl} />

          <Text style={heading}>Hai dimenticato qualcosa!</Text>

          <Text style={paragraph}>
            Ciao {firstName}, abbiamo notato che hai lasciato degli articoli nel
            tuo carrello. Non preoccuparti, li abbiamo salvati per te!
          </Text>

          <Section style={cartSection}>
            <Text style={cartTitle}>Il tuo carrello</Text>
            {lineItems.map((item, i) => (
              <Row key={i} style={itemRow}>
                <Column style={itemName}>
                  {item.title}
                  {item.variantTitle && (
                    <span style={variant}> - {item.variantTitle}</span>
                  )}
                  {" "}&times; {item.quantity}
                </Column>
                <Column style={itemPrice}>
                  {currencySymbol} {item.price}
                </Column>
              </Row>
            ))}
            <Row style={totalRow}>
              <Column style={itemName}>
                <strong>Totale</strong>
              </Column>
              <Column style={itemPrice}>
                <strong>
                  {currencySymbol} {totalPrice}
                </strong>
              </Column>
            </Row>
          </Section>

          <Link href={checkoutUrl} style={button}>
            Completa il tuo ordine
          </Link>

          <Text style={paragraph}>
            Se hai bisogno di aiuto o hai domande, rispondi a questa email.
            Siamo qui per te!
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

const cartSection: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderRadius: "6px",
  padding: "16px",
  margin: "16px 0 24px",
};

const cartTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 12px",
};

const itemRow: React.CSSProperties = {
  padding: "4px 0",
};

const itemName: React.CSSProperties = {
  fontSize: "14px",
  color: "#374151",
};

const variant: React.CSSProperties = {
  color: "#6b7280",
};

const itemPrice: React.CSSProperties = {
  fontSize: "14px",
  color: "#374151",
  textAlign: "right" as const,
};

const totalRow: React.CSSProperties = {
  padding: "8px 0 0",
  borderTop: "1px solid #e5e7eb",
  marginTop: "8px",
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
