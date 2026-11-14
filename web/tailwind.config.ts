import type { Config } from "tailwindcss";

// Brand palette: deep navy primary + bright cyan accent on cool gray-blue surfaces
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#EEF4F7",
          100: "#DCE7ED",
          600: "#15607F",
          700: "#0F4F6E",
          800: "#0A3D57", // primary
          900: "#072F45",
        },
        brand: {
          50: "#EAF7FD",
          100: "#CDEDFA",
          200: "#9EDCF5",
          300: "#62C6EE",
          400: "#2DB2E8",
          500: "#0E9FDC", // accent cyan
          600: "#0B85BA",
          700: "#0A6A94",
          800: "#0A5677",
          900: "#08435C",
        },
        coral: {
          400: "#F7A04B",
          500: "#F08A24", // attention (pending items)
          600: "#D9730F",
        },
        surface: "#E4ECF1",
        ink: {
          DEFAULT: "#0A2D40",
          soft: "#4E6472",
          muted: "#8597A2",
        },
        risk: {
          low: "#22C55E",
          moderate: "#EAB308",
          high: "#F97316",
          malignant: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-readex)", "system-ui", "sans-serif"],
      },
      // Type scale (ratio ≈1.25), line-heights tuned for Arabic ascenders/descenders
      fontSize: {
        "display": ["3.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "display-sm": ["2.5rem", { lineHeight: "1.25" }],
        "title": ["2.125rem", { lineHeight: "1.3" }],
        "lead": ["1.1875rem", { lineHeight: "1.85" }],
      },
      boxShadow: {
        card: "0 12px 32px -14px rgba(10, 61, 87, 0.28)",
      },
    },
  },
  plugins: [],
};
export default config;
