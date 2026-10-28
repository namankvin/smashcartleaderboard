import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: "#080c14",
          card: "#0f172a",
          cardHover: "#162038",
          border: "#1e293b",
          neonCyan: "#00f0ff",
          neonGreen: "#10b981",
          neonAmber: "#f59e0b",
          neonRose: "#f43f5e",
          neonPurple: "#a855f7",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      boxShadow: {
        "cyan-glow": "0 0 20px -3px rgba(0, 240, 255, 0.4)",
        "green-glow": "0 0 20px -3px rgba(16, 185, 129, 0.4)",
        "amber-glow": "0 0 20px -3px rgba(245, 158, 11, 0.4)",
        "rose-glow": "0 0 20px -3px rgba(244, 63, 94, 0.4)",
      },
      animation: {
        "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scanline": "scanline 8s linear infinite",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

