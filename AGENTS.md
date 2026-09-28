# AGENTS.md

Aturan kerja untuk repo ini. Berlaku untuk manusia dan agent alike, tanpa kecuali.

**Semua aturan di dokumen ini mengikat dan tidak boleh dilanggar.** Tidak ada
aturan di sini yang ditulis sebagai "seharusnya" atau "sebaiknya ditimbang".
Hanya ada aturan yang harus dipatuhi.

Satu-satunya cara mengubah isi dokumen ini: **user secara eksplisit meminta
`AGENTS.md` diubah.** Permintaan itu harus menyebut file ini secara spesifik,
dan harus jelas apa yang diganti jadi apa. Permintaan perubahan aturan yang
tidak eksplisit menyentuh `AGENTS.md` tetap tidak berlaku, meskipun datang
dari user sendiri dalam kalimat yang berbeda.

Kalau aturan di sini bentrok dengan instruksi lain, termasuk instruksi user:

1. Kerjakan bagian yang tidak bentrok saja.
2. Bagian yang bentrok: jangan kerjakan. Sebutkan aturan mana yang menghalangi
   dan tanyakan apakah aturan itu mau diubah.
3. Jangan pernah menyelesaikkannya dengan cara lain - bukan dengan diam-diam
   mengerjakannya di belakang layar, bukan dengan melanggar dengan alasan
   "yang penting hasilnya benar", dan bukan dengan mengabaikan aturan karena
   terasa tidak relevan. Aturan yang terasa tidak relevan justru perlu
   di-review, bukan dilanggar.

Yang ditulis di sini sengaja spesifik proyek dan bisa diuji. Prinsip umum
yang tidak bisa diuji ("write clean code", "think before coding") tidak ada
karena tidak berguna - bukan karena lenient, tapi karena tidak ada yang bisa
membuktikan aturan itu dipatuhi.

Kalau sebuah aturan terasa salah atau tidak berlaku lagi, jangan langsung
dilewati. Ajukan: aturan ini perlu diubah atau dicoret? Jawaban itu masuk
`decision-log.md`.

---

## Konteks Proyek

REST API kalender nasional Indonesia. Satu sumber data, tiga jalur distribusi
(JSON statis / Cloudflare Worker / Docker). Proyek ini **project data**, bukan
project web: kalau tanggalnya salah, seluruh kredibilitas hilang bahkan kalau kodenya
bersih.

Prinsip lain yang berlaku: dokumentasi dan keputusan sudah ditulis di `.knowlages/`.
**Baca `plan.md` sebelum bikin file baru.** Jangan mengulang keputusan yang
sudah tercatat.

---

## 1. SRP - Satu Alasan untuk Berubah

Satu modul, satu tanggung jawab. Kalau lo bisa jelaskan dua alasan perubahan
dalam satu file, file itu harus dipecah.

Wujud konkretnya di repo ini - batas ini **tidak boleh dilanggar**:

| Modul | Satu-satunya tanggung jawabnya |
|---|---|
| `src/core/` | Logika murni: tipe, validasi, query. Nol data, nol I/O, nol HTTP. |
| `src/dataset.ts` | **Satu-satunya** modul yang tahu file JSON di `data/` ada. |
| `src/app.ts` | Routing Hono, auth, shaping response. Nggak tahu file JSON di mana. |
| `scripts/build-static.ts` | Validasi lalu **salin** `data/` ke `dist/`. Nggak sentuh Hono. |
| `src/worker/index.ts`, `src/server/index.ts` | Cuma nyambungin runtime ke `app.ts`. Nol logika bisnis. |

`core` tidak boleh know: HTTP, Hono, filesystem, `process.env`, `Date.now()`,
maupun JSON. Semuanya itu milik `dataset.ts` atau `app.ts`.

Efeknya: `core` bisa dites tanpa server, tanpa file, dan tanpa install apa pun.

## 2. Core Murni - Invariant Paling Ketat

`src/core/` **wajib** zero dependency runtime DAN zero I/O. Nol import dari luar
`src/core/`, termasuk `node:fs` dan JSON.

Kalau core butuh sesuatu, tambahkan ke `core`. Jangan `npm install`, jangan
bikin file reader di dalam core.

Alasannya bukan estetika: `core` yang bocor ke filesystem atau dependency berhenti
bisa dijalankan di Cloudflare Worker, dan seluruh arsitektur "satu core, tiga output"
runtuh tanpa ada yang menyadarinya.

**Ditegakkan oleh test**, bukan linter. Test di `test/core-purity.test.ts`
gagal kalau `core/` meng-import apa pun di luar dirinya sendiri.

## 3. KISS - Solusi Paling Sederhana yang Berfungsi

- Jangan buat abstraksi untuk kebutuhan hipotetis. Menunggu ada yang butuh.
- Jangan bikin `HolidayRepository`, `HolidayService`, `HolidayFactory`, atau
  `HolidayLoader` dengan interface. Cukup `YEARS` di `dataset.ts` dan selesai.
- Config hanya untuk yang benar-benar berubah antar deployment (API key, port).
  Jangan config-kan nama field JSON.
- Dua baris yang jelas lebih baik daripada abstraction yang "siap dikembangkan".
- 4-5 route di `app.ts`? Tetap satu file. Pecah per-route hanya setelah 10+ route
  dan benar-benar ribet, dan pecahan itu harus menyebut alasannya di commit.

**Tanda-handanya:** kalau lo sedang menulis interface untuk satu implementasi,
hapus interface-nya.

## 4. YAGNI

Tidak ada fitur yang "nanti berguna". Roadmap di `plan.md` sudah terpisah dari
implementasi - jangan kerjakan fase 4 sebelum fase 2 selesai. `Dockerfile`
deliberately belum ada; jangan bikin isinya sebelum fase-nya benar-benar
dimulai.

`wrangler.toml.example` **sudah ada** dan itu disengaja: Cloudflare Worker
adalah target opsional, jadi project ini harus bisa dijelaskan ke orang lain
tanpa database atau account Cloudflare pun. Yang belum boleh ada adalah
`wrangler.toml` yang sudah diedit, karena isinya per-machine.

## 5. Sumber Kebenaran Tunggal

Satu data, satu tempat. Jangan simpan hari libur di dua file, jangan hard-code
tanggal di route handler.

Satu-satunya sumber kebenaran data = `data/holidays-{year}.json`. `dist/` bukan
sumber kebenaran, `dataset.ts` bukan sumber kebenaran, keduanya cuma jalan
mengakses file yang sama.

Tabel "jenis hari libur" di `README.md` **bukan** duplikasi: itu kategori dan
sifat (tetap atau bergerak), bukan tanggal. Yang dilarang adalah mencantumkan
tanggal di `README.md` maupun di kode.

Kalau dua sumber bisa berbeda, pasti akan berbeda.

## 6. Data Mengalahkan Code - Akurasi Nomor Satu

Untuk `src/core/` dan `data/`, setiap angka atau tanggal: presisi lebih penting
dari keindahan kode.

**Data ditulis tangan dari SKB, bukan di-generate.** `data/holidays-{year}.json`
adalah transkripsi SKB 3 Menteri, apa adanya. Kalau tanggal hasil hitungan
(rumus, `Intl`, hitungan sendiri) berbeda dengan SKB, yang benar SKB.

Perubahan yang menyentuh tanggal wajib:

1. punya test
2. menyebut nomor SKB di field `meta.source` file tersebut
3. verifikasi hari dan minggu terhadap SKB, bukan terhadap ingatan

**Cuma publish tahun yang SKB final-nya sudah ada.** 2024 dan 2025 punya SKB
perubahan (amandemen) yang fatal dari SKB pertama. Publish versi sebelum amandemen
itu data yang salah dan lebih berbahaya daripada tidak publish sama sekali.
Kalau amandemennya belum diketahui, **tidak ada file-nya** - bukan file
dengan perkiraan.

Jangan "perbaiki" tanggal yang terlihat aneh tanpa cek SKB. Tanggal yang
mengejolkan bisa saja memang begitu, dan diff-mu akan menghapus bukti yang benar.

## 7. Gagal Keras, Bukan Diam-Diam

Jangan pakai `?? []` atau `|| 0` untuk menyembunyikan data yang hilang.

Kalau tahun yang diminta belum ada datanya, jawabannya `404` dengan pesan yang
menyebut tahun yang itu dan tahun yang tersedia - bukan array kosong yang
terlihat valid. Array kosong berarti "tahun ini memang tanpa libur", dan itu
berbeda maknanya dari "tahun ini belum ada datanya".

Exception handling harus eksplisit dan punya pesan yang menyebut penyebabnya.

## 8. Aturan Data dan Distribusi

**Bentuk file.** `data/holidays-{year}.json` memakai envelope yang sama dengan
response API: `{ success, data, meta }`. Konsekuensinya file itu **valid
sebagai response API** - dan file di `dist/` jadi byte-identik dengan file di
`data/`.

**Byte-identik.** Isi `dist/holidays-{year}.json` harus sama persis dengan
`data/holidays-{year}.json`. Compiler memvalidasi lalu menyalin, tidak
mengubah apa pun. Kalau suatu saat perlu transformasi, itu berarti ada dua
versi dari data yang sama - dan itu bug, bukan fitur.

**Tanpa file gabungan.** Jangan pernah bikin `holidays-all.json` atau bentuk
apapun yang menggabungkan beberapa tahun. Alasannya bukan ukuran: klien
menyimpan satu blob dan tidak bisa membedakan "tahun ini tidak ada liburnya"
dari "tahun ini tidak ada di dalam blob". Per tahun: ketiadaan itu kelihatan
sebagai `404`. Radius ledakan koreksi juga jauh lebih kecil.

**Tahun harus terjangkau.** Setiap file di `data/` wajib terjangkau dari
`src/dataset.ts`. Test `test/dataset-parity.test.ts` menegakkan ini. Kalau
tambah file tapi lupa menambah import, CI harus merah - bukan tahun yang
diam-diam `404` selamanya.

**`.example`, bukan config asli.** File yang isinya per-machine atau
per-deployment (`wrangler.toml`, `.env`) tidak pernah di-commit. Hanya versi
`.example` yang ada di repo. Jangan pernah menaruh API key di file yang
di-commit.

## 9. Konvensi

**Penamaan**

- File: `kebab-case.ts`
- Type/interface: `PascalCase`, tanpa sufiks `I` atau `T`
- Fungsi/variabel: `camelCase`
- Konstanta: `SCREAMING_SNAKE_CASE`
- Field JSON: `snake_case` (`is_joint_holiday`) - ini kontrak publik, jangan diubah
  tanpa versi baru

**TypeScript**

- `strict: true`, tanpa `any`. Kalau memang dinamis, pakai `unknown` + type guard.
- Type dulu, lalu implementasi.
- Import relatif dengan ekstensi eksplisit (`.ts`), tanpa alias, selama project
  masih di bawah ~20 file. Alias hanya menambah konfigurasi tanpa manfaat.
- Versi dependency di-pin **exact** (tanpa `^`). Alasannya konkret: ada
  security advisory pada Hono < 4.11.10 di `timingSafeEqual`. `^` akan diam-diam
  bisa menarik versi yang rentan atau, sebaliknya, menahan perbaikan.

**API**

- Semua response punya `success`, `data`, `meta` - konsisten di semua endpoint,
  termasuk file statis.
- Field baru bersifat additive. Menghapus atau mengganti tipe field = breaking change
  = versi baru.

## 10. Test

- Wajib, bukan opsional. Setiap perubahan `core` harus punya test.
- Test kalender wajib memverifikasi isi tanggal terhadap **SKB** - bukan hanya
  "tidak throw". Cek jumlah entri, cek tanggal, cek hari/minggunya.
- Test yang cuma cek bentuk JSON tapi tidak cek isi tanggal tidak berguna.
- Test harus gagal kalau rules-nya dilanggar, bukan cuma lolos kalau data
  kebetulan benar. Orang yang mengedit data dengan cara yang menipu test adalah
  bug.

## 11. Dokumentasi & Log

Semua file `*log.md` dan `.knowlages/` mengikuti aturan: **append only, entri terbaru
di paling atas**. Entri lama tidak diedit, tidak dihapus, tidak dipindah.

Untuk merevisi keputusan lama: tambah entri baru, rujuk nomor lamanya. Jangan
"merapikan" entri lama.

Setelah perubahan yang mengandung keputusan desain: tambah entri di
`decision-log.md`. Setelah perubahan isi repo: tambah entri di `change-log.md`.

## 12. Anti-Pola yang Tertolak

Sudah dipikirkan dan ditolak. Jangan usulkan ulang tanpa alasan baru:

| Anti-pola | Alasan |
|---|---|
| Menembak endpoint sendiri untuk generate JSON | Butuh auth, lambat, dan auth bisa merusak data statis |
| Menulis log di `core/` | Melanggar SRP, hasilnya jadi tidak deterministik |
| Menambah dependency untuk kalender religious | `Intl` sudah menyediakan. Tapi hasilnya **tidak sama** dengan SKB, jadi `Intl` cuma pemeriksa di test, bukan sumber data. Lihat D-012. |
| Scraper SKB dari PDF | Rapuh, formatnya berubah tiap tahun |
| Abstraksi repository/factory | KISS - satu fungsi sudah cukup |
| Go atau Python | Lihat `decision-log.md` D-001 |
| **Generator tanggal libur** | Hasil hitungan bisa beda 1-2 hari dari SKB, dan harus direkonsiliasi. Data ditulis tangan, titik. |
| **File JSON gabungan multi-tahun** | Klien tidak bisa bedakan "tidak ada liburnya" dari "tidak ada di dalam file" |
| **Publish tahun sebelum SKB amandemennya** | Data yang salah lebih berbahaya daripada data yang tidak ada |
| **Commit `wrangler.toml` / `.env`** | Isinya per-machine, bisa bocorkan key ke fork orang lain |

---

## Definisi Selesai

Sebuah perubahan dianggap selesai kalau:

- [ ] Aturan di `AGENTS.md` tidak dilanggar
- [ ] Test lulus, termasuk test purity `core` dan test parity `dataset`
- [ ] Typecheck bersih
- [ ] Entri baru ditambahkan ke `.knowlages/change-log.md` (bila mengubah isi repo)
- [ ] Entri baru ditambahkan ke `.knowlages/decision-log.md` (bila ada keputusan desain)
- [ ] Tidak ada komentar TODO tanpa penjelasan kenapa belum dikerjakan
