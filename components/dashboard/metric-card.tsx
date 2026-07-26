import type { ComponentType, SVGProps } from "react";
import {
  sensorZone,
  SENSOR_ZONE_TEXT_CLASSNAME,
  SENSOR_ZONE_DOT_CLASSNAME,
} from "@/lib/ui/status-styles";
import { CHART_COLORS } from "@/lib/ui/chart-colors";

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  range: { min: number; max: number };
  sparkline: number[];
  isLive: boolean;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Badge ikon selalu tint hijau (satu treatment konsisten), sengaja BUKAN
 * rainbow warna per jenis sensor seperti referensi desain — design.md §1/§10
 * melarang warna selain hijau/putih dipakai dekoratif (merah/amber cuma
 * untuk status, dan sistem ini sengaja tidak punya hue biru/oranye sama
 * sekali). "Hidup"-nya datang dari badge bulat + ikon, bukan dari palet baru.
 */
const ICON_BADGE_CLASSNAME = "bg-[var(--color-green-100)] text-[var(--color-green-700)]";

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <div className="h-8" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const width = 100;
  const height = 32;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={CHART_COLORS.green500} strokeWidth={2} />
    </svg>
  );
}

function RangeBar({ value, range }: { value: number; range: { min: number; max: number } }) {
  const span = range.max - range.min;
  const domainMin = range.min - span * 0.3;
  const domainMax = range.max + span * 0.3;
  const domainSpan = domainMax - domainMin || 1;

  const pct = (v: number) => Math.min(100, Math.max(0, ((v - domainMin) / domainSpan) * 100));
  const bandStart = pct(range.min);
  const bandEnd = pct(range.max);
  const markerPos = pct(value);
  const zone = sensorZone(value, range);

  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full bg-muted">
        <div
          className="absolute h-1.5 rounded-full bg-[var(--color-green-200)]"
          style={{ left: `${bandStart}%`, width: `${bandEnd - bandStart}%` }}
        />
        <div
          className={`absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white ${SENSOR_ZONE_DOT_CLASSNAME[zone]}`}
          style={{ left: `${markerPos}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{range.min}</span>
        <span>{range.max}</span>
      </div>
    </div>
  );
}

export function MetricCard({ label, value, unit, decimals = 1, range, sparkline, isLive, icon: Icon }: MetricCardProps) {
  const zone = sensorZone(value, range);

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card lg:p-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          {Icon && (
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ICON_BADGE_CLASSNAME}`}>
              <Icon className="h-4 w-4" />
            </span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse bg-status-progress" : "bg-status-neutral"}`}
            aria-hidden
          />
          {isLive ? "live" : "offline"}
        </span>
      </div>

      <p className={`mt-1 font-mono text-metric lg:text-metric-lg ${SENSOR_ZONE_TEXT_CLASSNAME[zone]}`}>
        {value.toFixed(decimals)}
        <span className="ml-1 text-lg font-normal text-muted-foreground">{unit}</span>
      </p>

      <Sparkline data={sparkline} />
      <RangeBar value={value} range={range} />
    </div>
  );
}
