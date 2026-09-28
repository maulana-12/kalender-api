# Change Log

> **Aturan: append only, entri terbaru di paling atas.**
> Entri yang sudah ada tidak boleh diedit, dipindah, atau dihapus. Untuk mengoreksi
> entri lama, tambahkan entri baru yang merujuk nomor-nya.

Mencatat perubahan pada **isi repo**. Untuk alasan di balik keputusan, lihat
`decision-log.md`.

---

## 2026-09-28 - Static page untuk GitHub Pages, nol dependency baru

**Perubahan**

- `src/pages/static.tsx` - dokumentasi untuk distribusi statis. Sengaja beda dari
  `docs.tsx`: menjelaskan file dan cara membacanya, bukan endpoint dan header auth.
  Semua link relatif supaya tidak rusak saat repo di-fork.
- `scripts/build-static-page.ts` - render ke `dist/index.html`. Script terpisah,
  bukan digabung ke `build-static.ts`, karena `AGENTS.md` bagian 1 melarang
  `build-static.ts` menyentuh Hono.
- `test/static-page.test.ts` - 8 test, total 61.
- `.github/workflows/pages.yml` - typecheck, test, build statis, guard
  byte-identik, upload `dist/`, deploy.
- `.gitignore` - `wrangler.toml` jadi `wrangler*.toml` plus `!*.example`, ditambah
  `.dev.vars` dan `.dev.vars.*`. Variasi seperti `wrangler.dev.toml` sebelumnya bocor.
- `package.json` - script `build:static-page`, dan masuk ke `build`.

**Kenapa halaman baru, bukan pakai yang ada**

GitHub Pages tidak menjalankan Node: tidak ada server, tidak ada auth, tidak ada
request. Halaman server menyebut `Authorization: Bearer` dan kode error HTTP,
padahal tidak satu pun berlaku di sana. Dua produk dengan aturan berbeda perlu
dua dokumen.

**Guard di CI**

Workflow membandingkan tiap `data/holidays-*.json` dengan `dist/` pakai `cmp`
sebelum upload. Kalau `build-static` pernah berubah bentuk sampai mengubah byte,
deploy berhenti di situ, bukan diam-diam meng-upload data yang berubah.

Tahun dan jumlah entri dibaca dari `dist/index.json`, bukan dari konstanta.
Jumlah entri yang berbeda antar tahun membuat generator gagal keras.

**Verifikasi**

- typecheck bersih, 61/61 test lulus, `npm run build` hijau.
- `dist/holidays-2026.json` masih byte-identik dengan `data/`.
- Disajikan lewat `python3 -m http.server`: `/` 200 `text/html`, link JSON di
  dalam halaman 200, `holidays-2024.json` 404.
- Tidak ada link absolut di halaman; 2024/2025/2030 tidak muncul sebagai link.
- Guard `cmp` yang sama di workflow dijalankan lokal dan lolos.

**Belum aktif**

Deploy baru jalan setelah Settings di repo diarahkan ke Source: GitHub Actions.
Perlu user yang melakukannya lewat menu Settings, bukan dari kode.

---

## 2026-09-28 - Halaman dokumentasi di /, build step jadi wajib

**Perubahan**

- `src/pages/docs.tsx` - halaman dokumentasi Bahasa Indonesia, stateless, menerima
  `years` dan `origin` lewat props. Cakupannya: mulai cepat, daftar endpoint, tabel
  parameter, contoh curl dan JavaScript, kode error, dan jalur JSON statis tanpa key.
- `src/app.ts` jadi `src/app.tsx` - wajib, karena esbuild membaca `.ts` sebagai
  TypeScript biasa dan JSX-nya jadi syntax error. Import di `src/worker/index.ts`,
  `src/server/index.ts`, dan `test/app.test.ts` disesuaikan.
- `scripts/build-server.ts` - bundler server ke `build/`.
- `tsconfig.json` - ditambah `jsx: react-jsx` dan `jsxImportSource: hono/jsx`.
- `package.json` - `esbuild` 0.28.2 sebagai devDependency; `dev` dan `start` sekarang
  menjalankan `build/server.js`; `build` menjalankan build:static dan build:server.
- `.gitignore` - `build/` masuk daftar ignore.
- `test/app.test.ts` - 7 test baru untuk halaman dokumentasi, total 53.

**Perubahan yang harus disadari**

Build step sekarang WAJIB untuk menjalankan server. Sebelumnya `node src/server/index.ts`
bisa jalan karena Node melakukan type stripping sendiri; Node tidak bisa transform
JSX (`ERR_UNKNOWN_FILE_EXTENSION`). Ini konsekuensi dari memilih JSX, bukan
efek samping yang bisa dihindari.

Output bundler ditulis ke `build/`, bukan `dist/`. `dist/` tetap murni JSON untuk
GitHub Pages dan tetap byte-identik dengan `data/`.

**Bug yang ditemukan verifikasi HTML, bukan typecheck**

Kolom "Ketika" di tabel kode error ter-render kosong (`<td></td>`) karena komponen
salah nama field. TypeScript tidak menangkapnya karena tipenya masih valid. Test
sekarang mengecek `<td></td>` dan string `undefined` tidak muncul di HTML.

**Verifikasi**

- typecheck bersih, 53/53 test lulus.
- `dist/holidays-2026.json` masih byte-identik dengan `data/holidays-2026.json`.
- Server dari `build/server.js`: `/` 200 `text/html`, `/health` 200, `/api/holidays`
  200 dengan key, 401 tanpa key, 404 untuk 2024.
- Nav, anchor, tabel endpoint, dan CSS inline ter-render benar.
- `2024` dan `2025` tidak muncul sebagai tahun tersedia; `2026-02-30` muncul hanya
  di tabel contoh error.
- Semua `.md` dan `.tsx` ASCII.

---

## 2026-09-28 - Fase 1 dan 2: core, dataset, Hono, build, test

**Perubahan**
Kode pertama di repo ini. Yang ditambahkan:

- `src/core/types.ts`, `validate.ts`, `query.ts`, `index.ts` - logika murni, nol
  dependency runtime, nol I/O.
- `src/dataset.ts` - satu-satunya modul yang tahu file JSON di `data/` ada.
- `src/app.ts` - routing Hono, auth bearer, shaping response.
- `src/worker/index.ts` dan `src/server/index.ts` - adapter runtime, nol logika bisnis.
- `scripts/build-static.ts` - validasi semua file dulu, baru menyalin ke `dist/`.
- `data/holidays-2026.json` - 25 entri, ditulis tangan dari SKB 1497/2025, 2/2025,
  5/2025.
- `test/` - 46 test: purity core, parity dataset, regresi SKB 2026, validator, route.
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`,
  `wrangler.toml.example`.

**Perubahan pada file yang sudah ada**

- `README.md` - ditulis ulang: field `description` dihapus (tidak pernah ada di data),
  klaim "tanpa API key" diganti jadi apa adanya (`/api/*` butuh key kecuali
  `/health` dan `/api/years`), ditambah bagian tiga jalur distribusi dan aturan
  2024/2025 yang ditahan.
- `AGENTS.md` - memperbaiki teks yang rusak secara semantik (`dilEndian`, `yangzat`,
  `CompilerZtieh`, `Orangnyaedit`, `PerTahun`, `Pathways`, `Means`) tanpa mengubah
  maksudnya, dan menambahkan `wrangler.toml.example` ke daftar yang memang ada.

**Bug yang ditemukan test, bukan lewat review**

- `isIsoDate('2026-02-30')` mengembalikan `true`. `new Date()` tidak menolak tanggal
  overflow, dia meloverflow ke bulan berikutnya (2026-02-30 jadi 2026-03-02). Diperbaiki
  dengan round-trip: bandingkan tanggal hasil parse dengan string aslinya.
- `app.onError` menelan `HTTPException` dari middleware auth dan mengubahnya jadi 500
  dengan pesan kosong. Semua 401 jadi 500. Diperbaiki dengan mengembalikan
  `error.getResponse()` apa adanya.
- `/api/years` ikut terkunci API key padahal dirancang terbuka, karena middleware
  dipasang di `/api/*`.

**Perubahan pada `package.json`**

- `typescript` dan `@cloudflare/workers-types` di-pin exact. Sebelumnya pakai `^`,
  yang melanggar aturan exact pin dan bisa menarik versi rentan.
- `@cloudflare/workers-types` dihapus: belum dipakai, dan Workers tetap bisa jalan
  tanpa tipe itu.
- `@types/node` ditambah karena `tsconfig.json` mereferensikannya.
- Node minimum dinaikkan ke 22.18, versi di mana type stripping untuk `.ts` sudah
  tanpa flag sehingga `node src/server/index.ts` bisa dipakai langsung tanpa build step.
- Script `build` ditambahkan: typecheck + test + build:static.

**Kenapa `data/holidays-2026.json` satu-satunya file data**

2024 dan 2025 ditahan sampai amandemen SKB-nya dipastikan. Lihat D-012 dan bagian
"Data yang Tersedia" di `README.md`.

**Verifikasi**

- `npx tsc --noEmit` bersih.
- 46/46 test lulus.
- `cmp` menandai `dist/holidays-2026.json` identik dengan `data/holidays-2026.json`.
- Build diuji menolak tiga jenis kerusakan (tanggal overflow, `is_holiday` tidak
  cocok dengan `type`, `meta.count` salah) dan `dist/` tidak ditulis sama sekali.
- Server Node diuji jalan: 401 tanpa key, 500 kalau `API_KEY` belum diset, 404 untuk
  2024 dengan pesan yang menyebut tahun tersedia, header CORS benar.
- Semua `.md` ASCII.

---

## 2026-09-28 - Dokumentasi planning dibuat

**Perubahan**
Menambahkan direktori `.knowlages/` berisi tiga dokumen:

- `plan.md` - rencana arsitektur, stack, batasan, roadmap 5 fase
- `decision-log.md` - 8 keputusan desain (D-001 ... D-008)
- `change-log.md` - dokumen ini

**Alasan**
Seluruh keputusan arsitektur sejauh ini hanya ada di percakapan. Menuliskannya memberi
sumber acuan tunggal dan jejak audit untuk keputusan yang mungkin perlu ditinjau ulang
saat implementasi berjalan.

**File**
- `.knowlages/plan.md` (baru)
- `.knowlages/decision-log.md` (baru)
- `.knowlages/change-log.md` (baru)

**Catatan**
Belum ada perubahan kode. Repo masih dokumentasi saja.

---

## 2026-09-28 - README diperluas jadi referensi API

- **Commit:** `91dc857`

**Perubahan**
`README.md` ditulis ulang dari satu baris judul menjadi 166 baris referensi API:

- Deskripsi dan daftar fitur
- Tabel jenis libur (`holiday` / `leave` / `observance`)
- Tabel 15 hari libur nasional dengan kolom kalender dan status tetap/bergerak
- Struktur data dengan field `is_holiday` dan `is_joint_holiday`
- Contoh endpoint dan contoh respons JSON
- Catatan sumber data (SKB 3 Menteri) dan section status proyek

**Alasan**
README asli hanya berisi `# kalender-api` sehingga tidak menjelaskan apa pun. Project
belum ada kodenya, jadi README ditulis sebagai kontrak API yang akan diimplementasikan.

**File**
- `README.md`

**Koreksi sebelum commit**
Dua inkonsistensi diperbaiki: spasi hilang di "hari raya religious", dan uraian SKB 3
Menteri yang masih menyebut Kemenhum/BNPB padahal yang benar Kementerian Agama,
Ketenagakerjaan, dan PANRB.

---

## 2026-09-28 - Initial commit

- **Commit:** `45aa12f`

**Perubahan**
Repo dibuat di `github.com:rachmanzz/kalender-api` dengan dua file:

- `README.md` - hanya judul
- `LICENSE` - MIT (c) 2026 Maulana Muhammad Rifqi

**Alasan**
Titik awal proyek.

**File**
- `README.md`
- `LICENSE`
