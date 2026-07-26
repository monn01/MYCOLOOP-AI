# PRD.md — MYCOLOOP-AI Software System

## 1. Ringkasan

MYCOLOOP-AI adalah sistem software yang mengontrol dan memonitor seluruh pipeline produksi baglog jamur tiram dari limbah jagung pascapanen, lewat 3 stage: **Smart Mixing**, **Smart Pre-Conditioning**, dan **Smart Incubation Monitoring**. Software ini menggantikan pendekatan *time-based* (jadwal tetap per tahap) dengan pendekatan *condition-based* — AI menentukan kapan tiap tahap selesai berdasarkan data sensor real-time, bukan jadwal jam yang kaku.

Dokumen ini fokus pada scope software (dashboard, backend, AI decision logic, integrasi IoT) untuk ketiga stage. Alat fisik (mixer, shredder, chamber, rak inkubasi) di luar scope dokumen ini.

## 1.1 Posisi dalam Pipeline MYCOLOOP-AI

Produksi baglog jamur tiram di MYCOLOOP-AI berjalan lewat **3 stage**, ketiganya sekarang dalam scope software ini:

1. **Smart Mixing** — pencacahan limbah jagung + pencampuran otomatis. Sensor: pH, kekeruhan air, berat bahan. AI di sini **mengontrol aktuator** (solenoid valve tiap saluran bahan) untuk mencapai formula target secara closed-loop, bukan sekadar mengklasifikasi kesiapan (lihat §7.5, §12 soal safety envelope).
2. **Smart Pre-Conditioning** — chamber dengan sensor suhu ruangan + kelembapan udara + AI decision agent yang menentukan kapan media siap sterilisasi, sekaligus mengontrol fan aerasi (lihat §7.2). Ini hero feature software karena paling novel duluan dikembangkan (condition-based, bukan time-based).
3. **Smart Incubation Monitoring** — setelah sterilisasi + inokulasi, IoT monitor ruang inkubasi (suhu, kelembapan, CO2, cahaya) **plus kamera** (ESP32-CAM/webcam/Raspberry Pi camera) untuk deteksi dini risiko kontaminasi — AI menggabungkan pola sensor (CO2 naik + kelembapan turun) dengan analisis visual (lihat §5, §7.6).

Ketiganya berbagi satu model `Batch` dengan field `stage` (lihat §8) — field ini awalnya disiapkan forward-compatible sejak Stage 2 pertama dibangun, sekarang direalisasikan penuh untuk Stage 1 dan 3.

> **Catatan arsitektur (2026-07-26):** Set sensor per stage & model otonomi AI direvisi dari rancangan awal — pH pindah dari Pre-Conditioning ke Mixing, sensor Mixing (kadar air/rasio C:N) diganti pH/kekeruhan air/berat, dan AI Mixing naik level dari advisory (klasifikasi kesiapan) jadi closed-loop actuator control (buka/tutup solenoid valve). Sudah diimplementasikan penuh — lihat `TASKPLAN.md` Phase 5b.

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

- Tidak membangun model computer vision **terlatih** (CNN/YOLOv8) di awal — kamera Incubasi dianalisis lewat image processing klasik dulu (segmentasi warna/tekstur buat pola kontaminasi khas), digabung dengan deteksi rule-based dari pola sensor (CO2 + kelembapan, lihat §7.6), konsisten dengan prinsip "rule-based/klasik dulu, ML nanti" (§6, §12). Kamera sendiri **sudah masuk MVP** (bukan lagi di luar scope) — yang ditunda cuma model CV terlatih sungguhan, yang butuh data gambar berlabel dan tetap di roadmap terpisah.
- Tidak membangun native mobile app — cukup responsive web dashboard.
- Tidak membangun multi-tenant SaaS — MVP untuk 1 unit mixer/chamber/rak inkubasi per organisasi dulu.

## 6. Arsitektur Sistem

Lima layer, sama di ketiga stage:

1. **Edge (Firmware)** — ESP32 membaca sensor tiap 30 detik sesuai stage (Mixing: sensor pH + kekeruhan air + berat bahan; Pre-Conditioning: DHT22 suhu/kelembapan; Incubation: DHT22 suhu/kelembapan + sensor CO2 + sensor cahaya + kamera [ESP32-CAM/webcam/Raspberry Pi camera]), publish ke MQTT broker, menerima command kontrol aktuator (fan PWM aerasi di Pre-Conditioning, solenoid valve per saluran bahan di Mixing). Topologi papan (1 ESP32 gabungan vs 3 ESP32 per stage) keputusan tim hardware — tidak mempengaruhi desain software selama tiap topic MQTT tetap di-namespace per stage.
2. **Komunikasi** — MQTT broker (Mosquitto self-hosted atau HiveMQ Cloud free-tier) sebagai jembatan real-time antara firmware dan backend.
3. **Backend** — Next.js API routes sebagai MQTT subscriber bridge, REST endpoints, dan WebSocket/SSE server untuk push real-time. Prisma ORM + PostgreSQL sebagai penyimpanan data, satu reading model per stage (lihat §8).
4. **AI Engine** — Logic per stage, rule-based/klasik dulu (bukan ML terlatih di awal): Pre-Conditioning & Incubation tetap klasifikasi kesiapan + threshold + moving average + deteksi anomali/kontaminasi (Incubation ditambah image processing klasik dari kamera, lihat §7.6); Mixing naik level jadi closed-loop control — hasil evaluasi langsung memicu command aktuator (solenoid valve) lewat safety envelope, bukan cuma status buat operator (lihat §7.5, §12). Roadmap: model ML (decision tree/random forest untuk readiness, CV terlatih untuk kontaminasi) setelah data batch historis & gambar berlabel terkumpul.
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
- Dashboard: kartu metrik pH, kekeruhan air, berat bahan; log command aktuator (valve mana yang baru dibuka/ditutup & kenapa)
- AI Control Agent: rule-based state machine — baca pH/kekeruhan/berat, urutkan buka-tutup solenoid valve per saluran bahan (limbah jagung, dedak, kapur, dll.) sampai formula target tercapai; setiap command aktuator lewat safety envelope (batas durasi buka valve, sanity-check sensor sebelum eksekusi, fail-safe posisi tertutup, tombol override manual di dashboard)
- Transisi otomatis ke status "Siap Dipindahkan" begitu formula tercampur stabil di rentang target — trigger alert `READY` untuk operator memindahkan bahan ke Pre-Conditioning
- **Catatan implementasi:** sudah diimplementasikan (`lib/ai/evaluateMixingReadiness.ts` sebagai Mixing Control Agent, schema `MixingReading` pH/kekeruhanAir/beratKg, `ActuatorCommand` audit trail) — lihat `TASKPLAN.md` Phase 5b

### 7.6 Smart Incubation Monitoring
- Dashboard: kartu metrik suhu, kelembapan, CO2, cahaya ruang inkubasi + snapshot/preview kamera terbaru
- AI Decision Engine: threshold suhu 22–28°C, kelembapan 70–90%, CO2 500–1500ppm, cahaya 0–50lux (ruang gelap), moving average + deteksi anomali suhu
- **Deteksi dini kontaminasi (dua sinyal digabung, lihat §5)**: (1) pola sensor — lonjakan CO2 bersamaan penurunan kelembapan drastis dalam interval yang sama (sudah jalan); (2) analisis visual dari kamera (ESP32-CAM/webcam/Raspberry Pi camera) — image processing klasik (segmentasi warna/tekstur) mendeteksi bercak khas kontaminasi. Kedua sinyal independen, AI gabungkan buat kurangi false positive/negative sebelum memicu `Alert` bertipe `CONTAMINATION` — operator tetap wajib konfirmasi visual manual sebelum tindakan
- Transisi otomatis ke status "Siap Panen" begitu parameter stabil (miselium tumbuh optimal)
- **Catatan hardware:** ESP32-CAM opsi termurah tapi noisy (akurasi rendah); webcam/Raspberry Pi camera direkomendasikan kalau akurasi deteksi visual jadi prioritas

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
- `SensorReading` — batchId, timestamp, suhu, kelembapan (khusus batch stage `PRE_CONDITIONING`) — **target**: `pH` di-drop dari model ini (pindah ke `MixingReading`); skema saat ini masih menyertakan `pH`, migrasi belum dikerjakan
- `MixingReading` — batchId, timestamp, pH, kekeruhanAir, beratKg (khusus batch stage `MIXING`) — **target**: ganti dari `kadarAir`/`rasioCN`; skema saat ini masih field lama, migrasi belum dikerjakan
- `IncubationReading` — batchId, timestamp, suhu, kelembapan, co2, cahaya (khusus batch stage `INCUBATION`)
- `IncubationImageAnalysis` *(baru, belum diimplementasi)* — batchId, timestamp, imageRef, contaminationScore/label — dipakai bareng `IncubationReading` buat deteksi kontaminasi dua-sinyal (§7.6)
- `ActuatorCommand` *(baru, belum diimplementasi)* — batchId, timestamp, stage, target (`valve:<nama>`/`fan`), action (`OPEN`/`CLOSE`/`ON`/`OFF`/level), triggeredBy (`AI`/`MANUAL`), reasoning — audit trail tiap kali AI (atau operator) menggerakkan aktuator fisik, dasar buat safety envelope §12
- `AIDecision` — batchId, timestamp, status (`belum_siap`/`dalam_proses`/status "siap" generik), confidence, reasoning — dipakai bersama ketiga stage, label tampilan per-stage di-map di layer UI (bukan enum terpisah per stage)
- `Alert` — batchId, timestamp, type (`ANOMALY`/`READY`/`CONTAMINATION`), message, resolved
- `User` — id, name, email, role

Skema detail ada di `prisma/schema.prisma`. `MixingReading`, `SensorReading`, dan `ActuatorCommand` sudah sesuai desain di atas (Phase 5b). `IncubationImageAnalysis` masih "target"/belum diimplementasi — lihat `TASKPLAN.md` Phase 6b.

## 9. Requirement Non-Fungsional

- **Real-time**: update dashboard dalam <5 detik dari sensor terbaca, di ketiga stage.
- **Reliability**: data sensor tetap tersimpan meski dashboard offline (backend selalu subscribe MQTT).
- **Development tanpa hardware**: seluruh software dapat dikembangkan dan diuji menggunakan data simulasi (satu simulator per stage) sebelum alat fisik selesai difabrikasi.
- **Skalabilitas minimal**: cukup untuk 1-5 unit mixer/chamber/rak inkubasi per instance database di tahap kompetisi.
- **Safety aktuator**: setiap command aktuator (solenoid valve Mixing, fan Pre-Conditioning) melewati safety envelope (batas durasi, sanity-check sensor, fail-safe closed/off, override manual di dashboard) sebelum dieksekusi firmware — lihat §12.

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
| AI (MVP) | TypeScript rule-based logic, satu evaluator per stage; Mixing juga jadi closed-loop actuator control (lihat §7.5) |
| AI (Vision, Incubation) | Image processing klasik (OpenCV) dulu untuk analisis kamera; model CV terlatih (CNN/YOLOv8) di roadmap setelah data gambar berlabel cukup |
| AI (Roadmap) | Python (scikit-learn) via microservice FastAPI, dipanggil dari Next.js, untuk readiness classifier ML setelah data batch historis cukup |
| AI Assistant | Google Gemini API (REST langsung, tanpa SDK), lihat §7.8 |

## 12. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Alat fisik (mixer/chamber/rak inkubasi) belum selesai saat software perlu didemo | Bangun sensor data simulator per stage agar software bisa dites independen dari hardware |
| Model AI belum punya data training | Mulai dengan rule-based di ketiga stage, upgrade ke ML setelah data batch terkumpul dari uji coba |
| Deteksi kontaminasi (sensor + visual klasik) bisa false positive/negative | Alert `CONTAMINATION` selalu minta konfirmasi visual manual operator, bukan tindakan otomatis; upgrade ke model CV terlatih sungguhan di roadmap setelah cukup data gambar berlabel |
| AI mengontrol aktuator fisik (valve/fan) otomatis bisa salah eksekusi & merusak batch/alat | Safety envelope wajib (batas durasi buka valve, sanity-check sensor, fail-safe closed/off, override manual di dashboard) sebelum command aktuator dieksekusi firmware; semua command tercatat di `ActuatorCommand` buat audit |
| ESP32-CAM murah tapi noisy, bisa bikin analisis visual tidak akurat | Rekomendasikan webcam/Raspberry Pi camera kalau akurasi jadi prioritas; hasil visual jadi sinyal sekunder digabung sensor, bukan satu-satunya penentu alert kontaminasi |
| MQTT broker down/koneksi ESP32 putus | Backend tetap simpan data terakhir, dashboard tampilkan status "disconnected" |
| AI Assistant bisa berhalusinasi / kasih saran keliru | Assistant read-only (tidak bisa eksekusi aksi), system prompt eksplisit minta jujur kalau data tidak cukup; operator tetap validasi manual sebelum bertindak |
| `GEMINI_API_KEY` belum diset / kuota habis | Endpoint mengembalikan error jelas ke UI, sisa dashboard tetap berfungsi normal (assistant bukan dependency kritis) |
