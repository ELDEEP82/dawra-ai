import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import "../globals.css";
import { Providers } from "@/components/Providers";
import type { Lang } from "@/lib/types";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-plex", display: "swap" });
const plexAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "600"], variable: "--font-plex-ar", display: "swap" });

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
