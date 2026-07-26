"use client";

import { useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { sensorZone } from "@/lib/ui/status-styles";
import { CHART_COLORS } from "@/lib/ui/chart-colors";
import type { ParamConfig } from "@/lib/ui/param-configs";

export type SensorChartPoint = { timestamp: string } & Record<string, number | string>;

interface SensorChartProps {
  data: SensorChartPoint[];
  paramConfig: ParamConfig;
}

function formatTime(value: string) {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function domainFor(range: { min: number; max: number }): [number, number] {
  const span = range.max - range.min;
  return [range.min - span * 0.3, range.max + span * 0.3];
}

function CustomDot(param: string, paramConfig: ParamConfig) {
  return function Dot(props: { cx?: number; cy?: number; payload?: SensorChartPoint }) {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return null;
    const value = payload[param];
    if (typeof value !== "number") return null;
    const zone = sensorZone(value, paramConfig[param].range);
    if (zone === "safe") return null;
    const color = zone === "danger" ? CHART_COLORS.red600 : CHART_COLORS.amber600;
    return <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1} />;
  };
}

/**
 * Chart time-series generik dipakai di ketiga stage (Mixing/Pre-Conditioning/
 * Incubation) — parameter, warna, dan rentang aman datang dari `paramConfig`
 * (lib/ui/param-configs.ts), bukan hardcode di sini (design.md §5.5).
 */
export function SensorChart({ data, paramConfig }: SensorChartProps) {
  const paramKeys = Object.keys(paramConfig);
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(paramKeys.map((k) => [k, true]))
  );

  const toggle = (key: string) => setVisible((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card lg:p-6">
      <div className="mb-3 flex flex-wrap gap-2">
        {paramKeys.map((key) => {
          const cfg = paramConfig[key];
          const active = visible[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active ? "border-border bg-muted text-card-foreground" : "border-border text-muted-foreground opacity-50"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden />
              {cfg.label} ({cfg.range.min}-{cfg.range.max}
              {cfg.unit})
            </button>
          );
        })}
      </div>

      <div className="h-64 w-full lg:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.sage200} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fontSize: 11, fill: CHART_COLORS.sage500 }}
              minTickGap={40}
            />
            <Tooltip
              labelFormatter={(v) => formatTime(String(v))}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: CHART_COLORS.sage200 }}
            />

            {paramKeys.map((key) =>
              visible[key] ? <YAxis key={key} yAxisId={key} domain={domainFor(paramConfig[key].range)} hide /> : null
            )}

            {paramKeys.map((key) =>
              visible[key] ? (
                <ReferenceArea
                  key={`${key}-area`}
                  yAxisId={key}
                  y1={paramConfig[key].range.min}
                  y2={paramConfig[key].range.max}
                  fill="var(--color-status-safe-bg)"
                  fillOpacity={0.5}
                  ifOverflow="extendDomain"
                />
              ) : null
            )}
            {paramKeys.flatMap((key) =>
              visible[key]
                ? [
                    <ReferenceLine
                      key={`${key}-min`}
                      yAxisId={key}
                      y={paramConfig[key].range.min}
                      stroke={CHART_COLORS.green600}
                      strokeDasharray="4 4"
                    />,
                    <ReferenceLine
                      key={`${key}-max`}
                      yAxisId={key}
                      y={paramConfig[key].range.max}
                      stroke={CHART_COLORS.green600}
                      strokeDasharray="4 4"
                      label={{
                        value: `${paramConfig[key].range.max}${paramConfig[key].unit}`,
                        position: "right",
                        fontSize: 10,
                        fill: CHART_COLORS.sage600,
                      }}
                    />,
                  ]
                : []
            )}

            {paramKeys.map((key) =>
              visible[key] ? (
                <Line
                  key={key}
                  yAxisId={key}
                  dataKey={key}
                  name={`${paramConfig[key].label}${paramConfig[key].unit ? ` (${paramConfig[key].unit})` : ""}`}
                  stroke={paramConfig[key].color}
                  strokeDasharray={paramConfig[key].dash}
                  strokeWidth={2}
                  dot={CustomDot(key, paramConfig)}
                  isAnimationActive={false}
                />
              ) : null
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
