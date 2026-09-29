import { describe, expect, it } from 'vitest'
import { app } from '../src/app.tsx'
import { daysInMonth, monthStartWeekday } from '../src/core/index.ts'

const call = (path: string) => app.fetch(new Request(`http://localhost${path}`))

const countType = (html: string, type: string) =>
  (html.match(new RegExp(`data-type="${type}"`, 'g')) ?? []).length

describe('halaman kalender - matematika grid', () => {
  it('menghitung jumlah hari per bulan, termasuk tahun kabisat', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2027, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 4)).toBe(30)
  })

  it('menempatkan hari pertama di kolom yang benar (0 = Minggu)', () => {
    expect(monthStartWeekday(2026, 1)).toBe(4)
    expect(monthStartWeekday(2027, 1)).toBe(5)
    expect(monthStartWeekday(2027, 3)).toBe(1)
  })
})

describe('halaman kalender - tampilan setahun penuh', () => {
  it('tidak butuh API key', async () => {
    const res = await call('/kalender?year=2026')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('menampilkan dua belas bulan untuk tahun 2026', async () => {
    const html = await (await call('/kalender?year=2026')).text()
    for (const bulan of ['Januari', 'Juni', 'Desember']) {
      expect(html).toContain(bulan)
    }
    expect(countType(html, 'holiday')).toBe(17)
    expect(countType(html, 'leave')).toBe(8)
  })

  it('menampilkan 18 libur nasional dan 8 cuti bersama untuk 2027', async () => {
    const html = await (await call('/kalender?year=2027')).text()
    expect(countType(html, 'holiday')).toBe(18)
    expect(countType(html, 'leave')).toBe(8)
  })

  it('menandai tanggal dan jenisnya dengan benar', async () => {
    const html = await (await call('/kalender?year=2026')).text()
    expect(html).toContain('data-date="2026-08-17" data-type="holiday"')
    expect(html).toContain('data-date="2026-05-28" data-type="leave"')
    expect(html).toContain('Proklamasi Kemerdekaan Republik Indonesia')
  })
})

describe('halaman kalender - satu bulan saja', () => {
  it('hanya merender bulan yang diminta', async () => {
    const html = await (await call('/kalender?year=2027&month=3')).text()
    expect(html).toContain('Maret')
    expect(html).not.toContain('April')
    expect(html).toContain('data-date="2027-03-10"')
    expect(html).toContain('data-date="2027-03-31"')
    expect(html).not.toContain('data-date="2027-04-01"')
  })

  it('menautkan kembali ke setahun penuh', async () => {
    const html = await (await call('/kalender?year=2027&month=3')).text()
    expect(html).toContain('/kalender?year=2027')
  })
})

describe('halaman kalender - kesalahan', () => {
  it('menjawab 404 kalau tahun belum punya data', async () => {
    const res = await call('/kalender?year=2028')
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('2028')
  })

  it('menjawab 400 kalau year bukan angka', async () => {
    const res = await call('/kalender?year=abc')
    expect(res.status).toBe(400)
  })

  it('menjawab 400 kalau month di luar 1-12', async () => {
    const res = await call('/kalender?year=2026&month=13')
    expect(res.status).toBe(400)
  })
})
