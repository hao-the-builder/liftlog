import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only. Next 16 blocks its own dev assets when the host in the URL is
  // not one it expects, which silently stops the page hydrating. The e2e
  // suite and phone testing over the LAN both hit it by IP.
  // The dev overlay floats above the bottom tab bar and swallows taps there,
  // both for a human testing on a phone and for the e2e suite.
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.0/16", "10.0.0.0/8"],

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
