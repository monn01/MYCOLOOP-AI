# TASKPLAN.md — MYCOLOOP-AI Software System

Urutan pengerjaan disusun agar development tidak terblokir oleh progres alat fisik. Phase 0–4 sepenuhnya bisa dikerjakan lewat Claude Code tanpa hardware. Phase 5 baru butuh ESP32 fisik.

---

## Phase 0 — Project Setup

- [ ] Scaffold project Next.js 14 (App Router) + TypeScript + Tailwind
- [ ] Setup PostgreSQL (Neon/Supabase untuk dev) + koneksi Prisma
- [ ] Setup struktur folder: `app/`, `lib/`, `components/`, `prisma/`
- [ ] Setup `CLAUDE.md` untuk konteks project (stack, konvensi, struktur)
- [ ] Init git repo, `.env.example`

## Phase 1 — Data Model (Prisma Schema)

- [ ] Definisikan model `Batch`, `SensorReading`, `AIDecision`, `Alert`, `User`
- [ ] Jalankan migrasi awal (`prisma migrate dev`)
- [ ] Buat seed script untuk data dummy (beberapa batch contoh)
- [ ] Verifikasi schema dengan Prisma Studio

## Phase 2 — Sensor Data Simulator

- [ ] Buat script simulator (Node.js standalone atau cron job Next.js) yang generate data suhu/kelembapan/pH dengan kurva realistis (basah & panas di awal → stabil menjelang siap)
- [ ] Simulator insert data ke `SensorReading` tiap beberapa detik untuk batch yang sedang `running`
- [ ] Tambahkan mode simulasi anomali (lonjakan suhu, drop pH) untuk testing alert
- [ ] Dokumentasikan cara menjalankan simulator (`npm run simulate`)

## Phase 3 — Backend: API & Real-time

- [ ] Buat API route CRUD `Batch` (create, get, list, update status)
- [ ] Buat API route GET `SensorReading` (dengan filter batchId, range waktu)
- [ ] Setup WebSocket/SSE endpoint untuk push data sensor real-time ke client
- [ ] (Untuk nanti) siapkan MQTT subscriber bridge — bisa distub dulu, diisi real MQTT client di Phase 5
- [ ] Testing endpoint dengan data dari simulator Phase 2

## Phase 4 — AI Decision Engine (Rule-Based)

- [ ] Tulis function `evaluateReadiness(readings: SensorReading[]): AIDecisionResult` di `lib/ai/`
- [ ] Implementasi logic threshold: suhu 25–35°C, pH 6–7, kelembapan 60–65%
- [ ] Implementasi moving average & rate-of-change untuk smoothing data noise
- [ ] Implementasi anomaly detection (lonjakan suhu tiba-tiba, drop pH drastis)
- [ ] Buat unit test untuk skenario: media belum siap, media siap, kondisi anomali
- [ ] Hubungkan AI engine ke pipeline: setiap data sensor baru masuk → jalankan evaluasi → simpan ke `AIDecision`

## Phase 5 — Dashboard UI

- [ ] Setup NextAuth untuk login operator
- [ ] Halaman Dashboard Utama: status chamber, summary cards, alert terbaru
- [ ] Halaman Pre-Conditioning Monitor: grafik time-series (Recharts), threshold line, status AI decision live
- [ ] Halaman Riwayat Produksi: daftar batch, detail per-batch, statistik agregat
- [ ] Notifikasi UI (toast/banner) saat status berubah jadi "siap sterilisasi" atau saat alert anomali muncul
- [ ] Responsive check (mobile/tablet, karena operator mungkin akses dari HP)

## Phase 6 — Integrasi ESP32 (Setelah Hardware Siap)

- [ ] Tulis firmware ESP32: baca sensor tiap 30 detik, publish ke MQTT topic `chamber/{batchId}/sensor`
- [ ] Tulis firmware subscribe ke topic command untuk kontrol fan/aerasi
- [ ] Aktifkan MQTT subscriber bridge di backend (ganti simulator dengan data asli)
- [ ] Kalibrasi sensor (bandingkan pembacaan ESP32 vs alat ukur manual)
- [ ] Uji coba end-to-end dengan chamber fisik: 5–10 batch percobaan

## Phase 7 — Upgrade AI ke Model ML (Roadmap, Setelah Data Batch Terkumpul)

- [ ] Export data historis batch (minimal 20–30 batch) sebagai training set
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

Phase 0–4 adalah **jalur kritis** yang harus selesai duluan karena semuanya bisa dikerjakan tanpa menunggu tim hardware. Phase 5 (dashboard) bisa paralel dengan Phase 4 begitu API dasar sudah ada. Phase 6 baru dimulai setelah chamber fisik dan ESP32 siap dari tim alat. Phase 7 adalah stretch goal — kerjakan jika waktu memungkinkan sebelum deadline submission, karena akurasi model ML butuh data yang belum tentu cukup di awal.
