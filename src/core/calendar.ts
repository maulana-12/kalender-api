/**
 * Geometri kalender: nama bulan, jumlah hari, dan posisi hari pertama.
 *
 * Dipakai oleh dua renderer yang tidak bisa saling_import: halaman server
 * (`src/pages/calendar.tsx`) dan skrip browser untuk GitHub Pages
 * (`src/client/static-calendar.ts`). Keduanya harus menghitung bulan kabisat
 * dan kolom hari pertama dengan cara yang sama persis. Kalau aritmatikanya
 * ditulis dua kali, satu versi akan diam-diam berbeda - dan tidak ada yang
 * melihatnya, karena bug tanggal tidak pernah menunjuk ke dirinya sendiri.
 *
 * Nol I/O, nol dependency, deterministic: satu-satunya input adalah angka.
 */

export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

/**
 * Jumlah hari dalam satu bulan. `month` 1-12, bukan 0-11, supaya pemakai tidak
 * perlu `+ 1` di setiap tempat. Tanggal 0 berarti "hari terakhir bulan
 * sebelumnya", jadi `month` dipakai apa adanya.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Kolom hari pertama bulan, 0 = Minggu. Sama seperti `Date.getUTCDay()`. */
export function monthStartWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
}

export type DayCell = {
  date: string
  day: number
  /** 0 = Minggu, sama dengan indeks kolom di grid. */
  weekday: number
}

/**
 * Grid satu bulan, sudah termasuk sel kosong di depan hari pertama dan di
 * belakang hari terakhir, jadi jumlahnya kelipatan 7 dan bisa langsung dipecah
 * per minggu. `null` berarti sel kosong, bukan tanggal yang hilang.
 */
export function monthGrid(year: number, month: number): (DayCell | null)[] {
  const lead = monthStartWeekday(year, month)
  const total = daysInMonth(year, month)
  const prefix = String(month).padStart(2, '0')
  const cells: (DayCell | null)[] = Array.from({ length: lead }, () => null)

  for (let day = 1; day <= total; day += 1) {
    cells.push({
      date: `${year}-${prefix}-${String(day).padStart(2, '0')}`,
      day,
      weekday: (lead + day - 1) % 7,
    })
  }

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
