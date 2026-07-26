import { ReadinessStatus, type PipelineStage } from "@/lib/generated/prisma/enums";
import { READINESS_STATUS_STYLE, getReadinessLabel } from "@/lib/ui/status-styles";
import { CheckCircleSolidIcon, ClockIcon } from "@/components/ui/icons";

export interface DecisionEntry {
  id: string;
  timestamp: string;
  status: ReadinessStatus;
  confidence: number;
  reasoning: string;
}

interface AIDecisionPanelProps {
  decisions: DecisionEntry[];
  stage: PipelineStage;
}

function formatClock(value: string) {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AIDecisionPanel({ decisions, stage }: AIDecisionPanelProps) {
  const latest = decisions[0] ?? null;
  const history = decisions.slice(0, 5);
  const latestStyle = latest ? READINESS_STATUS_STYLE[latest.status] : null;

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card lg:p-6">
      <div className="flex items-center gap-2">
        <ClockIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-card-foreground">AI Decision Hub</h2>
        {latestStyle && latest && (
          <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${latestStyle.badgeClassName}`}>
            {latestStyle.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
            {getReadinessLabel(latest.status, stage)}
          </span>
        )}
      </div>

      {latest ? (
        <>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>AI Confidence</span>
              <span className="font-mono font-semibold text-card-foreground">
                {Math.round(latest.confidence * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-status-progress"
                style={{ width: `${Math.round(latest.confidence * 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reasoning Logic</p>
            <p className="mt-1 text-sm text-card-foreground">{latest.reasoning}</p>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Belum ada keputusan AI untuk batch ini.</p>
      )}

      {history.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision Timeline</p>
          <ol className="mt-2 space-y-3 border-l border-status-neutral-border pl-3">
            {history.map((d) => {
              const style = READINESS_STATUS_STYLE[d.status];
              return (
                <li key={d.id} className="relative text-sm">
                  <span
                    className={`absolute -left-[17px] top-1 h-2.5 w-2.5 rounded-full ${
                      style.tone === "safe"
                        ? "bg-status-safe"
                        : style.tone === "caution"
                          ? "bg-status-caution"
                          : "bg-status-progress"
                    }`}
                    aria-hidden
                  />
                  <div className="flex items-center gap-2">
                    {style.tone === "safe" && <CheckCircleSolidIcon className="h-3.5 w-3.5 text-status-safe" />}
                    <span className="font-medium text-card-foreground">{getReadinessLabel(d.status, stage)}</span>
                    <span className="text-xs text-muted-foreground">{formatClock(d.timestamp)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
