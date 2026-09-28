# Kalender API

REST API untuk data **kalender nasional Indonesia**: hari libur nasional, cuti bersama,
dan hari peringatan nasional.

Berguna untuk aplikasi payroll, sistem shift, kalender akademik, dan fitur booking
hitung mundur — tanpa harus hard-code tabel libur setiap tahun.

## Fitur

- **Hari libur nasional** — Tanggal tetap maupun hari raya religious yang mengikuti
  kalender Hijriah, Saka Bali, dan Kongzili (lihat tabel di bawah).
- **Cuti bersama** — Libur tambahan yang ditetapkan melalui SKB 3 Menteri
  (Kementerian Agama, Kementerian Ketenagakerjaan, dan Kementerian Pendayagunaan
  Aparatur Negara dan Reformasi Birokrasi) setiap tahun.
- **Hari peringatan** — Hari besar nasional non-libur seperti Hari Kartini dan
  Hari Prahariptidek.
- **Cek tanggal** — Periksa apakah sebuah tanggal merupakan hari libur, cuti bersama,
  akhir pekan, atau hari kerja biasa.
- **Data siap pakai** — Tanggal sudah dalam format ISO 8601 (`YYYY-MM-DD`) beserta nama
  dalam Bahasa Indonesia.
- **Tanpa API key** — Endpoint publik, langsung pakai.

## Jenis Hari Libur

Nilai `type` pada setiap entri menunjukkan kategori libur:

| Nilai        | Arti                                                                 |
| ------------ | ------------------------------------------------------------------- |
| `holiday`    | Hari libur nasional — wajib cuti sesuai hukum ketenagakerjaan.       |
| `leave`      | Cuti bersama — cuti tambahan yang ditetapkan SKB 3 Menteri.          |
| `observance` | Hari peringatan nasional — tidak otomatis menjadi hari libur.       |

### Daftar Hari Libur Nasional

Tanggal **tetap** bisa dihitung langsung; tanggal **bergerak** harus ditentukan dari
kalender yang berlaku dan bisa bergeser beberapa hari tiap tahun.

| No | Nama | Tanggal | Kalender | Status |
| -- | ---- | ------- | -------- | ------ |
| 1  | Tahun Baru Masehi | 1 Januari | Gregory | Tetap |
| 2  | Tahun Baru Imlek | Bergerak | Kongzili/Tionggu | Bergerak |
| 3  | Isra Mikraj Nabi Muhammad | Bergerak | Hijriah | Bergerak |
| 4  | Hari Suci Nyepi (Tahun Baru Saka) | Bergerak | Saka Bali | Bergerak |
| 5  | Wafat Isa Almasih | Bergerak | Gregory (Jumat Agung) | Bergerak |
| 6  | Hari Buruh Internasional | 1 Mei | Gregory | Tetap |
| 7  | Kenaikan Isa Almasih | Bergerak | Gregory | Bergerak |
| 8  | Hari Raya Idul Fitri | 1 Syawal | Hijriah | Bergerak |
| 9  | Hari Raya Waisak | Bergerak | Buddha | Bergerak |
| 10 | Hari Lahir Pancasila | 1 Juni | Gregory | Tetap |
| 11 | Hari Raya Idul Adha | 10 Dzulhijjah | Hijriah | Bergerak |
| 12 | Tahun Baru Islam | 1 Muharram | Hijriah | Bergerak |
| 13 | Hari Kemerdekaan RI | 17 Agustus | Gregory | Tetap |
| 14 | Maulid Nabi Muhammad | 12 Rabiul Awal | Hijriah | Bergerak |
| 15 | Hari Raya Natal | 25 Desember | Gregory | Tetap |

## Konsep Data

Setiap entri hari libur mengikuti struktur berikut:

```json
{
  "date": "2026-08-17",
  "name": "Hari Kemerdekaan Republik Indonesia",
  "type": "holiday",
  "is_holiday": true,
  "is_joint_holiday": false,
  "description": "Hari Proklamasi Kemerdekaan Republik Indonesia"
}
```

Field `date` selalu dalam format `YYYY-MM-DD` (ISO 8601, kalender Masehi) agar mudah
diproses oleh bahasa pemrograman maupun basis data.

Nilai `type` yang mungkin muncul:

| Nilai        | Arti                                                                 |
| ------------ | ------------------------------------------------------------------- |
| `holiday`    | Hari libur nasional — wajib cuti sesuai hukum ketenagakerjaan.       |
| `leave`      | Cuti bersama — cuti tambahan yang ditetapkan SKB 3 Menteri.          |
| `observance` | Hari peringatan nasional — tidak otomatis menjadi hari libur.       |

### Field boolean

`type` memberi kategori, sedangkan dua field boolean menjawab pertanyaan yang paling
sering dipakai klien — "apakah tanggal ini hari bebas kerja?":

| Field              | `true` ketika...                                     |
| ------------------ | ---------------------------------------------------- |
| `is_holiday`       | Tanggal adalah hari libur nasional (`type: holiday`). |
| `is_joint_holiday` | Tanggal adalah cuti bersama (`type: leave`).          |

Keduanya **tidak pernah** bernilai `true` bersamaan, dan untuk `type: observance`
keduanya bernilai `false`. Jadi satu baris kode ini selalu cukup:

```js
const isDayOff = holiday.is_holiday || holiday.is_joint_holiday;
```

## Contoh Penggunaan

### Semua hari libur satu tahun

```
GET /api/holidays?year=2026
```

### Hari libur pada bulan tertentu

```
GET /api/holidays?year=2026&month=8
```

### Cek satu tanggal

```
GET /api/check?date=2026-08-17
```

### Libur yang akan datang

```
GET /api/upcoming?limit=5
```

### Contoh respons

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-08-17",
      "name": "Hari Kemerdekaan Republik Indonesia",
      "type": "holiday",
      "is_holiday": true,
      "is_joint_holiday": false,
      "description": "Hari Proklamasi Kemerdekaan Republik Indonesia"
    }
  ],
  "meta": {
    "year": 2026,
    "count": 1,
    "last_updated": "2026-01-05T00:00:00Z"
  }
}
```

## Catatan Sumber Data

Jadwal hari libur nasional Indonesia berubah setiap tahun dan ditetapkan melalui
**SKB 3 Menteri** (Kementerian Agama, Kementerian Ketenagakerjaan, dan Kementerian
Pendayagunaan Aparatur Negara dan Reformasi Birokrasi). Karena itu, data untuk tahun
berikutnya **tidak selalu tersedia di awal tahun** dan bisa saja berubah menjelang hari-H.

Sebaiknya lakukan cache pada sisi klien dan selalu periksa field `meta.last_updated`
pada respons.

## Status Proyek

Repositori ini masih tahap awal. Endpoint di atas merupakan rancangan kontrak API
yang akan diimplementasikan secara bertahap.

## Lisensi

[MIT](LICENSE) © 2026 Maulana Muhammad Rifqi
