# TASKPLAN.md — MYCOLOOP-AI Software System

Urutan pengerjaan disusun agar development tidak terblokir oleh progres alat fisik. Phase 0–5e sepenuhnya bisa dikerjakan lewat Claude Code tanpa hardware. Phase 6 baru butuh ESP32 fisik — dan Phase 7 (ML) juga baru realistis dikerjakan setelah itu, karena butuh data batch historis nyata (bukan simulasi), bukan sekadar loncatan untuk menghindari Phase 6.

> **Konteks scope:** MYCOLOOP-AI punya 3 stage pipeline produksi (Smart Mixing → Smart Pre-Conditioning → Smart Incubation Monitoring). Phase 0–5 awalnya cuma menggarap **Stage 2 (Smart Pre-Conditioning)**; Phase 5b dan 5c menyusul menggarap Stage 1 dan Stage 3 penuh (data model, AI engine, simulator, dashboard) — ketiganya berbagi model `Batch`/`AIDecision`/`Alert`, tapi masing-masing punya reading model & AI evaluator sendiri karena parameter sensornya beda. Detail lihat `PRD.md` §1.1.

---

## Phase 0 — Project Setup

- [x] Scaffold project Next.js 14 (App Router) + TypeScript + Tailwind
- [x] Setup koneksi Prisma (skeleton siap; provisioning DB Neon/Supabase aktual masih perlu dilakukan user — isi `DATABASE_URL` di `.env`)
- [x] Setup struktur folder: `app/`, `lib/`, `components/`, `prisma/`
- [x] Setup `CLAUDE.md` untuk konteks project (stack, konvensi, struktur)
- [x] Init git repo, `.env.example`

## Phase 1 — Data Model (Prisma Schema)

- [x] Definisikan model `Batch`, `SensorReading`, `AIDecision`, `Alert`, `User`
- [x] Jalankan migrasi awal (`prisma migrate dev`) — dijalankan ke Postgres lokal via Docker (`mycoloop-postgres` container); ganti `DATABASE_URL` di `.env` saat pindah ke Neon/Supabase
- [x] Buat seed script untuk data dummy (`prisma/seed.ts`, jalankan via `npm run db:seed`) — 3 batch contoh (COMPLETED/READY/RUNNING) lengkap dengan sensor reading, AI decision, dan alert
- [x] Verifikasi schema — dicek lewat query count/relasi (2 users, 3 batches, 195 sensor readings, 51 AI decisions, 3 alerts, semua konsisten); buka `npm run db:studio` untuk inspeksi visual manual

## Phase 2 — Sensor Data Simulator

- [x] Buat script simulator (`scripts/simulate.ts`, Node.js standalone) yang generate data suhu/kelembapan/pH dengan kurva realistis (basah & panas di awal → stabil menjelang siap), kurva dibagi dengan `prisma/seed.ts` lewat `lib/simulator/curve.ts`
- [x] Simulator insert data ke `SensorReading` tiap beberapa detik (`--interval`) untuk batch yang sedang `RUNNING`, dengan progress yang bisa dipercepat (`--speed`) dan lanjut otomatis kalau dihentikan/dijalankan ulang
- [x] Tambahkan mode simulasi anomali (`--anomaly suhu|ph`) untuk testing alert
- [x] Dokumentasikan cara menjalankan simulator (`npm run simulate`) — lihat README.md

## Phase 3 — Backend: API & Real-time

- [x] Buat API route CRUD `Batch` (create, get, list, update status) — `app/api/batches/route.ts` (GET list + filter status/limit, POST create) dan `app/api/batches/[id]/route.ts` (GET detail, PATCH status/formula/endTime)
- [x] Buat API route GET `SensorReading` (dengan filter batchId, range waktu) — `app/api/sensor-readings/route.ts`, mendukung `batchId` (wajib), `from`/`to`, `limit`
- [x] Setup WebSocket/SSE endpoint untuk push data sensor real-time ke client — `app/api/stream/sensor-readings/route.ts`, polling DB tiap 2 detik lalu push lewat SSE
- [x] (Untuk nanti) siapkan MQTT subscriber bridge — `lib/mqtt/bridge.ts` (stub inert, diisi real MQTT client di Phase 6)
- [x] Testing endpoint dengan data dari simulator Phase 2 — dicek manual via curl (list/filter/create/patch/404/400) dan SSE live-tested sambil `npm run simulate` jalan (event `reading` muncul persis saat simulator insert)

## Phase 4 — AI Decision Engine (Rule-Based)

- [x] Tulis function `evaluateReadiness(readings: SensorReadingInput[]): AIDecisionResult` di `lib/ai/evaluateReadiness.ts`
- [x] Implementasi logic threshold: suhu 25–35°C, pH 6–7, kelembapan 60–65%
- [x] Implementasi moving average & rate-of-change untuk smoothing data noise (window 5 pembacaan, dibandingkan dengan window sebelumnya untuk menilai stabil/masih trending)
- [x] Implementasi anomaly detection (lonjakan suhu tiba-tiba, drop pH drastis) — deteksi delta antar dua pembacaan berurutan
- [x] Buat unit test untuk skenario: media belum siap, media siap, dalam proses, kondisi anomali (suhu & pH) — `lib/ai/evaluateReadiness.test.ts`, 8 test lolos via `npm run test` (Vitest)
- [x] Hubungkan AI engine ke pipeline: setiap data sensor baru masuk → jalankan evaluasi → simpan ke `AIDecision` — `lib/sensors/ingest.ts` jadi titik masuk tunggal (dipakai simulator sekarang, MQTT bridge nanti); anomali & transisi ke siap sterilisasi otomatis bikin `Alert` dan update `Batch.status` ke `READY`

## Phase 5 — Dashboard UI

- [x] Setup NextAuth untuk login operator — Credentials provider (bcrypt vs `User.password`), JWT session dengan `id`/`role`, halaman `/login` custom, middleware proteksi semua halaman non-API. Dites end-to-end (login salah/benar, session, logout) via curl memakai user hasil seed
- [x] Halaman Dashboard Utama: status chamber, summary cards, alert terbaru — `app/(dashboard)/page.tsx`, Hero Card + 3 Metric Card (suhu/kelembapan/pH dengan sparkline + range bar) + Alert Banner + shortcut ke Monitor, live via SSE (`lib/hooks/use-batch-stream.ts`)
- [x] Halaman Pre-Conditioning Monitor: grafik time-series (Recharts), threshold line, status AI decision live — `app/(dashboard)/monitor/page.tsx`, `SensorChart` (ReferenceArea+ReferenceLine per parameter, toggle legend), `AIDecisionPanel` (confidence + reasoning + timeline 5 keputusan terakhir), `AerationControl` (UI-only, aktuator fisik menyusul Phase 6)
- [x] Halaman Riwayat Produksi: daftar batch, detail per-batch, statistik agregat — `app/(dashboard)/riwayat/page.tsx` (stat tile + tabel/card list responsif) dan `app/(dashboard)/riwayat/[id]/page.tsx` (chart historis + timeline AIDecision/Alert kronologis)
- [x] Notifikasi UI (toast/banner) saat status berubah jadi "siap sterilisasi" atau saat alert anomali muncul — `ToastProvider` + `AlertBanner`, dipicu dari event SSE `decision`/`alert` (endpoint stream diperluas, lihat `app/api/stream/sensor-readings/route.ts`)
- [x] Responsive check (mobile/tablet, karena operator mungkin akses dari HP) — sidebar desktop/icon-tablet/bottom-nav-mobile sesuai design.md §5.1, tabel jadi card list di bawah `md`; verifikasi visual final di browser dilakukan langsung oleh user

## Phase 5b — Smart Mixing (Full Stack)

- [x] Tambah model `MixingReading` (kadarAir, rasioCN, beratKg) di `prisma/schema.prisma`, migrasi `add-mixing-incubation-readings`
- [x] AI engine rule-based `lib/ai/evaluateMixingReadiness.ts` — threshold kadar air 50–60%, rasio C:N 25–35, moving average + deteksi anomali (kadar air drop, rasio C:N shift), unit test di `lib/ai/evaluateMixingReadiness.test.ts`
- [x] Titik masuk ingest `lib/sensors/ingestMixing.ts`, simulator `lib/simulator/curveMixing.ts` + `scripts/simulateMixing.ts` (`npm run simulate:mixing`)
- [x] API `app/api/mixing-readings/route.ts` (GET) + SSE `app/api/stream/mixing-readings/route.ts`; `app/api/batches`/`alerts`/`decisions` sudah generic, dipakai langsung tanpa perubahan
- [x] Dashboard `app/(dashboard)/mixing/page.tsx` (Hero Card + Metric Card kadar air/rasio C:N + info berat) dan `app/(dashboard)/mixing/monitor/page.tsx` (chart + AI Decision Panel)
- [x] Data demo di `prisma/seed.ts` (batch COMPLETED + RUNNING)

## Phase 5c — Smart Incubation Monitoring (Full Stack)

- [x] Tambah model `IncubationReading` (suhu, kelembapan, co2, cahaya) + `AlertType.CONTAMINATION` di `prisma/schema.prisma`
- [x] AI engine rule-based `lib/ai/evaluateIncubationReadiness.ts` — threshold suhu 22–28°C, kelembapan 70–90%, CO2 500–1500ppm, cahaya 0–50lux; deteksi dini kontaminasi dari pola CO2 naik + kelembapan turun bersamaan (bukan computer vision, lihat `PRD.md` §5/§7.6); unit test di `lib/ai/evaluateIncubationReadiness.test.ts`
- [x] Titik masuk ingest `lib/sensors/ingestIncubation.ts` (memetakan pola kontaminasi ke `Alert.type = CONTAMINATION`), simulator `lib/simulator/curveIncubation.ts` + `scripts/simulateIncubation.ts` (`npm run simulate:incubation`)
- [x] API `app/api/incubation-readings/route.ts` (GET) + SSE `app/api/stream/incubation-readings/route.ts`
- [x] Dashboard `app/(dashboard)/incubation/page.tsx` (Hero Card + Metric Card suhu/kelembapan/CO2/cahaya) dan `app/(dashboard)/incubation/monitor/page.tsx` (chart + AI Decision Panel)
- [x] Data demo di `prisma/seed.ts` (batch COMPLETED + RUNNING, termasuk contoh alert `CONTAMINATION`)

## Phase 5d — Navigasi Lintas-Stage & Visual Refresh

- [x] Sidebar dikelompokkan per stage (Smart Mixing/Pre-Conditioning/Incubation) + item bersama (Riwayat, Akun) di `components/dashboard/nav-items.ts` + `sidebar.tsx`; bottom nav mobile jadi 4 tab
- [x] Generalisasi `SensorChart`/`MetricCard`/`StatTile`/`HeroCard`/`AIDecisionPanel`/`useActiveBatch`/`useBatchStream` supaya reusable lintas 3 stage (param config per stage di `lib/ui/param-configs.ts`, label readiness per-stage di `lib/ui/status-styles.ts` tanpa rename enum)
- [x] Riwayat Produksi digabung satu halaman dengan tab filter stage + pencarian (`?q=`) dari search box Topbar
- [x] Sidebar restyle hijau forest gelap + badge ikon (thermometer/droplet/CO2/cahaya/timbangan) + gradient hijau di Hero Card untuk status "siap" — merah/amber tetap eksklusif untuk danger/caution (design.md §1/§10, tidak didekorasi)

## Phase 5e — AI Assistant (Gemini)

- [x] Context gatherer `lib/ai-assistant/context.ts` — ambil batch aktif + keputusan AI terakhir + alert belum ditangani dari ketiga stage sekaligus (bukan cuma stage yang sedang dibuka)
- [x] Client Gemini `lib/ai-assistant/gemini.ts` — REST fetch langsung ke `generateContent` (tanpa SDK tambahan), system prompt berisi overview pipeline + threshold + konteks live, error jelas kalau `GEMINI_API_KEY` belum diset
- [x] API `app/api/assistant/chat/route.ts` — proteksi session, validasi & batasi panjang riwayat pesan, panggil Gemini, kembalikan jawaban
- [x] UI overlay global `components/dashboard/assistant/` (`AssistantLauncher` ikon bot mengambang + `AssistantPanel` slide-in kanan), dipasang di `AppShell` supaya muncul di semua halaman
- [x] Read-only by design — assistant tidak pernah mengeksekusi aksi di sistem, cuma kasih info/rekomendasi teks (lihat `PRD.md` §7.8)
- [x] Fix: default model `gemini-2.5-flash` sudah tidak tersedia untuk API key baru (404 dari Google meski masih muncul di `/models`) — ganti default & `.env`/`.env.example` ke `gemini-flash-latest`; diverifikasi end-to-end (login seed user → POST `/api/assistant/chat` → balasan Gemini dengan konteks live 3 stage)
- [ ] (Menyusul kalau dibutuhkan) Persist riwayat percakapan ke database — sengaja belum dikerjakan di MVP, state cuma di browser

## Phase 6 — Integrasi ESP32 (Setelah Hardware Siap)

- [ ] Tulis firmware ESP32: baca sensor tiap 30 detik, publish ke MQTT topic `chamber/{batchId}/sensor`
- [ ] Tulis firmware subscribe ke topic command untuk kontrol fan/aerasi
- [ ] Aktifkan MQTT subscriber bridge di backend (ganti simulator dengan data asli)
- [ ] Kalibrasi sensor (bandingkan pembacaan ESP32 vs alat ukur manual)
- [ ] Uji coba end-to-end dengan chamber fisik: 5–10 batch percobaan

## Phase 7 — Upgrade AI ke Model ML (Roadmap, Setelah Data Batch Terkumpul)

- [x] (Prep, belum data nyata) Tooling export siap: `scripts/exportTrainingData.ts` (`npm run export:training-data`) — dump batch selesai (COMPLETED/ABORTED) per stage lengkap readings + riwayat AIDecision + alert + label akhir ke `training-data/*.json` (gitignored). Diverifikasi jalan terhadap data seed/simulasi sekarang, tapi **belum jadi training set final** — tunggu minimal 20-30 batch nyata dari Phase 6 dulu
- [ ] Export data historis batch (minimal 20–30 batch nyata) sebagai training set
- [ ] Training model klasifikasi (decision tree/random forest) di Python (scikit-learn)
- [ ] Bangun microservice FastAPI kecil untuk serving model
- [ ] Hubungkan Next.js API ke microservice via HTTP call
- [ ] Bandingkan akurasi model ML vs rule-based sebagai baseline
- [ ] A/B atau fallback: gunakan rule-based jika model ML gagal/tidak tersedia

## Phase 8 — Polish & Demo Prep (Untuk Kompetisi)

- [ ] Siapkan skenario demo end-to-end (data simulasi → AI decision → notifikasi)
- [ ] Rekam video demo cadangan (jaga-jaga koneksi bermasalah saat presentasi)
- [ ] Cek performa: pastikan dashboard tidak lag saat banyak data sensor masuk
- [ ] Review UI/UX terakhir, pastikan konsisten dengan wireframe di proposal

---

## Catatan Prioritas

Phase 0–4 adalah **jalur kritis** yang harus selesai duluan karena semuanya bisa dikerjakan tanpa menunggu tim hardware. Phase 5 (dashboard Pre-Conditioning) bisa paralel dengan Phase 4 begitu API dasar sudah ada. Phase 5b/5c/5d (Smart Mixing, Smart Incubation, navigasi lintas-stage) menyusul setelah Phase 5 selesai, mengulang pola Phase 1–5 dalam skala lebih kecil per stage. Phase 5e (AI Assistant) independen dari hardware, cocok dikerjakan kapan pun slot Phase 6 masih terblokir. Phase 6 baru dimulai setelah alat fisik (mixer/chamber/rak inkubasi) dan ESP32 siap dari tim alat — untuk ketiga stage sekaligus. **Phase 7 bukan jalan pintas kalau Phase 6 terblokir** — ML roadmap butuh minimal 20-30 batch data historis nyata dari produksi sungguhan, yang baru ada setelah hardware jalan; kerjakan Phase 7 hanya kalau data itu sudah terkumpul, bukan sebagai pengganti Phase 6. Kalau Phase 6 terblokir, isi waktu dengan Phase 5e atau Phase 8 (keduanya tidak butuh hardware).
