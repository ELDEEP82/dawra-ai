import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "../globals.css";
import { Providers } from "@/components/Providers";
import type { Lang } from "@/lib/types";

// Self-hosted IBM Plex (SIL OFL 1.1, from @fontsource 5.3.0 — see app/fonts/OFL.txt): the build never fetches fonts.
const plex = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});
const plexAr = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-ar",
  display: "swap",
  preload: true, // Arabic glyphs are above the fold in both languages (brand, toggle, AR headline)
  fallback: ["Segoe UI", "Tahoma", "Arial", "sans-serif"],
});

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "ar" }];
}

const META: Record<Lang, { title: string; description: string }> = {
  en: {
    title: "Dawra AI — smarter crop rotations for salty, dry farms",
    description:
      "NASA Earth observation + an AI optimiser compare a Ras Sudr farmer's rotation with 3-year plans in EGP and m³, stress-tested on 45 years of NASA climate and CMIP6 futures.",
  },
  ar: {
    title: "دورة — دورات زراعية أذكى للأراضي المالحة والناشفة",
    description: "بيانات ناسا والذكاء الاصطناعي بيقارنوا دورة المزارع في رأس سدر بخطط لـ 3 سنين بالجنيه والمتر المكعب، ومتجربة على 45 سنة مناخ ومستقبل CMIP6.",
  },
};

export function generateMetadata({ params }: { params: { lang: Lang } }): Metadata {
  const m = META[params.lang] ?? META.en;
  return {
    metadataBase: new URL("https://dawra-ai.vercel.app"),
    title: m.title,
    description: m.description,
    icons: { icon: "/icon.svg" },
    openGraph: { title: m.title, description: m.description, images: [{ url: "/og.png", width: 1200, height: 630, alt: "Dawra AI" }], type: "website", locale: params.lang === "ar" ? "ar_EG" : "en_US" },
    twitter: { card: "summary_large_image", title: m.title, description: m.description, images: ["/og.png"] },
  };
}

export const viewport: Viewport = { themeColor: "#FAFAF7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children, params }: { children: React.ReactNode; params: { lang: Lang } }) {
  const lang: Lang = params.lang === "ar" ? "ar" : "en";
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={`${plex.variable} ${plexAr.variable}`}>
      <body className="font-sans antialiased">
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
