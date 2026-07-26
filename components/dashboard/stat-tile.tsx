import type { ComponentType, SVGProps } from "react";

interface StatTileProps {
  label: string;
  value: string;
  positive?: boolean;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export function StatTile({ label, value, positive, icon: Icon }: StatTileProps) {
  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-green-100)] text-[var(--color-green-700)]">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-1 text-2xl font-bold ${positive ? "text-status-safe" : "text-card-foreground"}`}>{value}</p>
    </div>
  );
}
