import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components and Partial Prefetching are deliberately off.
  // Liftlog is local-first: every authenticated screen reads from IndexedDB in a
  // Client Component, so there is no server-rendered session-derived data worth
  // caching. Leaving them off keeps the app shell fully static, which is exactly
  // what the service worker needs in order to boot the app offline in the gym.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
