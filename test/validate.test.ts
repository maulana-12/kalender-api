import { describe, expect, it } from 'vitest'
import { assertValidYear, dayName, holidayOn, isIsoDate, validateYear, type Holiday } from '../src/core/index.ts'
import { readFile } from 'node:fs/promises'

function wrap(data: unknown, meta: Record<string, unknown> = {}) {
  return {
    success: true,
    data,
    meta: {
      year: 2026,
      count: Array.isArray(data) ? data.length : 0,
      source: 'uji',
      published: '2025-01-01',
      last_updated: '2025-01-01',
      ...meta,
    },
  }
}

const valid = {
  date: '2026-01-01',
  name: 'Tahun Baru Masehi',
  type: 'holiday',
  is_holiday: true,
  is_joint_holiday: false,
}

/**
 * Test yang cuma cek bentuk JSON tapi tidak cek isi tanggal tidak berguna.
 * Test di sini memastikan rules-nya DITEGAKKAN: validator harus merah
 * kalau aturan dilanggar, bukan hijau karena data kebetulan kebenar.
 */
describe('isIsoDate', () => {
  it('menerima tanggal nyata, menolak tanggal yang tidak ada di kalender', () => {
    expect(isIsoDate('2026-01-01')).toBe(true)
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('01-01-2026')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })
})

describe('dayName', () => {
  it('menghitung hari dalam bahasa Indonesia, bukan locale Inggris', () => {
    expect(dayName('2026-01-01')).toBe('Kamis')
    expect(dayName('2026-08-17')).toBe('Senin')
    expect(dayName('2026-04-05')).toBe('Minggu')
  })

  it('melempar error untuk tanggal tidak valid, bukan diam-diam', () => {
    expect(() => dayName('bukan tanggal')).toThrow(/tidak valid/)
  })
})

describe('validateYear', () => {
  it('menerima data yang benar', () => {
    expect(validateYear(2026, wrap([valid]))).toEqual([])
  })

  it('menolak tahun yang tidak cocok antara filename dan isi', () => {
    const errors = validateYear(2026, wrap([{ ...valid, date: '2027-01-01' }]))
    expect(errors.join()).toMatch(/bukan tahun 2026/)
  })

  it('menolak array kosong, karena itu berarti lain hal dari "belum ada data"', () => {
    const errors = validateYear(2026, wrap([]))
    expect(errors.join()).toMatch(/kosong/)
  })

  it('menolak tanggal duplikat', () => {
    const errors = validateYear(2026, wrap([valid, { ...valid }]))
    expect(errors.join()).toMatch(/duplikat/)
  })

  it('menolak data yang tidak terurut menaik', () => {
    const later = { ...valid, date: '2026-12-25' }
    const errors = validateYear(2026, wrap([later, valid]))
    expect(errors.join()).toMatch(/tidak terurut/)
  })

  it('menolak is_holiday yang tidak cocok dengan type', () => {
    const errors = validateYear(2026, wrap([{ ...valid, is_holiday: false }]))
    expect(errors.join()).toMatch(/is_holiday/)
  })

  it('menolak is_holiday dan is_joint_holiday true bersamaan', () => {
    const errors = validateYear(2026, wrap([{ ...valid, is_joint_holiday: true }]))
    expect(errors.join()).toMatch(/tidak boleh true bersamaan/)
  })

  it('menolak type yang di luar daftar', () => {
    const errors = validateYear(2026, wrap([{ ...valid, type: 'libur' }]))
    expect(errors.join()).toMatch(/bukan salah satu dari/)
  })

  it('menolak nama kosong', () => {
    const errors = validateYear(2026, wrap([{ ...valid, name: '   ' }]))
    expect(errors.join()).toMatch(/name/)
  })

  it('menolak meta yang tidak konsisten dengan data', () => {
    const errors = validateYear(2026, wrap([valid], { count: 99 }))
    expect(errors.join()).toMatch(/meta.count/)
  })

  it('menolak payload yang bukan object', () => {
    expect(validateYear(2026, null).join()).toMatch(/bukan object/)
    expect(validateYear(2026, []).join()).toMatch(/bukan object/)
  })

  it('assertValidYear melempar pesan yang menyebut file yang salah', () => {
    expect(() => assertValidYear(2026, wrap([{ ...valid, date: 'bukan tanggal' }]))).toThrow(
      /data\/holidays-2026\.json tidak valid/,
    )
  })
})

describe('holidayOn', () => {
  it('mencari entri pada tanggal tertentu', () => {
    const data: Holiday[] = [
      { ...valid, type: 'holiday' },
      { ...valid, date: '2026-12-25', name: 'Hari Raya Natal', type: 'holiday' },
    ]
    expect(holidayOn(data, '2026-01-01')).toHaveLength(1)
    expect(holidayOn(data, '2026-03-01')).toEqual([])
  })
})

describe('data asli di disk', () => {
  it('lolos validasi tanpa dimodifikasi', async () => {
    for (const year of [2026]) {
      const payload = JSON.parse(await readFile(`data/holidays-${year}.json`, 'utf8'))
      expect(validateYear(year, payload), `data/holidays-${year}.json`).toEqual([])
    }
  })
})
