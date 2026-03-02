import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#13131a",
        "surface-2": "#1a1a24",
        border: "#1e1e2e",
        primary: "#7c3aed",
        "primary-hover": "#6d28d9",
        "primary-muted": "#3b1f6e",
        accent: "#a855f7",
        text: "#e2e8f0",
        muted: "#64748b",
        "muted-dark": "#374151",
        success: "#22c55e",
        warning: "#f59e0b",
        error: "#ef4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
