"use client";

import { useState } from "react";
import { BotIcon, XIcon } from "@/components/ui/icons";
import { AssistantPanel } from "./assistant-panel";

/**
 * Floating action button + panel overlay, dipasang global di AppShell supaya
 * asisten AI (baca-saja, lihat lib/ai-assistant/) bisa diakses dari halaman
 * mana pun — bukan bagian dari nav utama karena sifatnya overlay, bukan page.
 */
export function AssistantLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Tutup asisten AI" : "Buka asisten AI"}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        {open ? <XIcon className="h-6 w-6" /> : <BotIcon className="h-6 w-6" />}
      </button>

      {open && <AssistantPanel onClose={() => setOpen(false)} />}
    </>
  );
}
