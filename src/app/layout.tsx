import type { Metadata, Viewport } from "next";
import { Archivo, Bodoni_Moda, Bricolage_Grotesque, DM_Serif_Display, Fragment_Mono, Instrument_Sans, Instrument_Serif, JetBrains_Mono, Noto_Sans_Devanagari, Onest, Syne } from "next/font/google";
import "./globals.css";
import "./storefront.css";
import "./blocks.css";
import "./editor.css";
import "./landing.css";

// Every font a theme can pick, exposed as CSS variables (see FONTS in lib/theme.ts).
const bodoni = Bodoni_Moda({ subsets: ["latin"], variable: "--font-bodoni", preload: false, style: ["normal", "italic"], display: "swap" });
const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest", display: "swap" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", preload: false, display: "swap" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-dmserif", preload: false, display: "swap" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", preload: false, display: "swap" });
// Devanagari fallback so Hindi storefronts render in a matching weight instead of the system font.
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap" });
// Fonts a theme can pick. Only the platform's own fonts are preloaded; the rest load when a site uses them.
const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans", display: "swap", preload: false });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif", display: "swap", preload: false });
const fragment = Fragment_Mono({ subsets: ["latin"], weight: "400", variable: "--font-fragment", display: "swap", preload: false });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Kalaa",
  description: "Branded storefronts, apps and courses for India's educators.",
};

export const viewport: Viewport = { themeColor: "#0a0a0b", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={[bodoni, onest, syne, dmSerif, archivo, deva, mono, instrumentSans, instrumentSerif, fragment, bricolage].map((f) => f.variable).join(" ")}>
      <body>{children}</body>
    </html>
  );
}
