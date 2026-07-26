import { defineConfig } from "vitest/config";
import path from "node:path";

// Resolve alias yang sama dengan tsconfig.json ("@/*" -> "./*") supaya file
// yang import pakai "@/..." (konvensi umum di app/lib) bisa ikut ditest tanpa
// harus ditulis ulang jadi relative import.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
