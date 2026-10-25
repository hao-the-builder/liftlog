import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker";
import "./globals.css";

// Archivo carries every label, heading and button. An industrial grotesque with
// signage lineage that holds its shape at 11px and at 48px. Deliberately not Inter.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Geist Mono carries every numeral the user reads or edits. Monospaced by
// construction, so a counting-down timer or an edited rep count physically
// cannot shift width. Mono here is measurement, not decoration.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Liftlog",
  description: "Log your lifts between sets. Works offline in the gym.",
  applicationName: "Liftlog",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Liftlog",
    // Lets the app paint under the status bar, which is what viewport-fit
    // cover and the safe-area insets are already set up for.
    statusBarStyle: "black-translucent",
    startupImage: [],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app paint under the notch and the home indicator. Without this,
  // every env(safe-area-inset-*) in the stylesheet resolves to 0px.
  viewportFit: "cover",
  // Makes the Android software keyboard shrink the layout viewport, so 100dvh
  // and the bottom tab bar react the way they already do on iOS.
  interactiveWidget: "resizes-content",
  // Never user-scalable: false. Inputs are 16px so iOS has no reason to zoom.
  themeColor: "#0b0d0c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg text-text">
        <SessionProvider>{children}</SessionProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
