# CLAUDE.md — MYCOLOOP-AI

Konteks project untuk Claude Code. Baca `PRD.md` dan `TASKPLAN.md` di root sebelum mengerjakan task apa pun — dokumen ini hanya ringkasan kerja, bukan pengganti keduanya.

## Ringkasan Project

MYCOLOOP-AI adalah software untuk mengontrol dan memonitor **Smart Pre-Conditioning Chamber** produksi baglog jamur tiram dari limbah jagung pascapanen. Sistem menggantikan pendekatan *time-based* (48 jam tetap) dengan pendekatan *condition-based*: AI menilai kesiapan media sterilisasi dari data sensor real-time (suhu, kelembapan, pH).

Scope software mencakup: dashboard, backend API, AI decision engine (rule-based di MVP), dan integrasi IoT (MQTT dari ESP32). Alat fisik (mixer, shredder, chamber) di luar scope.

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
- Phase 0–4 adalah jalur kritis: bisa dikerjakan sepenuhnya tanpa hardware ESP32 (pakai sensor data simulator). Phase 5 (dashboard) boleh paralel dengan Phase 4 begitu API dasar sudah ada. Phase 6 (integrasi ESP32) baru dimulai setelah chamber fisik siap. Phase 7 (ML) adalah stretch goal.
- AI decision engine MVP adalah rule-based (threshold + moving average), bukan ML — jangan overengineer dengan model ML di awal.
- Development harus bisa jalan tanpa hardware fisik — selalu sediakan/gunakan data simulasi untuk testing sebelum chamber fisik selesai.
- Ikuti konvensi Next.js App Router standar (server components default, `"use client"` hanya saat perlu interaktivitas).
