"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TAB_ITEMS } from "./nav-items";

/**
 * Mobile (<768px): bottom tab bar fixed, ganti sidebar (design.md §5.1).
 * 4 tab: satu per stage pipeline + Riwayat. Halaman Monitor tiap stage
 * dijangkau lewat shortcut "lihat detail monitor" di dashboard stage
 * masing-masing (sama seperti pola yang sudah ada), Akun lewat avatar Topbar.
 * Target tap minimal 44x44px (design.md §7).
 */
function isTabActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/monitor");
  return pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-border bg-card shadow-elevated md:hidden">
      {MOBILE_TAB_ITEMS.map((item) => {
        const active = isTabActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex min-w-[44px] flex-1 flex-col items-center justify-center gap-1 py-1.5 text-xs font-medium text-muted-foreground transition-colors active:scale-95"
          >
            <span
              className={`flex h-8 w-11 items-center justify-center rounded-full transition-all duration-150 ${
                active ? "bg-status-safe-bg" : ""
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-colors ${active ? "text-status-safe" : "text-muted-foreground"}`}
              />
            </span>
            <span className={`transition-colors ${active ? "font-semibold text-status-safe" : "text-muted-foreground"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
