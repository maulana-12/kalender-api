# Plan - kalender-api

> Dokumen acuan proyek. Berisi keputusan yang sudah final dan langkah berikutnya.
> Untuk **kenapa** suatu keputusan diambil, lihat `decision-log.md`.
> Untuk **apa yang berubah**, lihat `change-log.md`.

**Status:** Fase 1 dan 2 selesai. Fase 3 (Worker) dan 4 (Docker) belum mulai.

> **Bagian 3 sampai 9 di bawah sudah usang.** Ditulis sebelum SKB 2026 dibaca
> langsung, dan asumsi-asumsinya sudah dikoreksi lewat D-009 sampai D-012.
> Baca **Bagian 0** dulu. Teks lamanya sengaja dibiarkan supaya bisa dibandingkan,
> tapi kalau bertentangan dengan Bagian 0, Bagian 0 yang menang.
**Terakhir diperbarui:** 2026-09-29

---

## Addendum 2026-09-29 - halaman `/kalender` dan `dist/kalender.html`

Di luar roadmap awal (bagian 8), ditambahkan kalender visual di dua jalur:

- `GET /kalender` di server, dirender dari `dataset.ts`. Bisa ganti tahun
  (`?year=`), menampilkan setahun penuh terpisah per bulan, atau satu bulan
  (`?month=`). Tidak butuh API key karena datanya dibaca langsung dari
  `dataset.ts`, bukan memanggil `/api/*`.
- `dist/kalender.html` untuk GitHub Pages, tampilan sama tapi datanya dibaca dari
  file JSON publik saat halaman dibuka, bukan di-bundle.

Aritmetika bulan, nama bulan dan hari, serta validasi tidak ditulis dua kali:
semuanya dari `core/`. Markup-nya memang dua, karena satu file tidak bisa jalan
di server dan di browser. Alasan lengkap di D-017 dan D-018, ringkasan
perubahan di `change-log.md` entri 2026-09-29.

---

## 0. Addendum 2026-09-28 - ini menggantikan bagian yang sudah usang

Bagian 3 sampai 6 di bawah ini ditulis sebelum data 2026 di tangan. Setelah SKB
dibaca langsung, tiga asumsi therein terbukti salah, dan sekarang sudah dikoreksi
melalui D-009 sampai D-012. Entri lama sengaja tidak dihapus supaya riwayatnya
terbaca; kalau bertentangan, **addendum ini yang menang**.

| Yang tertulis di bawah | Kenyataannya sekarang |
| ---------------------- | --------------------------------------------------------- |
| `src/core/` boleh pakai `Intl` dan `node:fs` | Nol dependency runtime **dan** nol I/O. Ditegakkan `test/core-purity.test.ts`. |
| Ada generator tanggal + `overrides.json` | Dihapus. Data ditulis tangan dari SKB. Lihat D-012. |
| `data/2026.json` | `data/holidays-{year}.json`, satu file per tahun, tanpa file gabungan. Lihat D-011. |
| `Intl` sudah menyediakan kalender religious | Ada, tapi hasilnya tidak sama dengan SKB. Lihat catatan di bawah. |
| Roadmap: fase 1 menghasilkan "15 hari libur ter-generate" | 25 entri, ditulis tangan: 17 libur nasional + 8 cuti bersama. |

Catatan soal `Intl`: `Intl` memang menyediakan `islamic-umalqura`, tapi hasilnya
tidak sama dengan SKB. Untuk Idul Fitri 1447 H, `Intl` menghasilkan 2026-03-20
sedangkan SKB menetapkan 21-22 Maret 2026. Perbedaannya disengaja, bukan bug
aritmetika. Karena itu `Intl` tidak dipakai untuk menghasilkan tanggal sama sekali,
cuma jadi pemeriksa silang di test.

Status implementasi saat ini:

- [x] `src/core/` murni, tanpa I/O
- [x] `data/holidays-2026.json` (25 entri, SKB 1497/2025, 2/2025, 5/2025)
- [x] `scripts/build-static.ts` memvalidasi lalu menyalin byte-identik
- [x] `src/app.ts` dengan 5 route
- [x] 46 test lulus, typecheck bersih
- [ ] 2024 dan 2025 (menunggu verifikasi amandemen SKB)
- [ ] `wrangler.toml` asli (hanya `.example` yang ada)
- [ ] `Dockerfile`

---

## 1. Ringkasan

REST API data kalender nasional Indonesia: hari libur nasional, cuti bersama, dan hari
peringatan. Distribusi lewat tiga jalur supaya bisa dipakai tanpa biaya, tapi tetap
tersedia kalau butuh query dinamis.

## 2. Prinsip Arsitektur

> **Satu core, tiga output. Data adalah produknya, API cuma pembungkus tipis.**

```
                              ->  dist/*.json   ->  GitHub Pages (statis, publik, gratis)
data/ --generate-->  ---------->  Worker         ->  Cloudflare (API key, rate limit)
                              ->  Node server   ->  Docker / VPS
```

Aturan yang tidak boleh dilanggar:

- `src/core/` **wajib** zero dependency runtime. Hanya boleh pakai `Intl` dan `node:fs`.
  Kalau core mulai import Hono atau library lain, expect drift antar target.
- Build script **tidak pernah** menyentuh Hono atau HTTP. Dia memanggil `core` langsung.
- `src/app.ts` berisi seluruh aplikasi Hono. Entrypoint Worker dan Node cuma 5 baris
  masing-masing dan **tidak berubah seumur proyek**.

## 3. Stack

| Layer | Pilihan | Alasan |
|---|---|---|
| Bahasa | **TypeScript** | `Intl` punya kalender religious; 1 toolchain untuk 3 target |
| HTTP | **Hono 4.13.9** | satu file jalan di Workers, Node, Deno, Bun |
| Node adapter | `@hono/node-server` 2.1.1 | |
| Worker | `wrangler` | |
| Test | `vitest` | wajib, untuk validasi tanggal |
| Runtime | Node 22 | |
| Container | `node:22-alpine` multi-stage | |

### Kenapa bukan Go / Python

- **Go** - Workers hanya dukungan lewat shim komunitas `workers-go` (3 star, unofficial).
  Tidak first-class di Cloudflare. Aman untuk server, tapi repo ini butuh 3 target.
- **Python** - Workers baru GA 21 Sep 2026, jadi sebenarnya viable. Tapi butuh toolchain
  kedua (`py` + `uv`) dan kalender Hijriah harus dari package pihak ketiga, sedangkan
`Intl` sudah menyediakannya di TS.

Detail di `decision-log.md` D-001.

## 4. Struktur Repo

```
kalender-api/
|- data/
|  |- 2026.json            <- hasil generate (di-commit)
|  `- overrides.json       <- koreksi manual dari SKB 3 Menteri
|- src/
|  |- core/                <- pure, zero dependency
|  |  |- types.ts
|  |  |- calendars.ts      <- wrapper Intl
|  |  |- rules.ts          <- definisi 15 hari libur
|  |  |- generate.ts       <- generateYear()
|  |  `- index.ts
|  |- app.ts               <- seluruh app Hono + middleware
|  |- worker/index.ts      <- export default { fetch: app.fetch }
|  `- server/index.ts      <- serve(app)
|- scripts/
|  |- build-static.ts      <- panggil core, tulis dist/ (TANPA Hono)
|  `- load-overrides.ts
|- test/
|- dist/                   <- output, di-commit untuk Pages
|- .github/workflows/deploy.yml
|- Dockerfile
|- wrangler.toml
`- package.json
```

## 5. Mesin Kalender

Bagian paling berisiko. Salah satu hari = seluruh repo credibility hilang.

`Intl` di V8 menyediakan `islamic-umalqura` dan `chinese` - sudah diverifikasi di
Node v24.21.0. Contoh: `2026-03-20` -> `1447-10-1` (1 Syawal 1447 = Idul Fitri 2026).

Cara konversi Hijriah -> Masehi: scan window +/-400 hari, bandingkan output `Intl` dengan
target. ~400 panggilan, sangat cepat, dan hasilnya **identik** di Node maupun Worker
(keduanya V8).

| Kalender | Sumber | Status |
|---|---|---|
| Hijriah | `Intl` `islamic-umalqura` | [ok] sudah diverifikasi |
| China / Kongzili | `Intl` `chinese` | [ok] tersedia |
| Masehi bergerak (Paskah, Jumat Agung) | algoritma Gregory | perlu implementasi |
| Saka Bali (Nyepi) | **tidak ada di `Intl`** | perlu tabel kecil |
| Buddha (Waisak) | full moon | perlu implementasi |

## 6. Pipeline Data

Data **tidak bisa** 100% dihitung, karena pemerintah mengubah tanggal menjelang hari-H.
Contoh nyata: SKB 712/2021 menggeser Tahun Baru Islam dan Maulid Nabi untuk menghindari
long weekend.

```
rules.ts ---> generator ---> overrides.json ---> data/2026.json
 (tetap +    (hitung)      (SKB 3 Menteri)      (hasil final,
  bergerak)                                 selalu menang)
```

Koreksi SKB **selalu menang** atas hasil hitungan. Ini bukan fallback, ini sumber kebenaran.

## 7. Batasan GitHub Pages

Sudah diverifikasi terhadap dokumentasi resmi.

| Batas | Nilai | Dampak |
|---|---|---|
| Ukuran site | maks 1 GB | non-issue, proyeksi < 300 KB |
| Timeout deploy | 10 menit | aman |
| Bandwidth | 100 GB/bulan (soft) | bisa kena kalau popular |
| Build | 10/jam, kecuali Actions sendiri | kita pakai Actions |

**Tidak bisa:** custom header (`_headers` diabaikan, `Cache-Control` dipaksa
`max-age=600`), preflight `OPTIONS`, query param, API key.

**Bisa:** perTahun JSON, `all.json`, `index.json` manifest, `index.html` demo
client-side, `holidays.ics`, custom domain + HTTPS, deploy via Actions.

Konsekuensi: jangan pakai URL ber-hash untuk cache busting di Pages - percuma, CDN
revalidate tiap 10 menit. Simpan versioning di field `meta`.

### Yang bernilai: `holidays.ics`

Feed iCal supaya orang bisa subscribe libur nasional ke Google Calendar. `DTSTART`
ditulis per tahun, **bukan** `RRULE:FREQ=YEARLY` - hari raya bergeser tiap tahun.

## 8. Roadmap

| Fase | Isi | Selesai bila |
|---|---|---|
| 1 | `core/` + kalender + generator + test | 15 hari libur ter-generate, tervalidasi vs SKB tahun lampau |
| 2 | `build-static` -> `dist/` + deploy Pages | `https://<user>.github.io/kalender-api/2026.json` hidup |
| 3 | Worker + API key + rate limit | `wrangler deploy` berhasil, key ditolak kalau salah |
| 4 | Docker + compose | `docker run -p 3000:3000` jalan |
| 5 | CI: generate -> test -> commit -> deploy | push ke `main` auto-deploy kemana-mana |

**Jangan mulai Fase 3 sebelum Fase 2 kelar.** Worker bikin ribet auth sebelum tahu
datanya benar. Fase 2 juga jadi bukti bahwa kalendernya benar, karena hasilnya
bisa diinspeksi langsung tanpa infrastruktur.

## 9. Pertanyaan Terbuka

Belum diputuskan - jawaban butuh dari maintainer.

- [ ] Model API key: rate limit saja, atau billing/kuota per key?
      Catatan: data yang sama dipublish terbuka di Pages, jadi key **bukan** untuk
      rahasia. Fungsinya rate limit, prioritas, dan metrik.
- [ ] Asal data: murni generator + manual override, atau scraping SKB nanti?
- [ ] Struktur repo: satu repo monorepo, atau pisah `lib` + `apps`?
- [ ] Seberapa tahun dipublish: 2020-2050, atau lebih?
- [ ] Apakah butuh kalender Hijriah jadi output juga (bukan cuma Masehi)?

## 10. Referensi

- SKB 3 Menteri: Kementerian Agama, Ketenagakerjaan, dan PANRB
- PP 17/2021 tentang Hari Libur Nasional
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Hono: https://hono.dev/docs
