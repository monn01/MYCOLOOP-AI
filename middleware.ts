import withAuth from "next-auth/middleware";

/**
 * Lindungi semua halaman (bukan API route — endpoint Phase 3 sengaja
 * dibiarkan terbuka untuk sekarang) supaya /dashboard, /monitor, /riwayat
 * yang menyusul di Phase 5 otomatis ikut ter-proteksi tanpa perlu
 * getServerSession() berulang di tiap halaman.
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
