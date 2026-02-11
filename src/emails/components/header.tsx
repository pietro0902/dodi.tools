import { Img, Section, Text } from "@react-email/components";

interface HeaderProps {
  storeName: string;
  logoUrl?: string;
  logoWidth?: number;
}

export function Header({ storeName, logoUrl, logoWidth = 120 }: HeaderProps) {
  return (
    <Section style={container}>
      {logoUrl ? (
        <Img
          src={logoUrl}
          alt={storeName}
          width={logoWidth}
          style={logo}
        />
      ) : (
        <Text style={title}>{storeName}</Text>
      )}
    </Section>
  );
}

const container: React.CSSProperties = {
  textAlign: "center",
  padding: "32px 0 24px",
  borderBottom: "1px solid #e5e7eb",
  marginBottom: "24px",
};

const logo: React.CSSProperties = {
  margin: "0 auto 12px",
};

const title: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  color: "#111827",
  margin: "0",
};
