import type { MetadataRoute } from "next";

/**
 * The web app manifest.
 *
 * theme_color and background_color are the app's own near-black, so the
 * status bar and the splash screen are the same surface as the first screen
 * and the launch reads as one continuous thing rather than a white flash into
 * a dark app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Liftlog",
    short_name: "Liftlog",
    description: "Log your lifts between sets. Works offline in the gym.",
    // Straight into the workout, not a marketing page.
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060708",
    theme_color: "#060708",
    categories: ["health", "fitness", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Separate maskable art: the mark sits inside the 80% safe zone so
      // Android can crop to a circle or a squircle without clipping the plate.
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", short_name: "Today", url: "/today" },
      { name: "Log bodyweight", short_name: "Body", url: "/body" },
    ],
  };
}
