import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-lg font-semibold text-foreground">MYCOLOOP-AI</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {session.user.name} ({session.user.role})
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="mt-8 text-sm text-muted-foreground">
        Login berhasil. Halaman Dashboard Utama (status chamber, summary cards, alert terbaru)
        menyusul di bagian berikutnya Phase 5.
      </main>
    </div>
  );
}
