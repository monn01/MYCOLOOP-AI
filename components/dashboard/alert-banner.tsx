import type { AlertType } from "@/lib/generated/prisma/enums";
import { ALERT_TYPE_STYLE } from "@/lib/ui/status-styles";
import { AlertTriangleIcon, CheckCircleSolidIcon, XCircleIcon } from "@/components/ui/icons";

export interface AlertBannerItem {
  id: string;
  type: AlertType;
  message: string;
}

interface AlertBannerProps {
  alerts: AlertBannerItem[];
  onDismiss: (id: string) => void;
}

/**
 * "Tutup" hanya menyembunyikan lokal, tidak mengubah Alert.resolved
 * (design.md §5.8 — itu aksi eksplisit terpisah dari halaman detail batch).
 */
export function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const style = ALERT_TYPE_STYLE[alert.type];
        const isDanger = style.tone === "danger";
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-card border-l-4 p-3 ${
              isDanger ? "bg-status-danger-bg border-l-status-danger" : "bg-status-safe-bg border-l-status-safe"
            }`}
          >
            {isDanger ? (
              <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-status-danger" />
            ) : (
              <CheckCircleSolidIcon className="mt-0.5 h-5 w-5 shrink-0 text-status-safe" />
            )}
            <div className="flex-1 text-sm">
              <p className={`font-semibold ${isDanger ? "text-status-danger" : "text-status-safe"}`}>{style.label}</p>
              <p className="text-card-foreground">{alert.message}</p>
            </div>
            <button
              onClick={() => onDismiss(alert.id)}
              aria-label="Tutup peringatan"
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
