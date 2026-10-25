import type { MetadataRoute } from "next";

/**
 * The sign-in pages are the only public surface. Everything behind them is
 * one person's training log, so it is disallowed explicitly rather than left
 * to the redirect to /login to imply.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/today", "/progress", "/body", "/plan", "/settings", "/onboarding", "/api/"],
      },
    ],
  };
}
