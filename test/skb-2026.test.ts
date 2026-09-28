import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { YEARS } from '../src/dataset.ts'
import { dayName, type Holiday } from '../src/core/index.ts'

/**
 * Regresi terhadap SKB 3 Menteri.
 *
 * Sumber: SKB Menteri Agama, Ketenagakerjaan, dan PANRB
 *   No. 1497/2025, 2/2025, 5/2025 tentang Hari Libur Nasional dan Cuti
 *   Bersama Tahun 2026. Ditetapkan 19 September 2025. Tidak ada amandemen.
 *
 * Test ini mengunci ISI, bukan bentuk JSON. Kalau data diedit salah, test ini
 * harus merah - bukan lolos karena "masih valid JSON".
 *
 * Ganti angka di sini HANYA kalau ada SKB baru/amandemen, dan wajib ikut
 * decision-log.md.
 */

const SKB_2026 = {
  source: 'SKB Menteri Agama, Ketenagakerjaan, dan PANRB No. 1497/2025, 2/2025, 5/2025',
  published: '2025-09-19',
  liburNasional: 17,
  cutiBersama: 8,
}

type Expected = [date: string, day: string, type: Holiday['type']]

const HARIS_LIBUR: Expected[] = [
  ['2026-01-01', 'Kamis', 'holiday'],
  ['2026-01-16', 'Jumat', 'holiday'],
  ['2026-02-17', 'Selasa', 'holiday'],
  ['2026-03-19', 'Kamis', 'holiday'],
  ['2026-03-21', 'Sabtu', 'holiday'],
  ['2026-03-22', 'Minggu', 'holiday'],
  ['2026-04-03', 'Jumat', 'holiday'],
  ['2026-04-05', 'Minggu', 'holiday'],
  ['2026-05-01', 'Jumat', 'holiday'],
  ['2026-05-14', 'Kamis', 'holiday'],
  ['2026-05-27', 'Rabu', 'holiday'],
  ['2026-05-31', 'Minggu', 'holiday'],
  ['2026-06-01', 'Senin', 'holiday'],
  ['2026-06-16', 'Selasa', 'holiday'],
  ['2026-08-17', 'Senin', 'holiday'],
  ['2026-08-25', 'Selasa', 'holiday'],
  ['2026-12-25', 'Jumat', 'holiday'],
]

const CUTI_BERSAMA: Expected[] = [
  ['2026-02-16', 'Senin', 'leave'],
  ['2026-03-18', 'Rabu', 'leave'],
  ['2026-03-20', 'Jumat', 'leave'],
  ['2026-03-23', 'Senin', 'leave'],
  ['2026-03-24', 'Selasa', 'leave'],
  ['2026-05-15', 'Jumat', 'leave'],
  ['2026-05-28', 'Kamis', 'leave'],
  ['2026-12-24', 'Kamis', 'leave'],
]

const data2026 = YEARS[2026]?.data as Holiday[]

describe('SKB 3 Menteri tahun 2026', () => {
  it('tahunnya terdaftar dan punya meta dari SKB yang benar', () => {
    expect(YEARS[2026], 'tahun 2026 tidak ada di dataset').toBeDefined()
    expect(YEARS[2026]?.meta.source).toBe(SKB_2026.source)
    expect(YEARS[2026]?.meta.published).toBe(SKB_2026.published)
  })

  it('jumlah hari sesuai SKB: 17 libur nasional + 8 cuti bersama', () => {
    const libur = data2026.filter((holiday) => holiday.type === 'holiday')
    const cuti = data2026.filter((holiday) => holiday.type === 'leave')

    expect(libur).toHaveLength(SKB_2026.liburNasional)
    expect(cuti).toHaveLength(SKB_2026.cutiBersama)
    expect(data2026).toHaveLength(SKB_2026.liburNasional + SKB_2026.cutiBersama)
  })

  it('setiap hari libur: tanggal, hari, dan jenisnya persis seperti SKB', () => {
    const libur = data2026.filter((holiday) => holiday.type === 'holiday')
    const actual = libur.map((holiday) => [holiday.date, dayName(holiday.date), holiday.type])

    expect(actual).toEqual(HARIS_LIBUR)
  })

  it('setiap cuti bersama: tanggal, hari, dan jenisnya persis seperti SKB', () => {
    const cuti = data2026.filter((holiday) => holiday.type === 'leave')
    const actual = cuti.map((holiday) => [holiday.date, dayName(holiday.date), holiday.type])

    expect(actual).toEqual(CUTI_BERSAMA)
  })

  it('file data/holidays-2026.json sama persis dengan yang di dataset', async () => {
    const onDisk = JSON.parse(await readFile('data/holidays-2026.json', 'utf8'))
    expect(onDisk.data).toEqual(data2026)
  })
})
