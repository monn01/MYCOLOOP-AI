import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { AppShell } from "@/components/dashboard/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell userName={session.user.name ?? "Operator"} userRole={session.user.role}>
      {children}
    </AppShell>
  );
}
