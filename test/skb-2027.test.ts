import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { YEARS } from '../src/dataset.ts'
import { dayName, type Holiday } from '../src/core/index.ts'

/**
 * Regresi terhadap SKB 3 Menteri.
 *
 * Sumber: SKB Menteri Agama, Ketenagakerjaan, dan PANRB
 *   No. 1205/2026, 3/2026, 2/2026 tentang Hari Libur Nasional dan Cuti
 *   Bersama Tahun 2027. Ditetapkan 15 September 2026.
 *   Belum ada amandemen per 29 September 2026.
 *
 * Test ini mengunci ISI, bukan bentuk JSON. Kalau data diedit salah, test ini
 * harus merah - bukan lolos karena "masih valid JSON".
 *
 * Ganti angka di sini HANYA kalau ada SKB baru/amandemen, dan wajib ikut
 * decision-log.md.
 */

const SKB_2027 = {
  source: 'SKB Menteri Agama, Ketenagakerjaan, dan PANRB No. 1205/2026, 3/2026, 2/2026',
  published: '2026-09-15',
  liburNasional: 18,
  cutiBersama: 8,
}

type Expected = [date: string, day: string, type: Holiday['type']]

const HARIS_LIBUR: Expected[] = [
  ['2027-01-01', 'Jumat', 'holiday'],
  ['2027-01-05', 'Selasa', 'holiday'],
  ['2027-02-06', 'Sabtu', 'holiday'],
  ['2027-03-08', 'Senin', 'holiday'],
  ['2027-03-10', 'Rabu', 'holiday'],
  ['2027-03-11', 'Kamis', 'holiday'],
  ['2027-03-26', 'Jumat', 'holiday'],
  ['2027-03-28', 'Minggu', 'holiday'],
  ['2027-05-01', 'Sabtu', 'holiday'],
  ['2027-05-06', 'Kamis', 'holiday'],
  ['2027-05-17', 'Senin', 'holiday'],
  ['2027-05-20', 'Kamis', 'holiday'],
  ['2027-06-01', 'Selasa', 'holiday'],
  ['2027-06-06', 'Minggu', 'holiday'],
  ['2027-08-15', 'Minggu', 'holiday'],
  ['2027-08-17', 'Selasa', 'holiday'],
  ['2027-12-25', 'Sabtu', 'holiday'],
  ['2027-12-26', 'Minggu', 'holiday'],
]

const CUTI_BERSAMA: Expected[] = [
  ['2027-02-05', 'Jumat', 'leave'],
  ['2027-03-09', 'Selasa', 'leave'],
  ['2027-03-12', 'Jumat', 'leave'],
  ['2027-03-15', 'Senin', 'leave'],
  ['2027-03-25', 'Kamis', 'leave'],
  ['2027-05-18', 'Selasa', 'leave'],
  ['2027-05-19', 'Rabu', 'leave'],
  ['2027-12-24', 'Jumat', 'leave'],
]

const data2027 = YEARS[2027]?.data as Holiday[]

describe('SKB 3 Menteri tahun 2027', () => {
  it('tahunnya terdaftar dan punya meta dari SKB yang benar', () => {
    expect(YEARS[2027], 'tahun 2027 tidak ada di dataset').toBeDefined()
    expect(YEARS[2027]?.meta.source).toBe(SKB_2027.source)
    expect(YEARS[2027]?.meta.published).toBe(SKB_2027.published)
  })

  it('jumlah hari sesuai SKB: 18 libur nasional + 8 cuti bersama', () => {
    const libur = data2027.filter((holiday) => holiday.type === 'holiday')
    const cuti = data2027.filter((holiday) => holiday.type === 'leave')

    expect(libur).toHaveLength(SKB_2027.liburNasional)
    expect(cuti).toHaveLength(SKB_2027.cutiBersama)
    expect(data2027).toHaveLength(SKB_2027.liburNasional + SKB_2027.cutiBersama)
  })

  it('setiap hari libur: tanggal, hari, dan jenisnya persis seperti SKB', () => {
    const libur = data2027.filter((holiday) => holiday.type === 'holiday')
    const actual = libur.map((holiday) => [holiday.date, dayName(holiday.date), holiday.type])

    expect(actual).toEqual(HARIS_LIBUR)
  })

  it('setiap cuti bersama: tanggal, hari, dan jenisnya persis seperti SKB', () => {
    const cuti = data2027.filter((holiday) => holiday.type === 'leave')
    const actual = cuti.map((holiday) => [holiday.date, dayName(holiday.date), holiday.type])

    expect(actual).toEqual(CUTI_BERSAMA)
  })

  it('file data/holidays-2027.json sama persis dengan yang di dataset', async () => {
    const onDisk = JSON.parse(await readFile('data/holidays-2027.json', 'utf8'))
    expect(onDisk.data).toEqual(data2027)
  })
})
