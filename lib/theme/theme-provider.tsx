"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "mycoloop-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme harus dipakai di dalam ThemeProvider");
  return ctx;
}

/**
 * Toggle manual saja (design.md §8) — sengaja TIDAK auto-follow OS, karena
 * operator di lapangan siang hari terik sering butuh mode terang kontras
 * tinggi terlepas dari preferensi sistemnya.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setThemeState(stored === "dark" ? "dark" : "light");
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

/** Dipasang inline di <head> supaya class "dark" ke-apply sebelum hydration (anti-flash). */
export const THEME_NO_FLASH_SCRIPT = `
(function() {
  try {
    var theme = localStorage.getItem('${STORAGE_KEY}');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
