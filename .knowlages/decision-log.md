# Decision Log

> **Aturan: append only, entri terbaru di paling atas.**
> Entri yang sudah ada tidak boleh diedit, dipindah, atau dihapus. Untuk mengubah
> keputusan lama, tambahkan entri baru dengan status `Supersedes: D-00X`.

Format entri: ID, Judul, Status, Tanggal, Konteks, Keputusan, Konsekuensi, Alternatif.

---

## D-018 - Kalender di GitHub Pages membaca JSON saat dibuka, tidak meng-import

- **Status:** Accepted
- **Supersedes:** D-015, hanya bagian "Markdown di dalam HTML dengan script kecil untuk render"
- **Tanggal:** 2026-09-29

**Konteks**
D-015 menolak `<script>` di halaman statis dengan alasan halaman itu harus pure
static. Setelah ada kalender (D-017), alasannya tidak berlaku lagi: kalender
memang butuh runtime, dan runtime-nya sudah ada di browser pembaca.

Yang ditegakkan di sini bukan "tanpa script", tapi **tidak meng-import data**.
`data/` di-bundle ke HTML berarti setiap publish harus membangun ulang
`kalender.html`. Kalau lupa, halamannya menampilkan kalender basi - dan
kalender basi lebih berbahaya daripada 404, karena orang menjadwalkannya.
`data/` memang sudah dipublikasikan terbuka di GitHub Pages, jadi tidak ada
alasan menyimpan salinannya lagi di dalam HTML.

**Keputusan**
`dist/kalender.html` dibuat generator terpisah, `scripts/build-static-calendar.ts`.
HTML-nya cuma shell; skripnya membacanya dari `./index.json` lalu
`./holidays-{year}.json` saat halaman dibuka, dan divalidasi ulang dengan
`validateYear()` dari `core/`.

Generator menolak build kalau ada satu saja tanggal `YYYY-MM-DD` yang ikut
ter-bundle. Guard-nya di generator, bukan hanya di test, karena yang salah
publish ke Pages adalah hasil generator.

Tidak ada framework di sisi klien. Skripnya TypeScript biasa, di-bundle
esbuild (devDependency yang sudah ada) jadi satu string inline. Nol dependency
baru untuk pembaca.

**Konsekuensi**
`dist/` punya tiga jenis file: JSON (byte-identik dengan `data/`), `index.json`
(manifest), dan dua dokumen HTML. `index.html` tetap statis penuh;
`kalender.html` tidak, dan itu tertulis di `<noscript>`-nya.

Halaman butuh HTTP. dibuka lewat `file://`, `fetch` ditolak browser dan
halamannya menampilkan pesan yang menyebut penyebabnya - bukan grid kosong.

Markup ditulis dua kali: sekali JSX untuk server, sekali string untuk klien,
karena satu file tidak bisa jalan di kedua runtime. Yang tidak diulang adalah
yang rawan salah: aritmatika bulan, nama bulan dan hari, filter per bulan, dan
validasi - semuanya dari `core/`. Stylesheet-nya satu konstanta,
`src/pages/calendar-style.ts`, dipakai kedua halaman.

Test parity membandingkan urutan `data-date` versi klien dengan versi server,
dan cek bahwa tiap class yang dipakai markup punya aturan di stylesheet.

**Alternatif**
Bundle `data/` ke HTML (ditolak: staleness diam-diam, danger yang paling mahal
di proyek ini). Pakai framework di sisi klien (ditolak: dependency runtime di
halaman yang justru harus bisa dibuka tanpa install apa pun). Server-side render
untuk Pages (ditolak: Pages tidak menjalankan Node).

---

## D-017 - Halaman kalender dirender dari dataset, bukan memanggil API

- **Status:** Accepted
- **Tanggal:** 2026-09-29

**Konteks**
Diminta halaman kalender di `/kalender` yang bisa ganti tahun, menampilkan satu
tahun penuh terpisah per bulan, menandai hari libur, dan bisa menunjukkan satu
bulan saja. Keinginan awalnya halaman bisa dipakai tanpa API key, idealnya
"hanya dari hostname yang sama".

Diputuskan lebih dulu bahwa pembatasan "same hostname only" tidak bisa
ditegakkan: `Origin` sering tidak dikirim browser pada GET same-origin, header
`Referer`/`Origin` bisa dipalsukan curl/Postman, dan CORS saat ini `origin: '*'`.
Selain itu data yang sama sudah dipublikasikan terbuka di GitHub Pages.

**Keputusan**
Halaman dirender di server dari `dataset.ts`, tidak memanggil `/api/*` sama
sekali. Route `GET /kalender` di `src/app.tsx`, komponen `src/pages/calendar.tsx`.
Data masuk lewat props, sama seperti `docs.tsx` dan `static.tsx`.

- `?year=` ganti tahun. Default: tahun berjalan kalau datanya ada, kalau tidak
  tahun terbaru yang tersedia.
- `?month=` tampilkan satu bulan saja.
- Navigasi lewat link biasa, jadi halaman tetap berfungsi tanpa JavaScript.
- Tanda: libur nasional, cuti bersama, dan akhir pekan.
- Error mengikuti aturan yang sudah ada: `400` untuk parameter tidak valid,
  `404` lewat `missingYear` untuk tahun yang belum punya data.

**Konsekuensi**
`/kalender` berada di luar `/api/*`, jadi tidak melewati `bearerAuth` dan tetap
terbuka tanpa key. Fungsi layout murni `daysInMonth` dan `monthStartWeekday`
diekspor supaya bisa dites langsung. Nol dependency baru.

**Alternatif**
Memanggil `/api/holidays` dari browser (ditolak: butuh key, dan key di halaman
publik bisa dilihat siapa saja). Membatasi akses hanya hostname sendiri
(ditolak: tidak bisa ditegakkan, lihat Konteks). Membuat halaman terpisah di
Pages (ditolak: Pages tidak punya data dinamis per tahun tanpa regenerate).

---

## D-016 - Static page menampilkan jumlah entri per tahun

- **Status:** Accepted
- **Supersedes:** D-015, hanya bagian "jumlah entri seragam"
- **Tanggal:** 2026-09-29

**Konteks**
D-015 menetapkan generator gagal keras kalau jumlah entri antar tahun berbeda,
supaya halaman tidak menampilkan satu angka untuk semua tahun. Saat 2027
dipublikasikan, kenyataannya berbeda: 2026 punya 25 entri, 2027 punya 26. Guard
itu sekarang menghalangi publish, padahal datanya benar dan sudah sesuai SKB.

**Keputusan**
`render()` menerima daftar `{ year, count }` dan menampilkan jumlah tiap tahun di
tabel. Guard "harus sama" dihapus. Angka di contoh JSON memakai tahun terbaru.

**Konsekuensi**
Halaman menampilkan angka yang benar untuk tiap tahun, bukan menyeragamkan ke
salah satunya. Signature `render()` berubah dari `(years, total, baseUrl)` jadi
`(years, baseUrl)`. Tidak ada dependency baru.

**Alternatif**
Tetap gagal keras (ditolak: memblokir data yang sudah sah). Menyeragamkan ke
satu angka (ditolak: menampilkan angka yang salah untuk salah satu tahun).

---

## D-015 - Static page punya komponen sendiri, bukan render ulang docs server

- **Status:** Accepted
- **Tanggal:** 2026-09-28

**Konteks**
Setelah dokumentasi server ada di `/`, pertanyaannya apakah GitHub Pages bisa
memakai halaman yang sama. Secara teknis bisa: `render()` yang sama dipanggil
dari mana saja. Tapi halaman itu menjelaskan endpoint, header `Authorization`,
dan kode error HTTP. Tidak satu pun ada di Pages.

GitHub Pages tidak menjalankan Node. Tidak ada server, tidak ada auth, tidak
ada request. Yang terjadi hanya "buka file". Kalau halaman server dipakai
apa adanya, pembaca akan mencari `Authorization: Bearer` di halaman yang
justru tidak butuh key sama sekali.

**Keputusan**
Komponen terpisah, `src/pages/static.tsx`. Generator terpisah juga,
`scripts/build-static-page.ts`.

Generator tidak boleh digabung ke `build-static.ts` karena `AGENTS.md` bagian 1
menetapkan `build-static.ts` sebagai "validasi lalu salin `data/`" yang tidak
menyentuh Hono. `index.html` justru Hono JSX. Menggabungkannya berarti satu file
dengan dua tanggung jawab, dan `dist/` jadi punya dua penulis.

Yang sama persis antara dua halaman cuma stylesheet, dan menyalin 30 baris CSS
lebih murah daripada membuat file CSS yang cuma dipakai dua halaman.

Seluruh link di static page RELATIF. Halaman ini tidak tahu domain-nya, jadi
`https://` absolut akan rusak begitu repo-nya di-fork. Test menjaga ini.

Tahun yang ditampilkan dibaca dari `dist/index.json`, bukan dari konstanta.
Kalau nanti 2027 dipublikasikan, halaman ikut berubah tanpa disentuh. Kalau
jumlah entri antar tahun berbeda, generator gagal keras, bukan menampilkan
satu angka untuk semua tahun.

**Konsekuensi**
`dist/` sekarang punya tiga jenis file: JSON (byte-identik dengan `data/`),
`index.json` (manifest), dan `index.html` (dokumen). Aturan berbeda, tapi
satu direktori. Itu trade-off yang diterima: GitHub Pages butuh root tunggal,
dan hosting static seperti Pages memakai satu direktori sebagai root.

Nol dependency baru. `hono/html` dan `hono/jsx` sudah dipakai. `esbuild` sudah
devDependency untuk `build-server.ts`. Node butuh
`--experimental-strip-types` untuk menjalankan generator karena JSX harus
di-bundle lebih dulu oleh esbuild.

**Alternatif**
Render ulang `docs.tsx` yang sama (ditolak: isinya salah sasaran, lihat
alasan di atas).
Menyimpan `index.html` di `data/` supaya ikut tercopy (ditolak: `data/` hanya
untuk data, dan aturan byte-identik jadi tidak berlaku untuk semua file).
Markdown di dalam HTML dengan `<script>` kecil untuk render (ditolak:
dependensi runtime di halaman yang justru harus pure static).

---

## D-014 - Halaman dokumentasi pakai hono/jsx, bukan React

- **Status:** Accepted
- **Tanggal:** 2026-09-28

**Konteks**
Diminta halaman dokumentasi Bahasa Indonesia di `/` untuk menjelaskan cara pakai
API. Usulan awalnya React, dan alasan yang shady biasanya "Hono bisa serve React
langsung". Itu tidak sepenuhnya benar: Hono bisa menjalankan React lewat
`@hono/vite-dev-server`, tapi itu dev server. Untuk produksi, React butuh
bundler.

Pilihan yang tersedia:

1. `hono/html` - tagged template. Nol dependency baru, nol build step.
2. `hono/jsx` - JSX bawaan Hono. Nol dependency baru, tapi butuh transform JSX.
3. React 19 asli - `react` + `react-dom` + `@types`, plus bundler.

**Keputusan**
`hono/jsx`. Nol dependency runtime baru, dan penulisan komponennya tetap JSX
supaya mudah dibaca dan diperluas. `esbuild` ditambahkan sebagai devDependency
khusus untuk transform.

Konsekuensi yang harus dicatat: **build step sekarang wajib untuk menjalankan
server.** Sebelumnya `node src/server/index.ts` jalan karena Node melakukan type
stripping sendiri, tapi Node tidak bisa transform JSX sama sekali
(`ERR_UNKNOWN_FILE_EXTENSION`). `src/app.ts` harus jadi `src/app.tsx` karena
esbuild membaca `.ts` sebagai TypeScript biasa, bukan TSX. Script `dev` dan
`start` sekarang pakai `build/server.js`.

Output bundler server ditulis ke `build/`, bukan ke `dist/`. Alasannya `dist/` itu untuk
GitHub Pages dan harus berisi byte-identik dengan `data/`; mencampur file server
ke sana membuat dua jenis asset dengan aturan berbeda dalam satu direktori.

**Konsekuensi**
Repo tidak lagi bisa dijalankan tanpa `npm run build:server` lebih dulu. Ini
trade-off yang disadari, bukan hal gratis. Halaman dokumentasi ada di
`src/pages/docs.tsx`: stateless, tidak tahu routing/auth/filesystem, menerima
semua data lewat props, jadi bisa dites tanpa server.

**Alternatif**
`hono/html` tanpa JSX (ditolak: teksnya panjang jadi sulit dirawat, dan ini
halaman yang paling sering berubah). React 19 asli (ditolak: dua dependency
runtime plus @types, untuk halaman yang sepenuhnya server-rendered tanpa
interaksi client-side). `hono/html` + `hono/jsx` campur (ditolak: satu cara saja
untuk menulis halaman, dua cara berarti ada dokumentasi yang setengahnya JSX
dan setengahnya template literal).

---

## D-012 - Data ditulis tangan, generator tanggal dibatalkan

- **Status:** Accepted
- **Tanggal:** 2026-09-28
- **Supersedes:** D-007

**Konteks**
Rencana awal memakai generator tanggal dari `Intl` (icu) plus `overrides.json` untuk
menyamakan hasil hitungan dengan SKB. Setelah SKB 2026 dilihat sungguhan, hasilnya
kelihatan: `Intl` menghitung 1 Syawal 1447 sebagai 2026-03-20, sedangkan SKB menetapkan
21-22 Maret untuk Idul Fitri. Selisihnya bukan bug. Itu keputusan Nealega yang satu
hari beda dari aritmetika Hijriah. Generator tidak mungkin bisa dicocokkan tanpa
override, dan override adalah dua sumber kebenaran untuk satu tanggal.

**Keputusan**
`data/holidays-{year}.json` ditulis tangan, apa adanya dari SKB. Tidak ada generator,
tidak ada `overrides.json`. Hitungan kalender hanya dipakai sebagai pemeriksa di test,
bukan sebagai sumber data.

**Konsekuensi**
Menambah tahun berarti mengetik ulang dari SKB. Lambat, tapi bisa diaudit. Sebagai
gantinya, kelas bug "tanggal meleset satu-dua hari karena rumus" tidak ada lagi.

**Alternatif**
Generator dengan `overrides.json` (ditolak: dua sumber kebenaran untuk satu tanggal).
Pustaka kalender pihak ketiga (ditolak: dependensi untuk satu masalah yang bisa
diselesaikan dengan disiplin).

## D-011 - Satu file JSON per tahun, tidak ada file gabungan

- **Status:** Accepted
- **Tanggal:** 2026-09-28
- **Supersedes:** D-005

**Konteks**
Versi pertama menggabungkan semua tahun dalam satu `holidays-all.json`.

**Keputusan**
Tidak pernah ada file yang menggabungkan beberapa tahun. Distribusi statis memakai
`holidays-{year}.json` satu per satu, ditambah `index.json` sebagai manifest daftar file.
`index.json` tidak berisi data libur, hanya nama file dan jumlahnya, jadi tidak
bertentangan dengan aturan ini.

**Konsekuensi**
Klien melakukan beberapa request untuk mendapat seluruh riwayat. Itu biayanya, dan
exchange-nya adalah ketiadaan sebuah tahun terlihat eksplisit sebagai `404`, bukan
array kosong yang sah. Radius ledakan koreksi juga jauh lebih kecil.

**Alternatif**
File gabungan dengan penanda per tahun (ditolak: parser di sisi klien jadi lebih
kompleks daripada sekadar beberapa request).

## D-010 - Hono, dan Hono tidak dipakai untuk menghasilkan JSON statis

- **Status:** Accepted
- **Tanggal:** 2026-09-28
- **Supersedes:** D-004

**Konteks**
Hono dipilih karena satu basis kode bisa jalan di Cloudflare Worker, Node, dan test,
sambil tetap menyediakan routing, middleware, dan CORS. Tapi Hono tidak bisa mengekspor
route sebagai file statis, dan aturan proyek melarang memanggil endpoint sendiri untuk
membuat JSON (butuh auth, lambat, dan auth bisa merusak data statis).

**Keputusan**
Hono untuk lapisan HTTP. `scripts/build-static.ts` memanggil validator yang sama secara
langsung, tanpa lewat HTTP, lalu menyalin file yang lolos ke `dist/`. Ketiganya berbagi
satu validator, jadi JSON statis dan response API tidak mungkin berbeda isi.

**Konsekuensi**
Ada satu jalur validasi yang dipakai test, build, dan runtime. Yang harus dijaga:
`build-static.ts` menyalin byte-identik, bukan menulis ulang lewat `JSON.stringify`.

**Alternatif**
Framework yang bisa mengekspor static, misalnya adapter Astro (ditolak: menambah
lapisan dan toolchain untuk satu kasus yang sebenarnya cuma "validasi lalu salin").

## D-009 - Lokasi data di root `data/`, bukan di dalam `src/`

- **Status:** Accepted
- **Tanggal:** 2026-09-28
- **Supersedes:** D-006

**Konteks**
Dua penempatan sempat dibahas: `src/data/` dan root `data/`.

**Keputusan**
File JSON berada di root `data/`. Build menyalinnya ke `dist/`. `src/` hanya berisi
kode.

**Konsekuensi**
Tidak ada file non-kode di `src/`, dan isi `data/` bisa dibaca sebagai sumber dari
isi `dist/`. Keduanya dipisah secara fisik, jadi tidak mungkin salah menghitung file
yang disalin.

**Alternatif**
`src/data/` (ditolak: mencampur data dan kode di satu direktori membuat batas antara
`src/core/` dan data tidak jelas).

---

## D-008 - Status proyek masih desain

- **Status:** Accepted
- **Tanggal:** 2026-09-28

**Konteks**
Repo hanya berisi `README.md` (judul saja) dan `LICENSE`. Belum ada satu baris kode.

**Keputusan**
Semua keputusan arsitektur dicatat di sini dan diimplementasikan bertahap, dimulai dari
Fase 1 (core + kalender + test). README ditulis sebagai kontrak API, bukan deskripsi kode
yang sudah ada.

**Konsekuensi**
Endpoint di README adalah **rancangan**, bukan implementasi yang bisa dijalankan. Kalau
ada yang salah, README yang harus diperbaiki duluan.

**Alternatif**
Menunggu sampai semua ada baru menulis README - ditolak, karena keputusan sulit
dipertanggungjawabkan kalau tidak dicatat saat itu juga.

---

## D-007 - Build script tidak memanggil API, tapi memanggil core

- **Status:** Accepted
- **Tanggal:** 2026-09-28

**Konteks**
Untuk menghasilkan JSON statis, ada dua cara: memanggil endpoint Hono yang sudah jalan
(`app.request()`), atau memanggil fungsi `core` secara langsung.

**Keputusan**
`scripts/build-static.ts` memanggil `generateYear()` dari `core` secara langsung. Hono
tidak pernah di-import oleh build script.

**Konsekuensi**
- Build script tidak butuh API key, tidak butuh env Worker.
- Tidak mungkin build gagal karena bug di middleware auth.
- `dist/*.json` dijamin berasal dari kode yang sama dengan yang dipakai runtime.

**Alternatif**
`app.request('/api/holidays?year=...')` lalu tulis `res.text()` - ditolak, karena butuh
auth di jalur data, lambat, dan satu middleware yang salah bisa merusak data statis.

---

## D-006 - GitHub Pages jadi lapisan distribusi, bukan lapisan logika

- **Status:** Accepted
- **Tanggal:** 2026-09-28

**Konteks**
Ada dua jalur publik: static JSON di GitHub Pages (gratis, CDN) dan API di Cloudflare
Worker (API key, rate limit). Perlu diputuskan mana yang doing apa.

**Keputusan**
GitHub Pages hanya menyajikan file JSON hasil build. Query dinamis, header kustom, dan
API key tetap di Worker. Tidak ada logika bisnis di Pages.

**Konsekuensi**
- Limiter GitHub Pages (nggak bisa custom header, dipaksa `Cache-Control: max-age=600`)
  berulang immaterial untuk data yang jarang berubah.
- Dua URL dengan perilaku berbeda harus didokumentasikan terpisah.

**Alternatif**
Membuang Pages sepenuhnya, Worker saja - ditolak karena kehilangan lapisan gratis yang
cukup untuk mayoritas use case.

---

## D-005 - Data: generator + manual override

- **Status:** Accepted
- **Tanggal:** 2026-09-28

**Konteks**
Tanggal libur nasional tidak bisa 100% dihitung. Pemerintah mengubah jadwal menjelang
hari-H - contoh nyata SKB 712/2021 menggeser Tahun Baru Islam dan Maulid Nabi agar tidak
jadi long weekend.

**Keputusan**
Pipeline hybrid: `rules.ts` menghitung tanggal, lalu `overrides.json` menimpa hasilnya.
Override **selalu menang**, karena SKB adalah sumber kebenaran, bukan hasil hitungan.

**Konsekuensi**
- Untuk tahun yang sudah ada SKB-nya, accuracy tinggi.
- Untuk tahun berikutnya, hasil generator adalah **estimasi** dan harus ditandai begitu.
- wajib ada test yang membandingkan output generator dengan SKB tahun yang sudah lewat,
  supaya regresi kelihatan.

**Alternatif**
Scraping sumber resmi - ditolak untuk sekarang (sangat rapuh, dan rawuh parse PDF SKB).

---

## D-004 - Tanggal religious dari `Intl`, bukan dependency

- **Status:** Accepted
- **Tanggal:** 2026-09-28

**Konteks**
15 hari libur nasional memakai 5 kalender berbeda: Masehi, Hijriah, Kongzili, Saka Bali,
Buddha.

**Keputusan**
Pakai `Intl.DateTimeFormat` dengan `islamic-umalqura` dan `chinese` - keduanya sudah
terverifikasi tersedia di Node v24.21.0. Konversi dilakukan dengan scan window +/-400 hari.
Saka Bali dan Waisak butuh implementasi sendiri.

**Konsekuensi**
- Nol dependency untuk kalender religious.
- Hasil identik di Node dan Cloudflare Worker (keduanya V8).
- Saka Bali tetap butuh tabel kecil - tidak ada di `Intl`.

**Catatan**
Umalqura itu *lookup table*, bukan formula. Jadi tabelnya tetap ada, tapi dependency-nya
hilang dan hasilnya konsisten lintas runtime.

---

## D-003 - Hono sebagai HTTP framework

- **Status:** Accepted
- **Tanggal:** 2026-09-28

**Konteks**
Butuh satu framework yang jalan di Cloudflare Worker dan Node tanpa menulis ulang.

**Keputusan**
Hono 4.13.9 + `@hono/node-server` 2.1.1. Seluruh aplikasi ada di `src/app.ts`, dua
entrypoint masing-masing 5 baris.

**Konsekuensi**
- Upgrade framework cuma kena di `app.ts` dan `core`, bukan di entrypoint.
- Middleware API key cukup ditulis sekali untuk kedua target.

**Alternatif**
Ekosistem masing-masing (Express untuk Node, native Worker untuk CF) - ditolak karena
menardy duplikasi.

---

## D-002 - Satu repo monorepo

- **Status:** Accepted (diasumsikan, belum dikonfirmasi maintainer)
- **Tanggal:** 2026-09-28

**Konteks**
Tiga target deploy, satu sumber data.

**Keputusan**
`core`, `app`, `worker`, `server`, dan `data` dalam satu repo.

**Konsekuensi**
- Satu versioning, data dan kode selalu sinkron.
- Satu CI pipeline.
- Kalau nanti dipecah, `core` harus dipublish ke npm lebih dulu.

**Alternatif**
Pisah `lib` + `apps` - ditolak karena menambah langkah publish tanpa manfaat di tahap ini.

---

## D-001 - TypeScript, bukan Go atau Python

- **Status:** Accepted
- **Tanggal:** 2026-09-28

**Konteks**
Tiga opsi: Go, TypeScript, Python. Kebutuhan: Cloudflare Worker, Node/Docker, dan build
statis - semuanya harus menjalankan logika yang sama.

**Keputusan**
TypeScript.

**Alasan**
1. **Workers.** TypeScript first-class dengan tooling terbaik. Go **tidak**
   first-class di Cloudflare - hanya lewat shim komunitas `workers-go` (3 star,
   unofficial, kompilasi lewat WASM). Python baru GA 21 Sep 2026, jadi masih muda.
2. **Kalender religious.** `Intl` sudah menyediakan `islamic-umalqura` dan `chinese`
   di stdlib. Go tidak punya kalender Islamic di stdlib maupun `x/text`; Python juga
   tidak punya, harus package pihak ketiga.
3. **Satu toolchain.** Satu `package.json` menutupi Worker, Node, Docker, dan script
   build. Python butuh toolchain kedua (`py` + `uv`).
4. **Gambar container.** Go menang telak di sini (~8MB vs ~50MB), tapi itu hanya satu dari
   tiga target, dan image alpine sudah cukup kecil untuk kasus ini.

**Konsekuensi**
- Go masih jadi pilihan terbaik **kalau** Cloudflare Worker dibatalkan dan hanya butuh
  static + Docker. Itu opsi tengah yang sah: TS untuk Worker + static, Go untuk server,
  dengan file JSON sebagai kontrak. Tapi belum diambil sekarang.
- Python Workers sekarang viable, jadi argumen "Python tidak cocok untuk Workers" sudah
  tidak berlaku. Yang membedakan sekarang adalah `Intl` dan toolchain.

**Alternatif**
- Go - ditolak karena dukungan Workers yang lemah.
- Python - ditolak karena butuh kalender dari pihak ketiga + toolchain kedua.
