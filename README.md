# Kalender API

REST API untuk data **kalender nasional Indonesia**: hari libur nasional dan cuti
bersama yang ditetapkan SKB 3 Menteri.

Berguna untuk aplikasi payroll, sistem shift, kalender akademik, dan fitur booking
hitung mundur - tanpa harus hard-code tabel libur setiap tahun.

## Satu Data, Tiga Jalur

Proyek ini satu sumber data dengan tiga cara distribusi. Isinya sama persis, yang
berbeda cuma cara menjangkaunya:

| Jalur | Untuk siapa | Cara pakai |
| --------------------- | ---------------------------------- | ------------------------------------------------- |
| **JSON statis** | Github Pages, tanpa server | `GET /holidays-2026.json` |
| **Cloudflare Worker** | API dengan API key | `GET /api/holidays?year=2026` |
| **Docker / Node** | Server sendiri | `GET /api/holidays?year=2026` |

JSON statis tidak butuh account, tidak butuh API key, dan tidak bisa rate-limit.
Kalau cuma butuh daftar libur, ambil yang statis.

## Data yang Tersedia

| Tahun | Jumlah | Sumber |
| ---- | ------ | ------ |
| 2026 | 25 hari (17 libur nasional + 8 cuti bersama) | SKB 1497/2025, 2/2025, 5/2025 |

**2024 dan 2025 sengaja tidak tersedia.** SKB untuk kedua tahun itu punya SKB
perubahan (amandemen) yang mengubah tanggal. Data yang salah lebih berbahaya
daripada data yang tidak ada, jadi kedua tahun itu ditahan sampai amandemennya
sudah dipastikan. Endpoint mengembalikan `404` untuk tahun yang tidak ada -
bukan array kosong, karena array kosong berarti "tahun ini memang tanpa libur"
dan itu makna yang berbeda.

Per tahun: tidak ada `holidays-all.json`. Alasannya bukan ukuran file, tapi
klien yang menyimpan satu blob tidak bisa membedakan "tahun ini tidak ada
liburnya" dari "tahun ini tidak ada di dalam blob". Dengan satu file per tahun,
ketiadaan itu kelihatan sebagai `404`, dan koreksi cuma menyentuh satu file.

## Kontrak Data

Setiap entri:

```json
{
  "date": "2026-08-17",
  "name": "Proklamasi Kemerdekaan Republik Indonesia",
  "type": "holiday",
  "is_holiday": true,
  "is_joint_holiday": false
}
```

Field `date` selalu `YYYY-MM-DD` (ISO 8601, kalender Masehi) supaya langsung bisa
diolah bahasa pemrograman maupun basis data.

Nilai `type`:

| Nilai | Arti |
| ------------ | ------------------------------------------------------------- |
| `holiday` | Hari libur nasional. |
| `leave` | Cuti bersama dari SKB 3 Menteri. |
| `observance` | Hari peringatan nasional, bukan hari libur. |

Catatan jujur: sampai 2026, seluruh entri di repo ini `holiday` atau `leave`.
Nilai `observance` sudah ada di tipe dan validator, tapi belum ada data yang
memakainya, dan tidak akan diisi sampai ada sumber resmi yang menjadwalkannya.

Dua field boolean menjawab pertanyaan yang paling sering dipakai klien:

| Field | `true` ketika... |
| ------------------ | -------------------------------------------------- |
| `is_holiday` | Tanggal adalah hari libur nasional (`type: holiday`). |
| `is_joint_holiday` | Tanggal adalah cuti bersama (`type: leave`). |

Keduanya **tidak pernah** `true` bersamaan. Jadi satu baris ini selalu cukup:

```js
const isDayOff = holiday.is_holiday || holiday.is_joint_holiday;
```

Validator menolak file yang melanggar aturan ini, jadi sebuah file di
`data/` yang lolos build memang konsisten.

## Endpoint

`/api/*` butuh API key kecuali `/api/years` dan `/health`.

| Endpoint | Tanpa key | Keterangan |
| -------------------------------- | --------- | ------------------------------------------ |
| `GET /health` | Ya | Untuk uptime monitor. |
| `GET /api/years` | Ya | Manifest tahun yang tersedia. |
| `GET /api/holidays?year=&month=` | Tidak | Daftar libur. Tanpa filter sama dengan file statis. |
| `GET /api/check?date=` | Tidak | Cek satu tanggal. |
| `GET /api/upcoming?limit=&from=` | Tidak | Libur terdekat. `from` inklusif. |

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://host/api/holidays?year=2026&month=8"
```

`/api/holidays?year=2026` tanpa `month` mengembalikan objek yang identik dengan
`holidays-2026.json`. Itu bukan kebetulan: file statis dan response API memakai
envelope yang sama, dan build menyalinnya apa adanya.

### Contoh respons

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-08-17",
      "name": "Proklamasi Kemerdekaan Republik Indonesia",
      "type": "holiday",
      "is_holiday": true,
      "is_joint_holiday": false
    }
  ],
  "meta": {
    "year": 2026,
    "count": 25,
    "source": "SKB Menteri Agama, Ketenagakerjaan, dan PANRB No. 1497/2025, 2/2025, 5/2025",
    "published": "2025-09-19",
    "last_updated": "2026-09-28"
  }
}
```

Semua respons - termasuk file statis - memakai envelope `success`, `data`, `meta`.
Respons gagal memakai `success: false` dan `error.message` yang menyebut
penyebabnya, termasuk tahun yang diminta dan tahun yang tersedia.

## Static Page (GitHub Pages)

`npm run build:static-page` menulis `dist/index.html`: dokumentasi untuk jalur
JSON statis, terpisah dari halaman server. Bedanya bukan kosmetik - di Pages
tidak ada server, tidak ada API key, tidak ada endpoint, jadi halaman itu
menjelaskan file dan cara membacanya, bukan request HTTP.

Deploy lewat `.github/workflows/pages.yml`. `dist/` tidak pernah masuk git;
Actions membangun lalu meng-upload hasilnya.

Deploy dipicu tag yang berakhiran `-github`, bukan push ke `main`:

```bash
npm version patch --no-git-tag-version   # naikkan package.json ke 0.1.1
git commit -am "release: 0.1.1"
git tag v0.1.1-github
git push origin main --follow-tags
```

Tag dan versi di `package.json` harus cocok; workflow menolak kalau tidak. Tag
akhiran `-github` menandai channel distribusi, jadi tag lain dengan versi sama
tidak menyentuh Pages.

Kalau repo ini di-fork, set Pages ke Source: GitHub Actions dulu. Tanpa itu
workflow-nya tetap ada tapi tidak ter-deploy.

## Dokumentasi Interaktif

Buka `http://localhost:3001` setelah server jalan. Halamannya Bahasa Indonesia:
cara setup, daftar endpoint, parameter, contoh curl dan JavaScript, kode error,
dan cara memakai jalur JSON statis tanpa API key.

## Menjalankan

```bash
npm install
cp .env.example .env      # isi API_KEY
npm run dev               # http://localhost:3001
```

`npm run dev` melakukan build dulu lalu menjalankan hasilnya. Build step wajib
karena Node tidak bisa mengubah JSX tanpa bundler, dan halaman dokumentasi
memakai JSX. Untuk produksi: `npm run build`, lalu `npm start`.

Untuk menghasilkan JSON statis:

```bash
npm run build:static      # -> dist/
```

`dist/` berisi salinan byte-identik file di `data/`, plus `index.json` sebagai
manifest. Kalau ada satu file yang tidak valid, build berhenti dan `dist/` tidak
sama sekali ditulis - bukan ditulis sebagian.

## Catatan Sumber Data

Jadwal hari libur nasional ditetapkan melalui **SKB 3 Menteri** (Kementerian
Agama, Kementerian Ketenagakerjaan, dan Kementerian Pendayagunaan Aparatur
Negara dan Reformasi Birokrasi), dan **ditulis tangan** dari SKB tersebut. Tidak
ada generator tanggal: hasil hitungan bisa meleset satu-dua hari dari SKB, dan
SKB yang benar.

Artinya daftar ini bisa saja belum final untuk tahun berikutnya. Periksa
`meta.published` dan cache di sisi klien.

## Kontribusi

Kirim PR kalau punya SKB untuk tahun yang belum ada di sini. Sertakan nomor SKB
dan tanggal verifikasi - data tanpa sumber tidak akan diterima.

## Lisensi

[MIT](LICENSE) (c) 2026 Maulana Muhammad Rifqi
