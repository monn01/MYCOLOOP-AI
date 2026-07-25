# design.md — MYCOLOOP-AI Dashboard Design System

Design system untuk UI dashboard MYCOLOOP-AI (Phase 5, lihat `TASKPLAN.md`). Dipakai untuk mengerjakan sisa bagian Phase 5: Dashboard Utama, Pre-Conditioning Monitor, Riwayat Produksi, notifikasi, dan responsive pass. Stack: Next.js 14 App Router + TypeScript + Tailwind CSS + Recharts.

Sumber kebenaran fungsional: `PRD.md` (fitur, threshold, model data) dan `TASKPLAN.md` (urutan pengerjaan). Dokumen ini hanya mengatur *bagaimana* tampilannya, bukan mengubah scope.

> **Revisi warna:** sistem ini memakai **hijau + putih sebagai warna acuan dominan** di seluruh UI (background, nav, card, brand, mayoritas status). Merah dan amber **dipertahankan**, tapi sengaja dibuat langka/minim — dipakai eksklusif untuk dua hal saja: alert anomali (merah) dan kondisi caution/di luar rentang (amber). Karena cuma dua warna itu yang "menyimpang" dari hijau-putih, saat muncul di layar operator langsung sadar itu sinyal penting — kalau semua warna dipakai bebas, sinyal bahaya jadi tenggelam.

---

## 1. Prinsip Desain

Produk ini dipakai di dua konteks yang sangat berbeda:

1. **Operator di lapangan** — sering dari HP, kadang di dekat chamber fisik (lingkungan lembap/kotor, cahaya keras). Butuh baca status dalam <2 detik: aman/waspada/bahaya, tanpa harus menafsirkan.
2. **Admin/pemilik UMKM** — di kantor/laptop, melihat riwayat dan tren efisiensi untuk keputusan bisnis.

Prinsip turunannya:

- **Status dulu, detail belakangan.** Setiap halaman punya satu status paling penting (chamber / AI decision) yang harus terbaca sekilas — besar, berwarna, dengan label teks, bukan cuma titik warna.
- **Jangan pernah andalkan warna saja.** Tiap status wajib disertai label teks + ikon, dan untuk kasus yang secara warna mirip (lihat §4.2, "running" vs "ready" sama-sama hijau) wajib dibedakan lewat ikon/animasi juga, bukan cuma shade warna.
- **Merah dan amber itu langka, jaga kelangkaannya.** Jangan pernah pakai merah/amber untuk dekorasi, ilustrasi, atau elemen non-status (lihat catatan revisi di atas). Begitu ada warna selain hijau/putih muncul di layar, itu harus selalu berarti "perhatikan ini".
- **Threshold selalu tervisualisasikan**, bukan cuma angka. Grafik sensor selalu menampilkan pita/garis batas aman (25–35°C, pH 6–7, kelembapan 60–65%), tidak cuma garis data mentah.
- **Mobile-first untuk halaman monitor**, desktop-enhanced untuk riwayat/statistik. Operator = HP, admin = laptop.
- **Tidak generik-AI.** Hindari card bayangan lembut + gradient ungu-biru khas template AI. Hijau di sini juga bukan hijau-neon "eco-app" generik — dipilih tone forest/mycelium yang lebih dalam dan tenang, cocok untuk alat kerja industrial.

---

## 2. Arah Brand & Palet

Brand primer: **hijau forest/mycelium** (pertumbuhan sehat, identik dengan budidaya jamur) + **putih** sebagai kanvas dominan. Ini bukan sekadar preferensi estetika — di produk ini "brand = sehat/tumbuh" sengaja disatukan dengan makna "status aman", karena mayoritas waktu chamber memang dalam kondisi normal dan UI tidak boleh terasa "menyala warna-warni" tanpa alasan.

| Peran | Warna | Kapan dipakai |
|---|---|---|
| Brand / Background | Hijau (forest) + Putih | Nav, card, tombol utama, mayoritas UI, status "aman"/"siap"/"selesai" |
| Netral | Sage (abu kehijauan) | Teks sekunder, border, status "idle"/"berjalan" (tint lebih terang/lunak dari brand) |
| Caution — **langka** | Amber | HANYA: `BELUM_SIAP`, sensor di zona waspada (dekat tepi rentang) |
| Danger — **langka** | Red | HANYA: alert `ANOMALY`, sensor di luar rentang jauh, batch `ABORTED` |

Gray scale tunggal: **sage** (abu yang ditarik ke arah hijau, bukan abu netral biasa) — dipakai untuk semua teks sekunder/border/background muted supaya keseluruhan UI tetap terasa satu keluarga warna, bukan "hijau sebagai aksen di atas app abu-abu generik". Saat menyentuh ulang `app/login/page.tsx` (dibuat sebelum revisi ini, masih pakai `gray`/`neutral`/`emerald` campuran), samakan ke token `sage`/`green` di bawah.

---

## 3. Primitive Tokens

### 3.1 Warna dasar

```css
:root {
  /* Putih murni — kanvas utama */
  --color-white: #FFFFFF;

  /* Sage — netral kehijauan (pengganti "slate" generik) */
  --color-sage-50:  #F7FAF8;
  --color-sage-100: #EEF3EF;
  --color-sage-200: #DCE5DE;
  --color-sage-300: #C2D0C5;
  --color-sage-400: #96A99B;
  --color-sage-500: #6B8072;
  --color-sage-600: #4F6355;
  --color-sage-700: #3A4A3F;
  --color-sage-800: #26302A;
  --color-sage-900: #16201A;
  --color-sage-950: #0B120E;

  /* Green — brand, dominan di seluruh sistem, juga status "safe" */
  --color-green-50:  #ECFDF3;
  --color-green-100: #D1FAE5;
  --color-green-200: #A7F3D0;
  --color-green-300: #6EE7B7;
  --color-green-400: #34D399;
  --color-green-500: #10B981;
  --color-green-600: #059669;  /* primary */
  --color-green-700: #047857;
  --color-green-800: #065F46;
  --color-green-900: #064E3B;
  --color-green-950: #022C22;

  /* Amber — LANGKA, hanya untuk caution (lihat §4.2) */
  --color-amber-50:  #FFFBEB;
  --color-amber-100: #FEF3C7;
  --color-amber-200: #FDE68A;
  --color-amber-500: #F59E0B;
  --color-amber-600: #D97706;

  /* Red — LANGKA, hanya untuk danger (lihat §4.2) */
  --color-red-50:  #FEF2F2;
  --color-red-100: #FEE2E2;
  --color-red-200: #FECACA;
  --color-red-500: #EF4444;
  --color-red-600: #DC2626;
}
```

Tidak ada lagi hue biru/sky di sistem ini — status "info/running" yang sebelumnya biru sekarang jadi hijau tint terang (§4.2), supaya benar-benar cuma dua warna acuan (hijau, putih) plus dua warna exception (merah, amber).

### 3.2 Spacing (4px base — dipakai apa adanya via utility Tailwind `p-*`, `gap-*`, tidak perlu token custom)

Pakai skala default Tailwind (`space-1`…`space-24`). Konvensi proyek ini:

| Konteks | Nilai |
|---|---|
| Gap antar elemen dalam komponen kecil (badge+label) | `gap-1.5` (6px) |
| Padding internal card | `p-4` mobile / `p-6` desktop |
| Gap antar card dalam grid | `gap-4` mobile / `gap-6` desktop |
| Margin antar section halaman | `space-y-6` mobile / `space-y-8` desktop |
| Padding halaman (page container) | `px-4 py-4` mobile / `px-8 py-6` desktop |

### 3.3 Tipografi

Font: **Geist Sans** (sudah ter-load via `next/font/local` di `app/layout.tsx`, jangan tambah font baru) untuk UI, **Geist Mono** khusus untuk angka sensor besar (mono bikin digit tidak "loncat" saat update real-time).

```css
:root {
  --font-size-xs:   0.75rem;   /* 12px — caption, timestamp */
  --font-size-sm:   0.875rem;  /* 14px — body sekunder, label */
  --font-size-base: 1rem;      /* 16px — body utama */
  --font-size-lg:   1.125rem;  /* 18px — sub-heading */
  --font-size-xl:   1.25rem;   /* 20px — card title */
  --font-size-2xl:  1.5rem;    /* 24px — page title */
  --font-size-3xl:  1.875rem;  /* 30px — angka metric card (mobile) */

  /* Khusus angka sensor besar (hero metric) — lebih besar dari skala UI biasa
     karena harus terbaca dari jarak/HP di lapangan */
  --font-size-metric:    2.5rem;   /* 40px mobile */
  --font-size-metric-lg: 3rem;     /* 48px desktop */

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

### 3.4 Radius, Shadow, Motion

```css
:root {
  --radius-sm: 0.375rem;  /* 6px — badge, input */
  --radius-md: 0.5rem;    /* 8px — button */
  --radius-lg: 0.75rem;   /* 12px — card */
  --radius-xl: 1rem;      /* 16px — modal, sheet mobile */
  --radius-full: 9999px;  /* pill, avatar */

  --shadow-card: 0 1px 3px 0 rgb(6 30 20 / 0.06), 0 1px 2px -1px rgb(6 30 20 / 0.06);
  --shadow-elevated: 0 10px 15px -3px rgb(6 30 20 / 0.08), 0 4px 6px -4px rgb(6 30 20 / 0.08);
  --shadow-toast: 0 20px 25px -5px rgb(6 30 20 / 0.15), 0 8px 10px -6px rgb(6 30 20 / 0.1);

  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-live-pulse: 2000ms; /* dot "live"/"berjalan" di chart & hero card */
}
```

Catatan: shadow pakai tint hijau-gelap (`rgb(6 30 20 / …)`) alih-alih hitam netral, konsisten dengan prinsip "satu keluarga warna" — efeknya halus tapi terasa lebih menyatu dibanding shadow abu-abu generik.

---

## 4. Semantic Tokens

Bagian paling penting: memetakan **enum asli di `prisma/schema.prisma`** ke bahasa visual, supaya konsisten di semua halaman.

### 4.1 Status generik (dipakai lintas komponen)

```css
:root {
  --color-background: var(--color-white);
  --color-background-subtle: var(--color-sage-50); /* section alternatif, bukan card */
  --color-foreground: var(--color-sage-900);
  --color-card: var(--color-white);
  --color-card-foreground: var(--color-sage-900);
  --color-border: var(--color-sage-200);
  --color-muted: var(--color-sage-100);
  --color-muted-foreground: var(--color-sage-500);

  --color-primary: var(--color-green-600);
  --color-primary-hover: var(--color-green-700);
  --color-primary-foreground: var(--color-white);
  --color-ring: var(--color-green-500);

  /* Status — HANYA 4 token ini yang boleh dipakai untuk mewarnai makna
     "kondisi", jangan pernah pasang hex/nama warna Tailwind langsung. */
  --color-status-safe: var(--color-green-600);
  --color-status-safe-bg: var(--color-green-50);
  --color-status-safe-border: var(--color-green-200);

  --color-status-progress: var(--color-green-500);       /* "berjalan/dalam proses" — hijau lebih terang, bukan solid */
  --color-status-progress-bg: var(--color-sage-50);
  --color-status-progress-border: var(--color-green-200);

  --color-status-caution: var(--color-amber-600);          /* LANGKA */
  --color-status-caution-bg: var(--color-amber-50);
  --color-status-caution-border: var(--color-amber-200);

  --color-status-danger: var(--color-red-600);             /* LANGKA */
  --color-status-danger-bg: var(--color-red-50);
  --color-status-danger-border: var(--color-red-200);

  --color-status-neutral: var(--color-sage-500);
  --color-status-neutral-bg: var(--color-sage-100);
  --color-status-neutral-border: var(--color-sage-200);
}

.dark {
  --color-background: var(--color-sage-950);
  --color-background-subtle: var(--color-sage-900);
  --color-foreground: var(--color-sage-50);
  --color-card: var(--color-sage-900);
  --color-card-foreground: var(--color-sage-50);
  --color-border: var(--color-sage-800);
  --color-muted: var(--color-sage-800);
  --color-muted-foreground: var(--color-sage-400);

  --color-status-safe-bg: rgb(6 78 59 / 0.35);
  --color-status-progress-bg: rgb(6 30 20 / 0.5);
  --color-status-caution-bg: rgb(120 53 15 / 0.3);
  --color-status-danger-bg: rgb(127 29 29 / 0.3);
  --color-status-neutral-bg: var(--color-sage-800);
}
```

### 4.2 Mapping enum → status warna (rujukan wajib dipakai konsisten)

**`Batch.status` (`BatchStatus`)**

| Enum | Token | Label UI | Ikon pembeda |
|---|---|---|---|
| `RUNNING` | `--color-status-progress` | "Berjalan" | dot berdenyut (`animate-pulse`) |
| `READY` | `--color-status-safe` | "Siap Sterilisasi" | ikon centang solid |
| `COMPLETED` | `--color-status-neutral` | "Selesai" | ikon centang outline |
| `ABORTED` | `--color-status-danger` | "Dibatalkan" | ikon silang |

**`AIDecision.status` (`ReadinessStatus`)** — `BELUM_SIAP` di awal proses itu **wajar**, bukan bahaya, tapi tetap dapat treatment amber tipis (bukan hijau) supaya operator tahu "belum boleh sterilisasi", beda dari sekadar "sedang berjalan".

| Enum | Token | Label UI |
|---|---|---|
| `BELUM_SIAP` | `--color-status-caution` (amber, tint tipis) | "Belum Siap" |
| `DALAM_PROSES` | `--color-status-progress` (hijau terang) | "Dalam Proses" |
| `SIAP_STERILISASI` | `--color-status-safe` (hijau solid) | "Siap Sterilisasi" |

**`Alert.type` (`AlertType`)**

| Enum | Token | Label UI |
|---|---|---|
| `ANOMALY` | `--color-status-danger` | "Anomali" |
| `READY` | `--color-status-safe` | "Media Siap" |

**Sensor range zone** (suhu/kelembapan/pH terhadap threshold `lib/ai/evaluateReadiness.ts`) — 3 zona graduated:

| Zona | Kondisi | Token |
|---|---|---|
| Aman | dalam rentang target | `--color-status-safe` |
| Waspada | di luar rentang tapi masih dalam margin ±10% dari batas | `--color-status-caution` |
| Bahaya | melewati margin waspada | `--color-status-danger` |

Threshold rujukan (`THRESHOLDS` di `lib/ai/evaluateReadiness.ts`): suhu 25–35°C, pH 6–7, kelembapan 60–65%.

> **Kenapa `safe` dan `progress` sama-sama hijau tidak masalah:** karena dibedakan tiga lapis sekaligus — shade (solid pekat vs tint terang), ikon (centang vs dot berdenyut), dan bobot visual (background tint kuat vs nyaris putih). Ini konsisten dengan prinsip §1 "jangan andalkan warna saja", cuma di sini diterapkan antar-sesama-hijau, bukan cuma hijau-vs-lainnya.

---

## 5. Component Tokens & Specs

### 5.1 Sidebar / Bottom Nav (App Shell)

- **Desktop (≥1024px):** sidebar kiri persisten, lebar `240px`, background `--color-card` (putih), border kanan `--color-border`. Item nav aktif = background `--color-green-50` + teks `--color-green-700` + indikator garis kiri 3px hijau.
- **Tablet (768–1023px):** sidebar collapse jadi ikon saja (`64px`), expand on hover/tap.
- **Mobile (<768px):** sidebar hilang, ganti **bottom tab bar** fixed (height `64px`, putih, border atas `--color-border`, `shadow-elevated` menghadap atas), 4 tab: Dashboard, Monitor, Riwayat, Akun.
- Item nav: Dashboard Utama (`/`), Pre-Conditioning Monitor (`/monitor`), Riwayat Produksi (`/riwayat`).

### 5.2 Topbar

Height `56px` mobile / `64px` desktop, sticky top, putih + border bawah `--color-border`. Isi (kiri→kanan): judul halaman, **chip status chamber** (selalu terlihat), lonceng notifikasi (badge merah — satu-satunya elemen dekoratif yang boleh merah di luar alert itu sendiri, karena badge jumlah notifikasi secara fungsi memang representasi "ada yang perlu perhatian"), avatar+nama+role, logout.

### 5.3 Chamber Status Hero Card

Komponen paling penting di Dashboard Utama — full-width, di paling atas.

```
┌──────────────────────────────────────────────────┐
│  ● BERJALAN                    Batch #a1b2c3      │  ← hijau terang + dot pulse
│                                                    │
│  ✓ SIAP STERILISASI                  conf. 94%    │  ← hijau solid + ikon centang
│  "Suhu, kelembapan, dan pH stabil di rentang       │
│   target selama 5 pembacaan terakhir."             │  ← reasoning, text-sm muted
│                                                    │
│  Estimasi selesai: ~2 jam lagi                     │
└──────────────────────────────────────────────────┘
```

- Background card mengikuti **status AI** (bukan status batch): tint `--color-status-{safe|progress|caution}-bg`, border 1px `--color-status-*-border`, teks status pakai token solid.
- Dot `●` berdenyut pelan (`--duration-live-pulse`) khusus untuk state "berjalan/dalam proses"; begitu jadi `SIAP_STERILISASI`, dot diganti ikon centang statis — perubahan bentuk ini sinyal tambahan di luar warna (lihat catatan §4.2).
- Confidence ditampilkan sebagai angka `%`, bukan progress bar (progress bar mengundang tafsir "makin penuh makin siap" yang salah — confidence AI rule-based, bukan linear terhadap waktu).

### 5.4 Metric Card (Suhu / Kelembapan / pH)

Grid 3 kolom desktop, 1 kolom mobile (stack), tiap card:

```
┌───────────────────┐
│ SUHU          ●live│
│                    │
│   32.4°C           │  ← font-size-metric(-lg), font-mono, bold
│                    │
│ ▂▃▅▆▅▃▂ (sparkline) │
│ ▬▬▬▬●▬▬ 25──35°C   │  ← range indicator bar
└───────────────────┘
```

- Angka pakai `font-mono` + `--font-size-metric`. Warna angka: **aman → `--color-sage-900`** (netral gelap, sengaja TIDAK dihijaukan — kalau semua angka aman diwarnai hijau, mata jadi terbiasa "hijau = abaikan" dan warna kehilangan makna sinyal). Warna cuma dipakai untuk menarik perhatian saat **caution (amber-600)** atau **danger (red-600)**, plus background tint tipis di card itu sendiri.
- **Range indicator bar**: garis horizontal tipis dengan pita hijau di tengah menandai rentang target, titik penanda posisi nilai saat ini (titik jadi amber/merah kalau keluar rentang).
- Sparkline: 10–15 titik terakhir, warna hijau (`--color-green-500`) — tanpa axis, cuma tren kasar.
- Titik "●live" hijau (bukan sekadar hijau umum, tapi `--color-status-progress`) kalau ada data masuk dalam 10 detik terakhir (SSE `app/api/stream/sensor-readings`); jadi sage abu-abu + label "offline" kalau lebih dari itu (mendukung NFR "tampilkan status disconnected" di `PRD.md` §12) — ini satu-satunya tempat abu-abu dipakai sebagai sinyal status, karena "offline" secara sengaja bukan hijau (data mati) ataupun merah (bukan bahaya aktif, cuma tidak ada data).

### 5.5 Sensor Time-Series Chart (Recharts) — Pre-Conditioning Monitor

- `<LineChart>` gabungan 3 parameter dengan toggle visibility per parameter (chip filter di atas chart).
- `<ReferenceArea>` untuk pita rentang aman (y1=min, y2=max threshold), fill `--color-status-safe-bg` — **wajib ada**, bukan opsional (poin checklist "threshold line" di `TASKPLAN.md`).
- `<ReferenceLine>` dashed di y=min dan y=max, stroke `--color-status-safe`, label kecil di ujung kanan ("35°C").
- Titik data di luar rentang di-highlight: dot lebih besar, warna amber/merah sesuai zona — supaya episode "keluar target" gampang di-spot di kurva.
- **Warna garis per parameter — monokromatik hijau + dibedakan lewat bentuk garis**, bukan hue berbeda (sistem ini sengaja tidak punya hue lain selain hijau/putih untuk elemen non-status):

  | Parameter | Warna | Gaya garis |
  |---|---|---|
  | Suhu | `--color-green-700` (paling gelap) | solid |
  | Kelembapan | `--color-green-500` (medium) | dashed |
  | pH | `--color-green-300` (paling terang, garis diberi outline tipis sage-600 agar tetap kebaca di atas background putih) | dotted |

  Redundansi warna+gaya garis ini penting justru karena satu hue: legend wajib selalu tampil (jangan disembunyikan di mobile meski ringkas), dan tooltip hover menyebut nama parameter secara eksplisit.
- X-axis: waktu, format pendek (`HH:mm`), tampilkan max ~6 tick supaya tidak padat di mobile.
- Live update: chart nge-append titik baru dari event SSE tanpa remount (pakai `key` stabil per batch, bukan per-render).

### 5.6 AI Decision Panel

Card terpisah di bawah/samping chart pada halaman Monitor (versi lebih detail dari hero card §5.3): status badge besar, confidence, reasoning lengkap, riwayat 5 keputusan terakhir sebagai timeline mini (titik + label status + jam, warna sesuai §4.2), dan estimasi waktu tersisa (tampilkan sebagai rentang "~1–2 jam lagi", bukan angka presisi palsu — ini rule-based, jangan beri kesan presisi ML yang tidak ada).

### 5.7 Kontrol Aerasi

Toggle switch besar "Manual / Otomatis" (segmented control, warna aktif hijau solid). Saat manual: slider/stepper kecepatan fan (0–100%) + tombol besar on/off dengan border hijau tebal saat aktif. Saat otomatis: kontrol manual disabled (opacity 50%) + teks "AI mengatur aerasi otomatis".

### 5.8 Alert Banner & Toast

Ini tempat merah/amber benar-benar dipakai — dan karena langka di seluruh sistem, efeknya justru lebih kuat.

**Banner** (persisten, inline di atas konten halaman, untuk alert yang belum `resolved`):

```
┌──────────────────────────────────────────────────┐
│ ⚠ Anomali — Suhu melonjak 12.0°C dalam satu       │
│   interval pembacaan (37.5°C → 49.4°C)     [Tutup]│
└──────────────────────────────────────────────────┘
```
Background `--color-status-danger-bg`, border-left 4px `--color-status-danger`, ikon peringatan solid. Tombol "Tutup" hanya menyembunyikan secara lokal, tidak mengubah `Alert.resolved` (itu aksi eksplisit terpisah, misal dari halaman detail batch).

**Toast** (ephemeral, pojok kanan atas, auto-dismiss): dipicu tiap kali SSE mengirim `AIDecision` baru dengan status `SIAP_STERILISASI` (transisi, bukan tiap tick — `lib/sensors/ingest.ts` sudah idempotent, jadi toast juga otomatis tidak spam) atau `Alert` baru type `ANOMALY`. Toast sukses (`SIAP_STERILISASI`/`READY`) pakai tint hijau; toast anomali pakai tint merah dan **tidak auto-dismiss** — harus ditutup manual, jangan biarkan alert bahaya hilang sendiri sebelum dibaca. `shadow-toast`, radius `--radius-lg`, slide-in dari kanan.

### 5.9 Batch Table (Riwayat Produksi)

Desktop: table biasa (header `--color-sage-50`, hover row `--color-sage-50`). Mobile: **card list** (bukan table di-scroll horizontal). Tiap baris/card: badge status (§4.2), formula (truncate 1 baris), durasi, tanggal mulai, tombol "Detail →". Sort default: `startTime desc`.

Statistik agregat di atas table: 3–4 stat tile kecil (rata-rata durasi, tingkat keberhasilan = `COMPLETED / (COMPLETED+ABORTED)`, jumlah batch bulan ini) — komponen sama dengan Metric Card (§5.4) tapi ukuran font lebih kecil (`--font-size-2xl`), warna angka tetap netral sage-900 (bukan hijau) kecuali tingkat keberhasilan yang boleh dihijaukan kalau di atas ambang tertentu (mis. >80%) sebagai penguat positif.

### 5.10 Batch Detail

Header: badge status + formula + rentang tanggal. Di bawahnya: chart sensor historis batch itu (reuse §5.5, tanpa live-update), lalu timeline `AIDecision` dan `Alert` batch tersebut secara kronologis (dot warna sesuai §4.2 di garis vertikal sage-200, seperti activity log).

### 5.11 Login (`app/login/page.tsx` — sudah ada, selaraskan token saat disentuh lagi)

Card `max-w-sm`, center screen, background halaman putih/`--color-background-subtle` (bukan `bg-gray-50 dark:bg-neutral-950` seperti sekarang). Tombol submit pakai token `--color-primary` (green-600), bukan hardcode `emerald-600` langsung — sudah dekat karena emerald lama kebetulan searah dengan green baru, tapi ganti semua referensi `gray-*`/`neutral-*` ke `sage-*` dan pastikan tidak ada sisa warna lain.

---

## 6. Layout per Halaman

| Halaman | Route | Struktur utama |
|---|---|---|
| Login | `/login` | Center card, tanpa app shell |
| Dashboard Utama | `/` | App shell → Hero Card (5.3) → grid 3 Metric Card (5.4) → Alert Banner list (5.8) → shortcut ke batch aktif |
| Pre-Conditioning Monitor | `/monitor` (atau `/batches/[id]`) | App shell → chart besar (5.5) full-width → AI Decision Panel (5.6) + Kontrol Aerasi (5.7) berdampingan (desktop) / stack (mobile) |
| Riwayat Produksi | `/riwayat` | App shell → stat tiles (5.9) → Batch Table/List (5.9) → klik baris → Batch Detail (5.10) |

## 7. Breakpoints & Responsive

Pakai default Tailwind: `sm 640` `md 768` `lg 1024` `xl 1280`. Aturan wajib:

- Nav: sidebar (≥1024px) vs bottom tab bar (<1024px) — lihat §5.1.
- Grid metric card: `grid-cols-1` mobile → `grid-cols-3` `md:` ke atas.
- Table → card list di bawah `md`.
- Chart tetap full-width di semua breakpoint; legend tetap tampil (§5.5 — penting justru karena monokromatik), tapi kurangi jumlah tick sumbu-X di mobile.
- Semua target tap minimal `44×44px` (kontrol aerasi, tombol toast/banner close, item nav mobile).

## 8. Dark Mode

Aktif via `class="dark"` di `<html>` (Tailwind `darkMode: 'class'`), toggle manual di menu akun — **bukan** auto-follow OS, karena penggunaan di lapangan (siang hari terik) justru sering butuh mode terang kontras tinggi terlepas dari jam. Background dark pakai `--color-sage-950` (hijau-hitam, bukan abu-hitam netral) supaya identitas warna tetap konsisten di kedua tema. `--color-status-*` tidak berubah hue di dark mode, cuma background tint-nya jadi lebih gelap transparan.

## 9. Tailwind Config (siap pakai)

Tambahkan ke `tailwind.config.ts` (`theme.extend`), lengkapi CSS variables di atas ke `app/globals.css` dalam `@layer base`:

```ts
// tailwind.config.ts — theme.extend
{
  colors: {
    background: "var(--color-background)",
    "background-subtle": "var(--color-background-subtle)",
    foreground: "var(--color-foreground)",
    card: { DEFAULT: "var(--color-card)", foreground: "var(--color-card-foreground)" },
    border: "var(--color-border)",
    muted: { DEFAULT: "var(--color-muted)", foreground: "var(--color-muted-foreground)" },
    primary: { DEFAULT: "var(--color-primary)", hover: "var(--color-primary-hover)", foreground: "var(--color-primary-foreground)" },
    ring: "var(--color-ring)",
    status: {
      safe: "var(--color-status-safe)",
      "safe-bg": "var(--color-status-safe-bg)",
      "safe-border": "var(--color-status-safe-border)",
      progress: "var(--color-status-progress)",
      "progress-bg": "var(--color-status-progress-bg)",
      "progress-border": "var(--color-status-progress-border)",
      caution: "var(--color-status-caution)",
      "caution-bg": "var(--color-status-caution-bg)",
      "caution-border": "var(--color-status-caution-border)",
      danger: "var(--color-status-danger)",
      "danger-bg": "var(--color-status-danger-bg)",
      "danger-border": "var(--color-status-danger-border)",
      neutral: "var(--color-status-neutral)",
      "neutral-bg": "var(--color-status-neutral-bg)",
      "neutral-border": "var(--color-status-neutral-border)",
    },
  },
  fontSize: {
    metric: ["var(--font-size-metric)", { lineHeight: "1.1", fontWeight: "700" }],
    "metric-lg": ["var(--font-size-metric-lg)", { lineHeight: "1.1", fontWeight: "700" }],
  },
  borderRadius: {
    card: "var(--radius-lg)",
  },
  boxShadow: {
    card: "var(--shadow-card)",
    elevated: "var(--shadow-elevated)",
    toast: "var(--shadow-toast)",
  },
}
```

Contoh pemakaian di komponen (bukan hardcode hex/nama warna Tailwind langsung):

```tsx
// Badge status AI — pakai helper kecil, bukan if/else warna berulang di tiap komponen
const STATUS_STYLE: Record<ReadinessStatus, string> = {
  BELUM_SIAP: "bg-status-caution-bg text-status-caution border-status-caution-border",
  DALAM_PROSES: "bg-status-progress-bg text-status-progress border-status-progress-border",
  SIAP_STERILISASI: "bg-status-safe-bg text-status-safe border-status-safe-border",
};
```

Simpan mapping seperti ini di satu file (`lib/ui/status-styles.ts`) supaya §4.2 punya satu sumber kebenaran di kode, tidak diulang-ulang di tiap komponen.

## 10. Aksesibilitas & Anti-Pola

- Kontras minimal 4.5:1 untuk teks, 3:1 untuk komponen UI — semua kombinasi token di §4.1 sudah dipilih memenuhi ini di kedua tema.
- Status **selalu** teks + ikon + warna. Untuk pasangan status yang sama-sama hijau (`safe` vs `progress`), ikon/bentuk (centang vs dot pulse) **wajib** beda, tidak boleh mengandalkan shade saja (§4.2).
- Chart monokromatik hijau (§5.5) **wajib** dibedakan lewat gaya garis (solid/dashed/dotted) + legend selalu tampil — warna saja tidak cukup untuk 3 parameter dalam satu hue.
- Merah dan amber **hanya** untuk status caution/danger yang didefinisikan di §4.2. Jangan pernah dipakai untuk ilustrasi, highlight promosi, atau dekorasi apa pun — begitu dipakai di luar makna itu, sinyal alert jadi tidak bisa dipercaya lagi oleh operator.
- Jangan pakai gradient di card status — flat tint + border 1px (§5.3), supaya warna terbaca akurat.
- Jangan buat progress bar untuk confidence AI (§5.3) — rule-based, bukan proses linear.
- Jangan render tabel mentah di mobile untuk Riwayat Produksi — wajib card list (§5.9).
