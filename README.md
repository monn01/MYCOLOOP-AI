# MYCOLOOP-AI

Software untuk mengontrol dan memonitor Smart Pre-Conditioning Chamber produksi baglog jamur tiram. Lihat `PRD.md` untuk detail produk dan `TASKPLAN.md` untuk urutan pengerjaan per phase. Konvensi kerja untuk Claude Code ada di `CLAUDE.md`.

## Setup

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, NEXTAUTH_SECRET, dst
npx prisma migrate dev # buat schema di database
npm run db:seed        # isi data dummy (2 user, 3 batch contoh)
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Untuk inspeksi database secara visual: `npm run db:studio`.

## Sensor Data Simulator

Karena chamber fisik belum tentu siap saat development (lihat PRD.md §9 dan §12), `scripts/simulate.ts` men-generate data suhu/kelembapan/pH dengan kurva realistis (basah & panas di awal → stabil menjelang siap sterilisasi) dan menginsert-nya ke `SensorReading` secara berkala.

```bash
npm run simulate
```

Tanpa argumen, simulator akan memakai batch dengan status `RUNNING` yang paling baru (atau membuat batch baru otomatis kalau tidak ada), lalu insert satu pembacaan sensor setiap 5 detik.

Opsi yang tersedia:

| Flag | Default | Keterangan |
|---|---|---|
| `--batch <id>` | batch `RUNNING` terbaru | Target batch tertentu (harus berstatus `RUNNING`) |
| `--interval <detik>` | `5` | Jeda nyata antar-insert |
| `--speed <menit>` | `30` | Berapa menit **simulasi** yang maju tiap satu insert — dipakai untuk mempercepat demo tanpa perlu menunggu 48 jam sungguhan |
| `--duration <jam>` | `48` | Total durasi pre-conditioning yang disimulasikan; simulator berhenti otomatis saat tercapai |
| `--anomaly <suhu\|ph>` | – | Suntikkan satu anomali (lonjakan suhu / drop pH) untuk testing alert |
| `--anomaly-tick <n>` | tengah proses | Tick keberapa anomali disuntikkan |

Contoh: demo 48 jam proses dipadatkan jadi ~4 menit nyata, dengan satu lonjakan suhu di tengah jalan:

```bash
npm run simulate -- --speed 60 --interval 5 --anomaly suhu
```

Timestamp yang disimpan mengikuti jam simulasi (`startTime + progress`), bukan jam nyata — supaya grafik time-series tetap merepresentasikan garis waktu batch meski dipercepat, dan supaya simulator bisa dihentikan (Ctrl+C) lalu dilanjut lagi tanpa kehilangan progress.
