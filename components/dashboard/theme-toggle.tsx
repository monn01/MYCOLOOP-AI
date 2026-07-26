"use client";

import { useTheme } from "@/lib/theme/theme-provider";
import { SunIcon, MoonIcon } from "@/components/ui/icons";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex rounded-md border border-border p-1 text-sm">
      <button
        onClick={() => setTheme("light")}
        className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
          theme === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        <SunIcon className="h-4 w-4" />
        Terang
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
          theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        <MoonIcon className="h-4 w-4" />
        Gelap
      </button>
    </div>
  );
}
