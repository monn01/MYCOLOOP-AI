import type { SVGProps } from "react";

/**
 * Ikon inline minimal (bukan library eksternal) — dipakai untuk pembeda
 * status di luar warna (design.md §1, §4.2: dua status hijau "safe" vs
 * "progress" wajib beda ikon, bukan cuma shade).
 */

export function CheckCircleSolidIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.53-9.03a.75.75 0 10-1.06-1.06L9 11.44l-1.47-1.47a.75.75 0 10-1.06 1.06l2 2a.75.75 0 001.06 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CheckCircleOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M7 10.2l2 2 4-4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function XCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 10-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function AlertTriangleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M9.257 2.868a1.75 1.75 0 011.486 0c.34.16.55.43.677.65.128.222.245.494.354.75l6.03 11.522c.113.24.213.516.264.777.052.264.073.632-.098.99-.17.359-.457.573-.71.69a1.75 1.75 0 01-.79.178H3.53a1.75 1.75 0 01-.79-.178c-.253-.117-.54-.331-.71-.69-.17-.358-.15-.726-.098-.99.05-.26.15-.537.264-.777L8.226 4.268c.109-.256.226-.528.354-.75.127-.22.337-.49.677-.65zM10 7a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 7zm0 7a.9.9 0 100-1.8.9.9 0 000 1.8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M10 2a5 5 0 00-5 5v2.379a2 2 0 01-.586 1.414L3 12.207V14h14v-1.793l-1.414-1.414A2 2 0 0115 9.379V7a5 5 0 00-5-5zM8.5 16.5a1.5 1.5 0 003 0h-3z" />
    </svg>
  );
}

export function GaugeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} {...props}>
      <path d="M12 3a9 9 0 100 18 9 9 0 000-18z" strokeLinecap="round" />
      <path d="M12 12l4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DropletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} {...props}>
      <path
        d="M12 3s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlaskIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} {...props}>
      <path d="M9 3h6M10 3v6.5L4.8 18a2 2 0 001.7 3h11a2 2 0 001.7-3L14 9.5V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WindIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} {...props}>
      <path
        d="M3 8h10a2.5 2.5 0 10-2.5-2.5M3 12h13a2.5 2.5 0 11-2.5 2.5M3 16h7a2 2 0 102-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 6v4l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} {...props}>
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" />
    </svg>
  );
}

export function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path
        d="M4 10a6 6 0 116 6H8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 10V6M4 10h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 7v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <circle cx="10" cy="6.5" r="3.25" />
      <path d="M3.5 17c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M6.5 9V6.5a3.5 3.5 0 017 0V9" strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <circle cx="10" cy="10" r="3.5" />
      <path
        d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1L4.7 4.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M17.3 12.5A7.5 7.5 0 018 3.2a.6.6 0 00-.7-.8A8.5 8.5 0 1017.9 13a.6.6 0 00-.6-.5z" />
    </svg>
  );
}

export function ThermometerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path
        d="M11.5 11.36V4.5a1.5 1.5 0 00-3 0v6.86a3 3 0 103 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 7.5v4" strokeLinecap="round" />
    </svg>
  );
}

export function CloudIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path
        d="M6 15h8a3 3 0 000-6 4.5 4.5 0 00-8.7-1.5A3.5 3.5 0 006 15z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ScaleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M10 3v14M6 17h8M4 7h4M12 7h4M4 7l-1.5 4a2.5 2.5 0 005 0L6 7zM16 7l-1.5 4a2.5 2.5 0 005 0L18 7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16.5 16.5l-3.6-3.6" strokeLinecap="round" />
    </svg>
  );
}

export function BotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} {...props}>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 8V4M9 4h6" strokeLinecap="round" />
      <circle cx="9" cy="14" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.25" fill="currentColor" stroke="none" />
      <path d="M9 17.5h6" strokeLinecap="round" />
      <path d="M2 13h2M20 13h2" strokeLinecap="round" />
    </svg>
  );
}

export function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M2.94 2.94a.75.75 0 01.82-.17l14 5.5a.75.75 0 010 1.4l-14 5.5a.75.75 0 01-1-.9l1.65-5.03a.25.25 0 01.24-.17h6.85a.75.75 0 000-1.5H4.65a.25.25 0 01-.24-.17L2.76 3.94a.75.75 0 01.18-1z" />
    </svg>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} {...props}>
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

export function LogoMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} {...props}>
      <path
        d="M12 3c-3 3-7 6.5-7 10.5A7 7 0 0012 21a7 7 0 007-7.5C19 9.5 15 6 12 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
