/**
 * Mirror hex value dari app/globals.css (design.md §3.1) khusus untuk dipakai
 * di prop SVG Recharts (stroke/fill) — atribut presentasi SVG yang di-render
 * lewat prop React tidak selalu resolve var(--...) secara konsisten lintas
 * browser, jadi dihardcode di sini alih-alih bergantung pada CSS custom
 * property saat runtime.
 */
export const CHART_COLORS = {
  green300: "#6ee7b7",
  green500: "#10b981",
  green600: "#059669",
  green700: "#047857",
  sage200: "#dce5de",
  sage500: "#6b8072",
  sage600: "#4f6355",
  sage900: "#16201a",
  amber500: "#f59e0b",
  amber600: "#d97706",
  red500: "#ef4444",
  red600: "#dc2626",
} as const;
