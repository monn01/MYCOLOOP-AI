# PRD.md — MYCOLOOP-AI Software System

## 1. Ringkasan

MYCOLOOP-AI adalah sistem software yang mengontrol dan memonitor seluruh pipeline produksi baglog jamur tiram dari limbah jagung pascapanen, lewat 3 stage: **Smart Mixing**, **Smart Pre-Conditioning**, dan **Smart Incubation Monitoring**. Software ini menggantikan pendekatan *time-based* (jadwal tetap per tahap) dengan pendekatan *condition-based* — AI menentukan kapan tiap tahap selesai berdasarkan data sensor real-time, bukan jadwal jam yang kaku.

Dokumen ini fokus pada scope software (dashboard, backend, AI decision logic, integrasi IoT) untuk ketiga stage. Alat fisik (mixer, shredder, chamber, rak inkubasi) di luar scope dokumen ini.

## 1.1 Posisi dalam Pipeline MYCOLOOP-AI

Produksi baglog jamur tiram di MYCOLOOP-AI berjalan lewat **3 stage**, ketiganya sekarang dalam scope software ini:

1. **Smart Mixing** — pencacahan limbah jagung + pencampuran otomatis. AI menilai kesiapan bahan baku (kadar air, rasio C:N) sebelum dipindahkan ke Pre-Conditioning.
2. **Smart Pre-Conditioning** — chamber dengan sensor pH/suhu/kelembapan + AI decision agent yang menentukan kapan media siap sterilisasi. Ini hero feature software karena paling novel duluan dikembangkan (condition-based, bukan time-based).
3. **Smart Incubation Monitoring** — setelah sterilisasi + inokulasi, IoT monitor ruang inkubasi (suhu, kelembapan, CO2, cahaya) + deteksi dini risiko kontaminasi berbasis pola sensor (lihat §5 soal computer vision).

Ketiganya berbagi satu model `Batch` dengan field `stage` (lihat §8) — field ini awalnya disiapkan forward-compatible sejak Stage 2 pertama dibangun, sekarang direalisasikan penuh untuk Stage 1 dan 3.

## 2. Masalah yang Diselesaikan

Proses produksi baglog konvensional di tiap tahap (pencampuran, pre-conditioning, inkubasi) mengandalkan jadwal/insting operator tanpa parameter objektif. Akibatnya: waktu produksi tidak efisien, risiko kontaminasi tinggi, dan kualitas tidak konsisten antar-batch. Software ini menyediakan visibilitas real-time dan pengambilan keputusan otomatis berbasis data di ketiga tahap untuk mengatasi masalah tersebut.

## 3. Target Pengguna

- **Operator/petani** — mengoperasikan mixer/chamber/rak inkubasi, memantau dashboard, menerima notifikasi kesiapan tiap tahap.
- **Admin/pemilik UMKM** — melihat riwayat produksi lintas-stage, laporan efisiensi, dan mengelola formula media.

## 4. Tujuan Software

1. Menyediakan monitoring sensor real-time di ketiga stage dengan latensi rendah (<5 detik dari sensor ke dashboard).
2. Menyediakan AI decision agent per stage yang mengklasifikasikan status kesiapan: `belum_siap` / `dalam_proses` / status "siap" (arti persisnya beda tiap stage — siap dipindahkan/siap sterilisasi/siap panen, lihat §7).
3. Mendeteksi dini risiko kontaminasi selama inkubasi lewat pola anomali sensor (CO2 + kelembapan), bukan lewat waktu tetap.
4. Mencatat riwayat setiap batch produksi lintas-stage untuk evaluasi dan continuous improvement.
5. Memberikan notifikasi otomatis ke operator saat suatu tahap siap lanjut atau saat terdeteksi anomali/kontaminasi.
6. Menyediakan dashboard yang dapat diakses via web/mobile browser.

## 5. Non-Goals (Di Luar Scope Awal)

- Tidak membangun computer vision terlatih (YOLOv8) sungguhan untuk deteksi kontaminasi visual — deteksi dini kontaminasi di MVP murni rule-based dari pola sensor (CO2 + kelembapan, lihat §7.6), konsisten dengan prinsip "rule-based dulu, ML nanti" (§6, §12). Upgrade ke computer vision sungguhan ada di roadmap terpisah setelah data cukup.
- Tidak membangun native mobile app — cukup responsive web dashboard.
- Tidak membangun multi-tenant SaaS — MVP untuk 1 unit mixer/chamber/rak inkubasi per organisasi dulu.

## 6. Arsitektur Sistem

Lima layer, sama di ketiga stage:

1. **Edge (Firmware)** — ESP32 membaca sensor tiap 30 detik sesuai stage (Mixing: sensor kadar air + estimasi rasio C:N; Pre-Conditioning: DHT22 suhu/kelembapan + sensor pH; Incubation: DHT22 suhu/kelembapan + sensor CO2 + sensor cahaya), publish ke MQTT broker, menerima command kontrol aktuator (fan PWM aerasi di Pre-Conditioning).
2. **Komunikasi** — MQTT broker (Mosquitto self-hosted atau HiveMQ Cloud free-tier) sebagai jembatan real-time antara firmware dan backend.
3. **Backend** — Next.js API routes sebagai MQTT subscriber bridge, REST endpoints, dan WebSocket/SSE server untuk push real-time. Prisma ORM + PostgreSQL sebagai penyimpanan data, satu reading model per stage (lihat §8).
4. **AI Engine** — Logic klasifikasi kesiapan media per stage, masing-masing rule-based threshold + moving average + deteksi anomali/kontaminasi. Roadmap: model ML (decision tree/random forest) setelah data batch historis terkumpul dari ketiga stage.
5. **Presentasi** — Dashboard Next.js dengan NextAuth (autentikasi operator), sidebar dikelompokkan per stage, grafik real-time (Recharts), status card AI decision per stage.

## 7. Fitur Utama (MVP)

### 7.1 Dashboard Utama (Pre-Conditioning)
- Status chamber (`idle` / `running` / `ready`)
- Ringkasan: suhu & pH terkini, alert terbaru dari AI
- Kartu metrik suhu/kelembapan/pH dengan sparkline & range indicator

### 7.2 Pre-Conditioning Monitor
- Grafik time-series suhu, kelembapan, pH real-time
- Threshold line batas aman tiap parameter
- Status AI Decision
- Kontrol aerasi manual/otomatis

### 7.3 AI Decision Engine (Pre-Conditioning)
- Input: suhu, kelembapan, pH (dan turunannya: rate-of-change, moving average)
- Output: status kesiapan + confidence score + alasan singkat
- Anomaly detection: lonjakan suhu, penurunan pH drastis → alert dini

### 7.4 Riwayat Produksi
- Daftar batch lintas-stage (tab filter Semua/Mixing/Pre-Conditioning/Incubation) dengan durasi, status akhir, grafik sensor per-batch (chart menyesuaikan parameter stage batch tsb)
- Statistik: rata-rata durasi, tingkat keberhasilan, jumlah batch bulan berjalan

### 7.5 Smart Mixing
- Dashboard: kartu metrik kadar air & rasio C:N bahan baku, info berat bahan
- AI Decision Engine: threshold kadar air 50–60%, rasio C:N 25–35, moving average + deteksi anomali (penurunan kadar air drastis, pergeseran rasio C:N drastis)
- Transisi otomatis ke status "Siap Dipindahkan" begitu parameter stabil di rentang target — trigger alert `READY` untuk operator memindahkan bahan ke Pre-Conditioning

### 7.6 Smart Incubation Monitoring
- Dashboard: kartu metrik suhu, kelembapan, CO2, cahaya ruang inkubasi
- AI Decision Engine: threshold suhu 22–28°C, kelembapan 70–90%, CO2 500–1500ppm, cahaya 0–50lux (ruang gelap), moving average + deteksi anomali suhu
- **Deteksi dini kontaminasi (rule-based, bukan computer vision — lihat §5)**: pola lonjakan CO2 bersamaan penurunan kelembapan drastis dalam interval yang sama diklasifikasikan sebagai indikasi risiko kontaminasi, memicu `Alert` bertipe `CONTAMINATION` supaya operator memeriksa baglog secara visual
- Transisi otomatis ke status "Siap Panen" begitu parameter stabil (miselium tumbuh optimal)

### 7.7 Autentikasi & Manajemen User
- Login operator via NextAuth
- Role: admin vs operator (opsional untuk MVP, bisa single-role dulu)
- Profil: ubah password, toggle mode terang/gelap manual

### 7.8 AI Assistant (Gemini)
- Overlay global (ikon bot mengambang + panel chat slide-in dari kanan), diakses dari halaman mana pun, bukan halaman/page tersendiri
- **Read-only**: hanya memberi informasi dan rekomendasi lewat teks. Tidak bisa dan tidak boleh mengklaim mengeksekusi aksi apa pun di sistem (tutup alert, mulai batch, dsb) — operator tetap yang menjalankan aksi lewat UI biasa. Ini keputusan sadar, bukan keterbatasan sementara: sejalan dengan prinsip "operator in the loop" di `design.md` §1.
- Setiap pertanyaan dijawab dengan konteks live dari ketiga stage sekaligus (batch aktif, keputusan AI & alasannya, alert belum ditangani per stage) — bukan cuma stage yang sedang dibuka operator
- Model: Gemini (`GEMINI_API_KEY`, model default `gemini-2.5-flash`, lihat `.env.example`) dipanggil lewat REST API langsung dari backend (`app/api/assistant/chat`), tanpa SDK tambahan
- Percakapan disimpan di state browser saja (tidak dipersist ke database) — cukup untuk MVP

## 8. Model Data (Ringkasan)

- `Batch` — id, startTime, endTime, status, formula, createdBy, **stage** (`MIXING` / `PRE_CONDITIONING` / `INCUBATION`) — satu model dipakai bersama ketiga stage
- `SensorReading` — batchId, timestamp, suhu, kelembapan, pH (khusus batch stage `PRE_CONDITIONING`)
- `MixingReading` — batchId, timestamp, kadarAir, rasioCN, beratKg (khusus batch stage `MIXING`)
- `IncubationReading` — batchId, timestamp, suhu, kelembapan, co2, cahaya (khusus batch stage `INCUBATION`)
- `AIDecision` — batchId, timestamp, status (`belum_siap`/`dalam_proses`/status "siap" generik), confidence, reasoning — dipakai bersama ketiga stage, label tampilan per-stage di-map di layer UI (bukan enum terpisah per stage)
- `Alert` — batchId, timestamp, type (`ANOMALY`/`READY`/`CONTAMINATION`), message, resolved
- `User` — id, name, email, role

Skema detail ada di `prisma/schema.prisma`.

## 9. Requirement Non-Fungsional

- **Real-time**: update dashboard dalam <5 detik dari sensor terbaca, di ketiga stage.
- **Reliability**: data sensor tetap tersimpan meski dashboard offline (backend selalu subscribe MQTT).
- **Development tanpa hardware**: seluruh software dapat dikembangkan dan diuji menggunakan data simulasi (satu simulator per stage) sebelum alat fisik selesai difabrikasi.
- **Skalabilitas minimal**: cukup untuk 1-5 unit mixer/chamber/rak inkubasi per instance database di tahap kompetisi.

## 10. Metrik Keberhasilan (untuk Demo/Kompetisi)

- Dashboard ketiga stage dapat menampilkan data sensor simulasi secara real-time tanpa lag.
- AI decision engine tiap stage memberikan keputusan yang konsisten dengan logika threshold yang telah divalidasi (unit test per evaluator).
- Riwayat batch lintas-stage dapat diakses dan divisualisasikan dengan benar.
- Sistem dapat di-demo end-to-end per stage: dari data sensor masuk → AI memutuskan → notifikasi muncul di dashboard.

## 11. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, TypeScript |
| Backend | Next.js API Routes / Route Handlers |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth |
| Real-time | MQTT (mqtt.js) + WebSocket/SSE |
| Grafik | Recharts |
| Firmware | ESP32 (Arduino/PlatformIO, C++) |
| AI (MVP) | TypeScript rule-based logic, satu evaluator per stage |
| AI (Roadmap) | Python (scikit-learn) via microservice FastAPI, dipanggil dari Next.js; computer vision (YOLOv8) untuk kontaminasi Incubation |
| AI Assistant | Google Gemini API (REST langsung, tanpa SDK), lihat §7.8 |

## 12. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Alat fisik (mixer/chamber/rak inkubasi) belum selesai saat software perlu didemo | Bangun sensor data simulator per stage agar software bisa dites independen dari hardware |
| Model AI belum punya data training | Mulai dengan rule-based di ketiga stage, upgrade ke ML setelah data batch terkumpul dari uji coba |
| Deteksi kontaminasi rule-based (bukan computer vision) bisa false positive/negative | Alert `CONTAMINATION` selalu minta konfirmasi visual manual operator, bukan tindakan otomatis; upgrade ke YOLOv8 sungguhan di roadmap setelah cukup data berlabel |
| MQTT broker down/koneksi ESP32 putus | Backend tetap simpan data terakhir, dashboard tampilkan status "disconnected" |
| AI Assistant bisa berhalusinasi / kasih saran keliru | Assistant read-only (tidak bisa eksekusi aksi), system prompt eksplisit minta jujur kalau data tidak cukup; operator tetap validasi manual sebelum bertindak |
| `GEMINI_API_KEY` belum diset / kuota habis | Endpoint mengembalikan error jelas ke UI, sisa dashboard tetap berfungsi normal (assistant bukan dependency kritis) |
