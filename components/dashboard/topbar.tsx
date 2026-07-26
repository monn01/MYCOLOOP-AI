"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { pageTitleForPath, stageForPath } from "./nav-items";
import { useActiveBatch } from "@/lib/hooks/use-active-batch";
import { BATCH_STATUS_STYLE } from "@/lib/ui/status-styles";
import { PipelineStage } from "@/lib/generated/prisma/enums";
import { BellIcon, UserIcon, SearchIcon } from "@/components/ui/icons";
import { LogoutButton } from "@/components/auth/logout-button";

interface TopbarProps {
  userName: string;
  userRole: string;
}

export function Topbar({ userName, userRole }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const stage = stageForPath(pathname);
  const { batch } = useActiveBatch(stage ?? PipelineStage.PRE_CONDITIONING);
  const [alertCount, setAlertCount] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/alerts?resolved=false&limit=50")
      .then((res) => res.json())
      .then((data) => setAlertCount(data.alerts?.length ?? 0))
      .catch(() => setAlertCount(0));
  }, []);

  const statusStyle = stage && batch ? BATCH_STATUS_STYLE[batch.status] : null;

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/riwayat?q=${encodeURIComponent(trimmed)}` : "/riwayat");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:h-16 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="hidden truncate text-lg font-semibold text-card-foreground md:block">{pageTitleForPath(pathname)}</h1>
        {statusStyle && (
          <span
            className={`hidden items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex ${statusStyle.badgeClassName}`}
          >
            {statusStyle.pulse && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />
            )}
            {statusStyle.label}
          </span>
        )}
      </div>

      <form onSubmit={handleSearchSubmit} className="hidden max-w-xs flex-1 md:block">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari data batch..."
            aria-label="Cari batch di Riwayat Produksi"
            className="w-full rounded-full border border-border bg-background-subtle py-1.5 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </form>

      <div className="flex items-center gap-3 lg:gap-4">
        <div className="relative">
          <BellIcon className="h-5 w-5 text-muted-foreground" />
          {alertCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-semibold text-white">
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </div>

        <Link
          href="/akun"
          className="hidden items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted sm:flex"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserIcon className="h-4 w-4" />
          </span>
          <span className="text-right">
            <p className="font-medium leading-tight text-card-foreground">{userName}</p>
            <p className="text-xs leading-tight text-muted-foreground">{userRole}</p>
          </span>
        </Link>

        <Link
          href="/akun"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground sm:hidden"
          aria-label="Akun"
        >
          <UserIcon className="h-4 w-4" />
        </Link>

        <LogoutButton />
      </div>
    </header>
  );
}
