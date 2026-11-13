import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });
const plexAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-plex-ar", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dawra-ai.vercel.app"),
  title: "Dawra AI — دورة · smarter crop rotations for salty, dry farms",
  description:
    "From space to the field: NASA Earth observation + an AI optimiser compare a Ras Sudr farmer's rotation with 3-year plans in EGP and m³, stress-tested on 45 years of NASA climate and CMIP6 futures. دورات زراعية أذكى للأراضي المالحة والناشفة ببيانات ناسا.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Dawra AI — دورة",
    description: "Smarter crop rotations for salty, dry farms — powered by NASA data. NASA Space Apps Cairo 2026, Team TerraNex.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Dawra AI — from space to the field" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Dawra AI — دورة", description: "Smarter crop rotations for salty, dry farms — powered by NASA data.", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#FAFAF7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${plex.variable} ${plexAr.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
