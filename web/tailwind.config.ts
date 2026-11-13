import type { Config } from "tailwindcss";

/**
 * Light design system. Legacy colour names used across components are remapped to the light palette:
 * `white` → ink (so `text-white`, `border-white/10`, `bg-white/5` become ink tints on paper),
 * `slate` → readable greys (WCAG AA on white), `space` → paper surfaces, `nasa` → brand colours.
 */
const ink = "#14201B";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: ink,
        paper: "#FFFFFF",
        canvas: "#FAFAF7",
        line: "#E8E8E3",
        ink,
        muted: "#5E6B66",
        brand: { DEFAULT: "#0F6B4F", leaf: "#2BB673", sky: "#2D8CFF", sand: "#E8A23A", risk: "#E5533D", soft: "#E7F3EC" },
        "sand-ink": "#8A5A0B",
        space: { 950: "#FAFAF7", 900: "#F3F3EE", 800: "#ECECE6", 700: "#E2E2DA", 600: "#D6D6CD" },
        nasa: { cyan: "#0F6B4F", amber: "#E8A23A", green: "#1F9D5F", red: "#E5533D", violet: "#7C5CDB" },
        slate: { 100: "#2A3631", 200: "#24302B", 300: "#33403B", 400: "#5E6B66", 500: "#66726D", 600: "#7A857F" },
        emerald: { 200: "#0F6B4F", 300: "#0F7A55", 400: "#2BB673" },
        amber: { 200: "#8A5A0B", 300: "#8F5E00", 400: "#E8A23A" },
        rose: { 300: "#C2412D", 400: "#E5533D" },
      },
      fontFamily: {
        sans: ["var(--font-plex)", "var(--font-plex-ar)", "system-ui", "sans-serif"],
        ar: ["var(--font-plex-ar)", "var(--font-plex)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "22px" },
      boxShadow: {
        card: "0 1px 2px rgba(20,32,27,.04), 0 8px 24px -12px rgba(20,32,27,.12)",
        lift: "0 2px 6px rgba(20,32,27,.06), 0 24px 48px -20px rgba(15,107,79,.28)",
        glow: "0 10px 30px -10px rgba(15,107,79,.45)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
      },
      animation: { shimmer: "shimmer 1.4s linear infinite" },
    },
  },
  plugins: [],
};
export default config;
