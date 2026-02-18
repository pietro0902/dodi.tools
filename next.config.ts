import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors https://*.myshopify.com https://admin.shopify.com;`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
