import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme colors inspired by Qiespend design
        background: {
          DEFAULT: "#0a0a0a",
          secondary: "#111111",
          card: "#141414",
          elevated: "#1a1a1a",
        },
        foreground: {
          DEFAULT: "#ffffff",
          muted: "#a1a1a1",
          subtle: "#666666",
        },
        accent: {
          DEFAULT: "#c8ff00", // Lime green
          hover: "#d4ff33",
          muted: "#c8ff0020",
        },
        border: {
          DEFAULT: "#262626",
          subtle: "#1f1f1f",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        error: "#ef4444",
      },
      borderRadius: {
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(0, 0, 0, 0.4)",
        glow: "0 0 20px rgba(200, 255, 0, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
