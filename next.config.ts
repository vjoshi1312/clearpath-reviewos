import type { NextConfig } from "next";

// Cache Components is intentionally not enabled: every page in this demo reads
// fresh database state per request and uses `export const dynamic = "force-dynamic"`.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
