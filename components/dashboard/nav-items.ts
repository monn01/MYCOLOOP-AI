import type { ComponentType, SVGProps } from "react";
import { PipelineStage } from "@/lib/generated/prisma/enums";
import { GridIcon, GaugeIcon, HistoryIcon, UserIcon, ScaleIcon } from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface NavGroup {
  label: string;
  stage: PipelineStage;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  items: NavItem[];
}

/** Sidebar dikelompokkan per stage pipeline (lihat PRD.md §1.1). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Smart Mixing",
    stage: PipelineStage.MIXING,
    icon: ScaleIcon,
    items: [
      { href: "/mixing", label: "Dashboard", icon: GridIcon },
      { href: "/mixing/monitor", label: "Monitor", icon: GaugeIcon },
    ],
  },
  {
    label: "Smart Pre-Conditioning",
    stage: PipelineStage.PRE_CONDITIONING,
    icon: GaugeIcon,
    items: [
      { href: "/", label: "Dashboard", icon: GridIcon },
      { href: "/monitor", label: "Monitor", icon: GaugeIcon },
    ],
  },
  {
    label: "Smart Incubation",
    stage: PipelineStage.INCUBATION,
    icon: GridIcon,
    items: [
      { href: "/incubation", label: "Dashboard", icon: GridIcon },
      { href: "/incubation/monitor", label: "Monitor", icon: GaugeIcon },
    ],
  },
];

/** Item bersama, tidak terikat stage tertentu — dipin di bawah sidebar. */
export const SHARED_NAV_ITEMS: NavItem[] = [
  { href: "/riwayat", label: "Riwayat Produksi", icon: HistoryIcon },
  { href: "/akun", label: "Akun", icon: UserIcon },
];

/** 4 tab utama untuk bottom nav mobile — Akun dijangkau lewat avatar di Topbar. */
export const MOBILE_TAB_ITEMS: NavItem[] = [
  { href: "/mixing", label: "Mixing", icon: ScaleIcon },
  { href: "/", label: "Pre-Cond.", icon: GaugeIcon },
  { href: "/incubation", label: "Inkubasi", icon: GridIcon },
  { href: "/riwayat", label: "Riwayat", icon: HistoryIcon },
];

export function pageTitleForPath(pathname: string): string {
  if (pathname === "/") return "Dashboard Utama — Pre-Conditioning";
  if (pathname.startsWith("/monitor")) return "Pre-Conditioning Monitor";
  if (pathname === "/mixing") return "Dashboard Utama — Smart Mixing";
  if (pathname.startsWith("/mixing/monitor")) return "Smart Mixing Monitor";
  if (pathname === "/incubation") return "Dashboard Utama — Smart Incubation";
  if (pathname.startsWith("/incubation/monitor")) return "Smart Incubation Monitor";
  if (pathname.startsWith("/riwayat")) return "Riwayat Produksi";
  if (pathname.startsWith("/akun")) return "Akun";
  return "MYCOLOOP-AI";
}

/** Stage aktif berdasarkan path saat ini — dipakai Topbar untuk chip status chamber. null di halaman lintas-stage (Riwayat/Akun). */
export function stageForPath(pathname: string): PipelineStage | null {
  if (pathname === "/" || pathname.startsWith("/monitor")) return PipelineStage.PRE_CONDITIONING;
  if (pathname.startsWith("/mixing")) return PipelineStage.MIXING;
  if (pathname.startsWith("/incubation")) return PipelineStage.INCUBATION;
  return null;
}
