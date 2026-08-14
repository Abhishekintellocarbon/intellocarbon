import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { PlausibleAnalytics } from "@/components/layout/plausible-analytics";
import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { SentryMonitoring } from "@/components/layout/sentry-monitoring";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Wordmark only — ExtraBold 800 is the single weight the lockup uses, so just
// that weight is requested rather than the full family. Loaded through
// next/font/google exactly as Inter is, so both are self-hosted at build time
// and neither adds a runtime request to Google.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Intellocarbon — Environmental Compliance & Climate Intelligence",
  description:
    "Environmental compliance and climate intelligence, unified. Track emissions, automate compliance, and act on climate risk in one place.",
  // No `icons` block: the app icons are file conventions now — app/icon.svg
  // and app/apple-icon.tsx — and Next emits their <link> tags itself. Listing
  // them here as well would point at the deleted /favicon.ico and
  // /apple-touch-icon.png paths.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        <PlausibleAnalytics />
        <SentryMonitoring />
        <AuthProvider>{children}</AuthProvider>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
