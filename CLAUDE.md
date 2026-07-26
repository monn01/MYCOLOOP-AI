# CLAUDE.md — MYCOLOOP-AI

Konteks project untuk Claude Code. Baca `PRD.md` dan `TASKPLAN.md` di root sebelum mengerjakan task apa pun — dokumen ini hanya ringkasan kerja, bukan pengganti keduanya.

## Ringkasan Project

MYCOLOOP-AI adalah software untuk mengontrol dan memonitor seluruh pipeline produksi baglog jamur tiram dari limbah jagung pascapanen, lewat 3 stage: **Smart Mixing**, **Smart Pre-Conditioning**, dan **Smart Incubation Monitoring**. Sistem menggantikan pendekatan *time-based* (jadwal tetap) dengan pendekatan *condition-based*: AI menilai kesiapan tiap stage dari data sensor real-time (Mixing: kadar air/rasio C:N; Pre-Conditioning: suhu/kelembapan/pH; Incubation: suhu/kelembapan/CO2/cahaya + deteksi dini kontaminasi berbasis pola sensor).

Scope software mencakup: dashboard (satu sidebar, dikelompokkan per stage), backend API, AI decision engine per stage (rule-based di MVP), dan integrasi IoT (MQTT dari ESP32). Alat fisik (mixer, shredder, chamber, rak inkubasi) di luar scope.

Detail lengkap (arsitektur 5 layer, fitur MVP, model data, non-goals, metrik keberhasilan) ada di `PRD.md`.

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes / Route Handlers |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth |
| Real-time | MQTT (mqtt.js) + WebSocket/SSE |
| Grafik | Recharts |
| Firmware | ESP32 (Arduino/PlatformIO, C++) — di luar scope Claude Code, dikerjakan tim hardware |
| AI (MVP) | TypeScript rule-based logic (`lib/ai/`) |
| AI (Roadmap) | Python (scikit-learn) via microservice FastAPI |
| AI Assistant | Google Gemini API, REST langsung tanpa SDK (`lib/ai-assistant/`) — read-only, lihat konvensi di bawah |

## Struktur Folder

```
app/            # Next.js App Router: pages, layouts, API route handlers
lib/            # Business logic: AI engine, DB client, MQTT bridge, utils
components/     # React components (dashboard, chart, forms, dll)
prisma/         # schema.prisma, migrations, seed script
```

## Konvensi Kerja

- **Module-by-module sesuai `TASKPLAN.md`.** Kerjakan phase secara berurutan (Phase 0 → 1 → 2 → ...). Jangan loncat ke phase berikutnya sebelum checklist phase saat ini selesai, kecuali user secara eksplisit minta lain.
- **Update checklist di `TASKPLAN.md` setiap satu task selesai** — ubah `- [ ]` menjadi `- [x]` untuk item yang sudah beres, jangan menunggu sampai seluruh phase selesai baru update.
- Phase 0–4 adalah jalur kritis: bisa dikerjakan sepenuhnya tanpa hardware ESP32 (pakai sensor data simulator). Phase 5/5b/5c/5d (dashboard ketiga stage + navigasi) boleh paralel dengan Phase 4 begitu API dasar sudah ada. Phase 6 (integrasi ESP32) baru dimulai setelah alat fisik siap. Phase 7 (ML) adalah stretch goal.
- AI decision engine MVP adalah rule-based (threshold + moving average) di ketiga stage, bukan ML — jangan overengineer dengan model ML atau computer vision sungguhan di awal (termasuk deteksi kontaminasi Incubation, lihat `PRD.md` §5).
- Development harus bisa jalan tanpa hardware fisik — selalu sediakan/gunakan data simulasi (satu simulator per stage di `scripts/`) untuk testing sebelum alat fisik selesai.
- `ReadinessStatus`/`AIDecision`/`Alert` dipakai bersama ketiga stage (bukan model/enum terpisah per stage) — label tampilan yang beda per stage di-map di `lib/ui/status-styles.ts`, jangan rename enum value.
- **AI Assistant (Gemini) wajib read-only** — jangan pernah tambahkan kemampuan eksekusi aksi (function calling yang mengubah data) tanpa diskusi eksplisit dengan user dulu, ini keputusan produk sadar bukan keterbatasan teknis (lihat `PRD.md` §7.8).
- Phase 6 (ESP32) dan Phase 7 (ML) sama-sama terblokir tanpa hardware/data nyata — Phase 7 BUKAN jalan pintas kalau Phase 6 belum bisa jalan (butuh 20-30 batch data historis asli, bukan simulasi). Kalau user tanya "mau lanjut ke fase mana" saat Phase 6 terblokir, tawarkan Phase 5e atau Phase 8, bukan loncat ke Phase 7.
- Ikuti konvensi Next.js App Router standar (server components default, `"use client"` hanya saat perlu interaktivitas).
