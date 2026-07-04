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
        background: "#0F1923",
        foreground: "#F5F7FA",
        surface: {
          DEFAULT: "#162230",
          raised: "#1C2B3A",
          border: "#22303F",
        },
        teal: {
          DEFAULT: "#00D4AA",
          50: "#E0FBF5",
          100: "#B3F5E4",
          400: "#1FE0BC",
          500: "#00D4AA",
          600: "#00A886",
          700: "#007D63",
        },
        blue: {
          DEFAULT: "#4A9EFF",
          50: "#EAF3FF",
          100: "#C7E1FF",
          400: "#6BAEFF",
          500: "#4A9EFF",
          600: "#2E7FE0",
          700: "#1E5FB0",
        },
        muted: {
          DEFAULT: "#8FA0B3",
          foreground: "#B5C0CC",
        },
        danger: "#FF5C6C",
        warning: "#FFB84A",
        success: "#00D4AA",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-teal-blue": "linear-gradient(135deg, #00D4AA 0%, #4A9EFF 100%)",
        "gradient-radial-glow":
          "radial-gradient(60% 60% at 50% 0%, rgba(0,212,170,0.15) 0%, rgba(15,25,35,0) 100%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,212,170,0.15), 0 8px 24px -8px rgba(0,212,170,0.25)",
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.5)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
