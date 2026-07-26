import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { UserIcon, LockIcon, SunIcon } from "@/components/ui/icons";

export default async function AkunPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="max-w-lg space-y-6 lg:space-y-8">
      <div className="rounded-card border border-border bg-card p-4 shadow-card lg:p-6">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-card-foreground">Profil</h2>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Nama</dt>
            <dd className="font-medium text-card-foreground">{session?.user.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-card-foreground">{session?.user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium text-card-foreground">{session?.user.role}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-card border border-border bg-card p-4 shadow-card lg:p-6">
        <div className="flex items-center gap-2">
          <LockIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-card-foreground">Ubah Password</h2>
        </div>
        <ChangePasswordForm />
      </div>

      <div className="rounded-card border border-border bg-card p-4 shadow-card lg:p-6">
        <div className="flex items-center gap-2">
          <SunIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-card-foreground">Pengaturan Tampilan</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Mode terang/gelap dipilih manual, tidak mengikuti sistem — supaya tetap kontras tinggi saat dipakai di lapangan siang hari.
        </p>
        <div className="mt-3">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
