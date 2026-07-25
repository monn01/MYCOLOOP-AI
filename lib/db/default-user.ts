import { prisma } from "./client";

/**
 * Sebelum NextAuth ada (Phase 5), API dan script standalone (seed, simulator)
 * butuh seorang "operator" untuk diisi ke `createdById`. Pakai user pertama
 * yang ada, atau buat akun placeholder kalau database masih kosong.
 */
export async function getOrCreateDefaultUser() {
  const existing = await prisma.user.findFirst();
  if (existing) return existing;

  return prisma.user.create({
    data: {
      name: "Simulator",
      email: "simulator@mycoloop.ai",
      password: "simulator-account-no-login",
      role: "OPERATOR",
    },
  });
}
