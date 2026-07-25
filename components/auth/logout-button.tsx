"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
    >
      Keluar
    </button>
  );
}
