import { Hr, Link, Section, Text } from "@react-email/components";

interface FooterProps {
  storeName: string;
  unsubscribeUrl?: string;
}

export function Footer({ storeName, unsubscribeUrl }: FooterProps) {
  return (
    <Section style={container}>
      <Hr style={divider} />
      <Text style={text}>
        Hai ricevuto questa email perch&eacute; ti sei iscritto alla newsletter di{" "}
        {storeName}.
      </Text>
      {unsubscribeUrl && (
        <Text style={text}>
          <Link href={unsubscribeUrl} style={link}>
            Cancella iscrizione
          </Link>
        </Text>
      )}
      <Text style={copyright}>
        &copy; {new Date().getFullYear()} {storeName}. Tutti i diritti
        riservati.
      </Text>
    </Section>
  );
}

const container: React.CSSProperties = {
  marginTop: "32px",
  textAlign: "center",
};

const divider: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "0 0 16px",
};

const text: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  lineHeight: "20px",
  margin: "0 0 8px",
};

const link: React.CSSProperties = {
  color: "#6b7280",
  textDecoration: "underline",
};

const copyright: React.CSSProperties = {
  fontSize: "11px",
  color: "#9ca3af",
  margin: "16px 0 0",
};
