import { describe, expect, it, vi } from 'vitest'
import { app } from '../src/app.tsx'
import { render } from '../src/pages/static-calendar.tsx'
import {
  boot,
  calendarHtml,
  escapeHtml,
  readQuery,
  type BootOptions,
} from '../src/client/static-calendar.ts'
import { CALENDAR_STYLE } from '../src/pages/calendar-style.ts'
import type { Holiday, YearMeta } from '../src/core/index.ts'
import data2026 from '../data/holidays-2026.json' with { type: 'json' }
import data2027 from '../data/holidays-2027.json' with { type: 'json' }

const HOLIDAYS_2026 = data2026.data as Holiday[]
const META_2026 = data2026.meta as YearMeta
const HOLIDAYS_2027 = data2027.data as Holiday[]
const META_2027 = data2027.meta as YearMeta

const SCRIPT = 'document.getElementById("isi")'

const datesIn = (html: string) => [...html.matchAll(/data-date="([0-9-]+)"/g)].map((m) => m[1] as string)
const classNamesIn = (html: string) =>
  [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => (m[1] as string).split(' '))
const countType = (html: string, type: string) =>
  (html.match(new RegExp(`data-type="${type}"`, 'g')) ?? []).length

const calendar = (year: number, month?: number, today = '2026-01-05') =>
  calendarHtml({
    year,
    month,
    years: [2026, 2027],
    holidays: year === 2027 ? HOLIDAYS_2027 : HOLIDAYS_2026,
    meta: year === 2027 ? META_2027 : META_2026,
    today,
  })

describe('kalender.html - shell', () => {
  it('menghasilkan dokumen HTML lengkap dengan script-nya inline', () => {
    const html = render(SCRIPT)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<main id="isi">')
    expect(html).toContain('id="tahun"')
    expect(html).toContain('<noscript>')
    expect(html.match(/<script>/g)).toHaveLength(1)
    expect(html).toContain(SCRIPT)
  })

  it('tidak membungkus data libur di dalam HTML', () => {
    const html = render(SCRIPT)
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(html).not.toContain('Proklamasi Kemerdekaan')
  })

  it('memakai link relatif supaya tetap jalan saat repo di-fork', () => {
    const html = render(SCRIPT)
    expect(html).not.toContain('https://')
    expect(html).toContain('href="./"')
    expect(html).toContain('href="./index.json"')
  })

  it('menaruh canonical hanya kalau host-nya diketahui', () => {
    expect(render(SCRIPT)).not.toContain('canonical')
    expect(render(SCRIPT, 'https://contoh.pages.dev/')).toContain(
      '<link rel="canonical" href="https://contoh.pages.dev/kalender.html">',
    )
  })

  it('menolak baseUrl yang bukan http(s)', () => {
    expect(() => render(SCRIPT, 'ftp://contoh.dev')).toThrow(/http/)
  })

  it('menolak script yang bisa menutup tag script duluan', () => {
    expect(() => render('var a = "</script>";')).toThrow(/script/)
    expect(() => render('   ')).toThrow(/kosong/)
  })
})

describe('kalender.html - render kalender', () => {
  it('menampilkan dua belas bulan untuk 2026', () => {
    const html = calendar(2026)
    for (const bulan of ['Januari', 'Juni', 'Desember']) {
      expect(html).toContain(bulan)
    }
    expect(datesIn(html)).toHaveLength(365)
  })

  it('menandai 17 libur dan 8 cuti bersama untuk 2026, 18 dan 8 untuk 2027', () => {
    expect(countType(calendar(2026), 'holiday')).toBe(17)
    expect(countType(calendar(2026), 'leave')).toBe(8)
    expect(countType(calendar(2027), 'holiday')).toBe(18)
    expect(countType(calendar(2027), 'leave')).toBe(8)
  })

  it('menampilkan satu bulan saja kalau month diberikan', () => {
    const html = calendar(2027, 3)
    expect(html).toContain('Maret')
    expect(html).not.toContain('April')
    expect(html).toContain('data-date="2027-03-31"')
    expect(html).not.toContain('data-date="2027-04-01"')
  })

  it('menandai hari ini', () => {
    expect(calendar(2026, 1, '2026-01-10')).toContain('data-date="2026-01-10" data-type="kerja"')
  })

  it('menghasilkan urutan tanggal yang sama dengan halaman server', async () => {
    const server = await (await app.fetch(new Request('http://localhost/kalender?year=2026'))).text()
    expect(datesIn(calendar(2026))).toEqual(datesIn(server))
  })

  it('memakai nama hari dari core, bukan singkatan yang diketik ulang', () => {
    expect(calendar(2026, 8)).toContain('Senin, 17 Agu')
    expect(calendar(2026, 8)).toContain('>Min</th>')
  })

  it('hanya memakai class yang benar-benar ada di stylesheet', () => {
    const tokens = new Set(classNamesIn(calendar(2026)))
    for (const token of tokens) {
      expect(CALENDAR_STYLE, `class "${token}" tidak punya aturan`).toContain(`.${token}`)
    }
  })

  it('menutup karakter HTML di nama libur, bukan cuma di teks', () => {
    const hostile: Holiday[] = [
      {
        date: '2026-01-01',
        name: '<script>alert("x")</script> & "kutip"',
        type: 'holiday',
        is_holiday: true,
        is_joint_holiday: false,
      },
    ]
    const html = calendarHtml({
      year: 2026,
      month: undefined,
      years: [2026],
      holidays: hostile,
      meta: META_2026,
      today: '2026-01-05',
    })

    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;kutip&quot;')
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })
})

describe('kalender.html - baca query', () => {
  it('meneruskan year dan month yang masuk akal', () => {
    expect(readQuery('?year=2027&month=3')).toEqual({ year: 2027, month: 3 })
    expect(readQuery('')).toEqual({ year: undefined, month: undefined })
  })

  it('membuang nilai yang tidak masuk akal, bukan meneruskannya', () => {
    expect(readQuery('?year=abc')).toEqual({ year: undefined, month: undefined })
    expect(readQuery('?year=2026&month=13')).toEqual({ year: 2026, month: undefined })
    expect(readQuery('?month=0')).toEqual({ year: undefined, month: undefined })
  })
})

describe('kalender.html - ambil data dari file JSON publik', () => {
  const fakeTarget = (): BootOptions & { isi: { innerHTML: string } } => ({
    isi: { innerHTML: '' },
    tahun: { textContent: '' },
    search: '',
    today: '2026-01-05',
  })

  const stubFetch = (routes: Record<string, unknown>) =>
    vi.stubGlobal('fetch', async (url: string) => {
      const body = routes[url]
      if (body === undefined) return new Response('not found', { status: 404 })
      return new Response(JSON.stringify(body), { status: 200 })
    })

  it('merender tahun dari query dan mengisi judul', async () => {
    stubFetch({
      './index.json': { data: [{ year: 2026, count: 25 }, { year: 2027, count: 26 }] },
      './holidays-2027.json': data2027,
    })

    const target = fakeTarget()
    target.search = '?year=2027'
    await boot(target)

    expect(target.tahun.textContent).toBe('2027')
    expect(countType(target.isi.innerHTML, 'holiday')).toBe(18)
    expect(target.isi.innerHTML).toContain('Maret')
  })

  it('pakai tahun berjalan kalau tidak ada query', async () => {
    stubFetch({
      './index.json': { data: [{ year: 2026, count: 25 }] },
      './holidays-2026.json': data2026,
    })

    const target = fakeTarget()
    target.today = '2026-05-01'
    await boot(target)

    expect(target.tahun.textContent).toBe('2026')
    expect(target.isi.innerHTML).not.toContain('gagal')
  })

  it('menyebut tahun yang diminta dan tahun yang tersedia kalau tidak ada', async () => {
    stubFetch({ './index.json': { data: [{ year: 2026, count: 25 }] } })

    const target = fakeTarget()
    target.search = '?year=2028'
    await boot(target)

    expect(target.isi.innerHTML).toContain('2028')
    expect(target.isi.innerHTML).toContain('2026')
    expect(target.isi.innerHTML).toContain('gagal')
  })

  it('menyebut penyebabnya kalau file JSON-nya tidak ada atau rusak', async () => {
    stubFetch({
      './index.json': { data: [{ year: 2026, count: 25 }] },
      './holidays-2026.json': { success: true, data: [], meta: {} },
    })

    const target = fakeTarget()
    await boot(target)

    expect(target.isi.innerHTML).toContain('tidak valid')
    expect(target.isi.innerHTML).toContain('data: array kosong')
  })

  it('bilang terus terang kalau index.json kosong', async () => {
    stubFetch({ './index.json': { data: [] } })

    const target = fakeTarget()
    await boot(target)

    expect(target.isi.innerHTML).toContain('tidak memuat tahun')
  })
})
