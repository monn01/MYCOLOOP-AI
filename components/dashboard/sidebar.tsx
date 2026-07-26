"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, SHARED_NAV_ITEMS, type NavItem } from "./nav-items";
import { LogoMarkIcon } from "@/components/ui/icons";

/**
 * Desktop (>=1024px): sidebar penuh 240px dengan label, dikelompokkan per
 * stage pipeline. Tablet (768-1023px): collapse jadi ikon saja 64px (dengan
 * tooltip native lewat `title`). Mobile (<768px): disembunyikan, diganti
 * BottomNav (design.md §5.1).
 */
// Item yang punya sub-halaman detail (mis. /riwayat/[id]) tetap dianggap
// aktif di sub-halamannya. Item lain (termasuk "/mixing" vs "/mixing/monitor")
// HARUS exact match — keduanya sibling nav item, bukan parent-child, jadi
// prefix match di sini dulu keliru bikin "Dashboard" ikut menyala saat di
// "Monitor" karena "/mixing/monitor" kebetulan diawali "/mixing".
const PREFIX_MATCH_HREFS = ["/riwayat"];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    PREFIX_MATCH_HREFS.includes(href) ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        title={item.label}
        aria-current={active ? "page" : undefined}
        className={`group relative flex items-center gap-3 rounded-md py-2.5 pl-3.5 pr-3 text-sm font-medium outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-green-400)] ${
          active
            ? "bg-[var(--color-green-600)] text-white shadow-[0_1px_6px_rgba(0,0,0,0.35)]"
            : "text-white/55 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white active:scale-[0.98]"
        }`}
      >
        <span
          className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-green-300)] transition-opacity duration-150 ${
            active ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <Icon className={`h-5 w-5 shrink-0 transition-transform duration-150 ${active ? "" : "group-hover:scale-110"}`} />
        <span className="hidden lg:inline">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="hidden shrink-0 flex-col bg-[var(--color-sidebar-bg)] md:flex md:w-16 lg:w-64">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4 lg:h-16">
        <LogoMarkIcon className="h-6 w-6 shrink-0 text-[var(--color-green-400)]" />
        <span className="hidden text-sm font-semibold text-white lg:inline">MYCOLOOP-AI</span>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2 py-4">
        {NAV_GROUPS.map((group) => {
          const groupActive = group.items.some((item) => isActive(item.href));
          return (
            <div key={group.label}>
              <p
                className={`hidden items-center gap-1.5 px-3.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors lg:flex ${
                  groupActive ? "text-[var(--color-green-300)]" : "text-white/35"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    groupActive ? "bg-[var(--color-green-400)]" : "bg-white/20"
                  }`}
                  aria-hidden
                />
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-white/10 p-2 py-3">
        {SHARED_NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </div>
    </aside>
  );
}
