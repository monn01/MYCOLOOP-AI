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
        background: "var(--color-background)",
        "background-subtle": "var(--color-background-subtle)",
        foreground: "var(--color-foreground)",
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
        border: "var(--color-border)",
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          foreground: "var(--color-primary-foreground)",
        },
        ring: "var(--color-ring)",
        status: {
          safe: "var(--color-status-safe)",
          "safe-bg": "var(--color-status-safe-bg)",
          "safe-border": "var(--color-status-safe-border)",
          progress: "var(--color-status-progress)",
          "progress-bg": "var(--color-status-progress-bg)",
          "progress-border": "var(--color-status-progress-border)",
          caution: "var(--color-status-caution)",
          "caution-bg": "var(--color-status-caution-bg)",
          "caution-border": "var(--color-status-caution-border)",
          danger: "var(--color-status-danger)",
          "danger-bg": "var(--color-status-danger-bg)",
          "danger-border": "var(--color-status-danger-border)",
          neutral: "var(--color-status-neutral)",
          "neutral-bg": "var(--color-status-neutral-bg)",
          "neutral-border": "var(--color-status-neutral-border)",
        },
      },
      fontSize: {
        metric: ["var(--font-size-metric)", { lineHeight: "1.1", fontWeight: "700" }],
        "metric-lg": ["var(--font-size-metric-lg)", { lineHeight: "1.1", fontWeight: "700" }],
      },
      borderRadius: {
        card: "var(--radius-lg)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
        toast: "var(--shadow-toast)",
      },
    },
  },
  plugins: [],
};
export default config;
