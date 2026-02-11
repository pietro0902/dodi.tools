import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Email Marketing",
  description: "Automated email marketing system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ?? "";

  return (
    <html lang="it">
      <head>
        <script
          src={`https://cdn.shopify.com/shopifycloud/app-bridge.js?apiKey=${apiKey}`}
          data-api-key={apiKey}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
