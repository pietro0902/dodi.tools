import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { Header } from "./components/header";
import { Footer } from "./components/footer";

interface LineItem {
  title: string;
  quantity: number;
  price: string;
}

interface PostPurchaseEmailProps {
  firstName: string;
  orderNumber: number;
  totalPrice: string;
  currency: string;
  lineItems: LineItem[];
  storeName: string;
}

export default function PostPurchaseEmail({
  firstName = "Cliente",
  orderNumber = 1001,
  totalPrice = "99.00",
  currency = "EUR",
  lineItems = [{ title: "Prodotto esempio", quantity: 1, price: "99.00" }],
  storeName = "Il Tuo Store",
}: PostPurchaseEmailProps) {
  const currencySymbol = currency === "EUR" ? "€" : currency;

  return (
    <Html>
      <Head />
      <Preview>
        {`Grazie per il tuo ordine #${orderNumber}!`}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Text style={heading}>Grazie per il tuo acquisto!</Text>

          <Text style={paragraph}>
            Ciao {firstName}, il tuo ordine{" "}
            <strong>#{orderNumber}</strong> &egrave; stato confermato.
          </Text>

          <Section style={orderSection}>
            <Text style={orderTitle}>Riepilogo ordine</Text>
            {lineItems.map((item, i) => (
              <Row key={i} style={itemRow}>
                <Column style={itemName}>
                  {item.title} &times; {item.quantity}
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

          <Text style={paragraph}>
            Riceverai un&apos;email di conferma con i dettagli della spedizione
            appena il tuo ordine sar&agrave; in viaggio.
          </Text>

          <Text style={saluto}>
            Grazie per aver scelto {storeName}!
            <br />
            Il nostro team
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

const orderSection: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderRadius: "6px",
  padding: "16px",
  margin: "16px 0 24px",
};

const orderTitle: React.CSSProperties = {
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

const saluto: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#374151",
  margin: "24px 0 0",
};
