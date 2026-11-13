import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        space: { 950: "#050814", 900: "#0a1024", 800: "#111a35", 700: "#1a2547", 600: "#26345f" },
        nasa: { cyan: "#4cc9f0", amber: "#f9c74f", green: "#90be6d", red: "#f94144", violet: "#b388ff" },
      },
      fontFamily: {
        sans: ["var(--font-plex)", "var(--font-plex-ar)", "system-ui", "sans-serif"],
        ar: ["var(--font-plex-ar)", "var(--font-plex)", "system-ui", "sans-serif"],
      },
      boxShadow: { glow: "0 0 0 1px rgba(76,201,240,.25), 0 8px 30px rgba(76,201,240,.12)" },
    },
  },
  plugins: [],
};
export default config;
