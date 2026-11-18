import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"),
        surface: c("surface"),
        "surface-2": c("surface-2"),
        line: c("line"),
        ink: c("ink"),
        muted: c("muted"),
        brand: { DEFAULT: c("brand"), soft: c("brand-soft"), ink: c("brand-ink") },
        sun: { DEFAULT: c("sun"), soft: c("sun-soft") },
        coral: { DEFAULT: c("coral"), soft: c("coral-soft") },
        sky: { DEFAULT: c("sky"), soft: c("sky-soft") },
        leaf: { DEFAULT: c("leaf"), soft: c("leaf-soft") },
        slate2: { DEFAULT: c("slate2"), soft: c("slate2-soft") },
        sidebar: { DEFAULT: c("sidebar"), 2: c("sidebar-2") },
        accent: c("accent"),
        hl: c("hl"),
        wa: { DEFAULT: "#25D366", dark: "#075E54", bubble: c("wa-bubble"), chat: c("wa-chat") },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "14px", "2xl": "18px", "3xl": "24px" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.05), 0 6px 20px -8px rgb(var(--shadow) / 0.12)",
        pop: "0 12px 40px -12px rgb(var(--shadow) / 0.35)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "scale-in": { from: { opacity: "0", transform: "scale(.97)" }, to: { opacity: "1", transform: "none" } },
        "slide-in": { from: { transform: "translateX(-100%)" }, to: { transform: "none" } },
        blink: { "0%,80%,100%": { opacity: ".25" }, "40%": { opacity: "1" } },
      },
      animation: {
        "fade-up": "fade-up .25s ease-out both",
        "scale-in": "scale-in .18s ease-out both",
        "slide-in": "slide-in .22s ease-out both",
        blink: "blink 1.2s infinite both",
      },
    },
  },
  plugins: [],
} satisfies Config;
