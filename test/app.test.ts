import { describe, expect, it } from 'vitest'
import { app } from '../src/app.tsx'
import holidays2026 from '../data/holidays-2026.json' with { type: 'json' }
import holidays2027 from '../data/holidays-2027.json' with { type: 'json' }

const KEY = 'kunci-uji'
const AUTH = { Authorization: `Bearer ${KEY}` }

/**
 * Env wajib lewat `app.fetch(request, env)`, bukan `app.request(path, init, env)`.
 * Di Hono 4.13.9 argumen ketiga `app.request()` diabaikan, jadi memakainya
 * membuat test hijau tanpa benar-benar menguji jalur env. `fetch()` meniru
 * persis apa yang runtime lakukan: Cloudflare Worker mengirim binding,
 * `src/server/index.ts` meneruskan `process.env`.
 */
const MISSING = Symbol('env tidak di-set')

const call = async (
  path: string,
  init?: RequestInit,
  apiKey: string | typeof MISSING = KEY,
) => {
  const request = new Request(`http://localhost${path}`, init)
  if (apiKey === MISSING) return app.fetch(request)
  return app.fetch(request, { API_KEY: apiKey })
}

type HolidayEntry = {
  date: string
  name: string
  type: string
  is_holiday: boolean
  is_joint_holiday: boolean
}

type YearBody = {
  success: true
  data: HolidayEntry[]
  meta: { year: number; count: number; month?: number }
}

type CheckBody = {
  success: true
  data: {
    date: string
    day: string
    is_weekend: boolean
    is_holiday: boolean
    is_joint_holiday: boolean
    is_day_off: boolean
    holidays: HolidayEntry[]
  }
  meta: { year: number }
}

type UpcomingBody = {
  success: true
  data: HolidayEntry[]
  meta: { exhausted: boolean; next_year_available: boolean }
}

type ErrorBody = { success: false; error: { message: string } }

const as = <T,>(res: Response) => res.json() as Promise<T>

describe('auth', () => {
  it('menolak /api/* tanpa key', async () => {
    expect((await call('/api/holidays?year=2026')).status).toBe(401)
  })

  it('menolak /api/* dengan key yang salah', async () => {
    const res = await call('/api/holidays?year=2026', {
      headers: { Authorization: 'Bearer bukan-key-yang-benar' },
    })
    expect(res.status).toBe(401)
  })

  it('/health tetap terbuka tanpa key (buat uptime monitor)', async () => {
    const res = await call('/health')
    expect(res.status).toBe(200)
  })

  it('/api/years terbuka tanpa key', async () => {
    expect((await call('/api/years')).status).toBe(200)
  })

  it('gagal keras, bukan diam-diam, kalau API_KEY belum diset', async () => {
    const res = await call('/api/holidays?year=2026', { headers: AUTH }, MISSING)
    expect(res.status).toBe(500)
    expect((await as<ErrorBody>(res)).error.message).toMatch(/API_KEY belum dikonfigurasi/)
  })
})

describe('GET / (dokumentasi)', () => {
  it('halaman indeks terbuka tanpa key dan mengembalikan HTML', async () => {
    const res = await call('/')
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(body).toContain('<html lang="id">')
  })

  it('dokumentasi memakai bahasa Indonesia dan menyebut endpoint yang benar', async () => {
    const body = await (await call('/')).text()

    expect(body).toContain('Mulai cepat')
    expect(body).toContain('/api/holidays')
    expect(body).toContain('/api/check')
    expect(body).toContain('/api/upcoming')
    expect(body).toContain('/api/years')
  })

  it('menjelaskan cara pakai API key, karena itu bagian yang paling bikin bingung', async () => {
    const body = await (await call('/')).text()

    expect(body).toContain('Authorization')
    expect(body).toContain('Bearer')
  })

  it('contoh curl memakai -s dan | jq supaya outputnya bisa dibaca', async () => {
    const body = await (await call('/')).text()

    // Tanpa `-s`, progress bar curl mengotori output. Tanpa `| jq`, JSON
    // keluar satu baris panjang. Contoh di halaman adalah yang paling sering
    // disalin, jadi dua hal itu ikut diuji. Tanda kutip sengaja tidak
    // dilibatkan: JSX meng-escape-nya jadi `&quot;`, dan yang penting di sini
    // adalah flag dan pipe-nya.
    expect(body).toContain('curl -s -H')
    expect(body).toContain('Authorization: Bearer $API_KEY')
    expect(body).toContain('| jq')
  })

  it('menampilkan tahun yang benar-benar tersedia, bukan angka karangan', async () => {
    const body = await (await call('/')).text()

    expect(body).toContain('2026')
    expect(body).toContain('2027')
    // 2024 dan 2025 sengaja tidak boleh muncul sebagai "tahun tersedia"
    expect(body).not.toMatch(/years: 2024|years: 2025/)
  })

  it('tidak punya sel tabel kosong - Symptom komponen yang salah baca prop', async () => {
    const body = await (await call('/')).text()

    // `<td></td>` muncul kalau komponen me-render `undefined` atau salah nama
    // field. Tidak error, tidak ketahuan Except kalau HTML-nya dicek.
    expect(body).not.toContain('<td></td>')
    expect(body).not.toContain('undefined')
  })

  it('menampilkan penjelasan tiap kode error, bukan cuma angkanya', async () => {
    const body = await (await call('/')).text()

    expect(body).toContain('Parameter tidak valid')
    expect(body).toContain('API key salah atau tidak dikirim')
    expect(body).toContain('Tahun itu belum ada datanya')
  })

  it('origin pada contoh curl mengikuti host yang benar-benar dipakai', async () => {
    const body = await (await call('/')).text()

    expect(body).toContain('http://localhost/holidays-2026.json')
  })
})

describe('GET /api/holidays', () => {
  it('tanpa filter mengembalikan isi file statis, byte-identik', async () => {
    const res = await call('/api/holidays?year=2026', { headers: AUTH })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(holidays2026)
  })

  it('tahun 2027 juga dilayani, bukan cuma terdaftar di dataset', async () => {
    const res = await call('/api/holidays?year=2027', { headers: AUTH })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(holidays2027)
  })

  it('filter bulan mengembalikan hanya entri bulan itu', async () => {
    const res = await call('/api/holidays?year=2026&month=8', { headers: AUTH })
    const body = await as<YearBody>(res)

    expect(res.status).toBe(200)
    // Agustus 2026 punya dua: 17 Agustus dan 25 August.
    expect(body.data).toHaveLength(2)
    expect(body.data.map((holiday) => holiday.date)).toEqual(['2026-08-17', '2026-08-25'])
    expect(body.meta.month).toBe(8)
    expect(body.meta.count).toBe(2)
  })

  it('tahun tanpa data jawab 404 dan sebut tahun yang tersedia', async () => {
    const res = await call('/api/holidays?year=2035', { headers: AUTH })
    const body = await as<ErrorBody>(res)

    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(body.error.message).toContain('2035')
    expect(body.error.message).toContain('2026')
  })

  it('tahun tanpa data TIDAK PERNAH membalas array kosong', async () => {
    for (const year of [2024, 2025, 2028, 2030]) {
      const res = await call(`/api/holidays?year=${year}`, { headers: AUTH })
      expect(res.status, `tahun ${year}`).toBe(404)
    }
  })

  it('tolak parameter tidak valid dengan 400', async () => {
    expect((await call('/api/holidays?year=abc', { headers: AUTH })).status).toBe(400)
    expect((await call('/api/holidays?year=2026&month=13', { headers: AUTH })).status).toBe(400)
    expect((await call('/api/holidays?year=2026&month=0', { headers: AUTH })).status).toBe(400)
  })
})

describe('GET /api/check', () => {
  it('tanggal libur nasional terdeteksi', async () => {
    const res = await call('/api/check?date=2026-08-17', { headers: AUTH })
    const body = await as<CheckBody>(res)

    expect(res.status).toBe(200)
    expect(body.data.day).toBe('Senin')
    expect(body.data.is_holiday).toBe(true)
    expect(body.data.is_joint_holiday).toBe(false)
    expect(body.data.is_day_off).toBe(true)
    expect(body.data.holidays).toHaveLength(1)
  })

  it('tanggal cuti bersama terdeteksi sebagai day off, bukan holiday', async () => {
    const res = await call('/api/check?date=2026-05-28', { headers: AUTH })
    const body = await as<CheckBody>(res)

    expect(body.data.is_holiday).toBe(false)
    expect(body.data.is_joint_holiday).toBe(true)
    expect(body.data.is_day_off).toBe(true)
  })

  it('hari kerja biasa terdeteksi sebagai bukan day off', async () => {
    const res = await call('/api/check?date=2026-09-30', { headers: AUTH })
    const body = await as<CheckBody>(res)

    expect(body.data.day).toBe('Rabu')
    expect(body.data.is_day_off).toBe(false)
    expect(body.data.holidays).toEqual([])
  })

  it('akhir pekan terdeteksi lewat is_weekend', async () => {
    const res = await call('/api/check?date=2026-08-22', { headers: AUTH })
    expect((await as<CheckBody>(res)).data.is_weekend).toBe(true)
  })

  it('tolak tanggal ngawur dengan 400, bukan diam-diam', async () => {
    for (const bad of ['abc', '2026-02-30', '17-08-2026']) {
      const res = await call(`/api/check?date=${bad}`, { headers: AUTH })
      expect(res.status, `date="${bad}"`).toBe(400)
    }
  })
})

describe('GET /api/upcoming', () => {
  it('mengembalikan libur pada tanggal yang diminta dan sesudahnya', async () => {
    const res = await call('/api/upcoming?from=2026-08-17&limit=3', { headers: AUTH })
    const body = await as<UpcomingBody>(res)

    // `from` bersifat inklusif: kalau hari ini libur, client harus diberi tahu.
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(3)
    expect(body.data.map((holiday) => holiday.date)).toEqual([
      '2026-08-17',
      '2026-08-25',
      '2026-12-24',
    ])
  })

  it('menlipat hari yang sama supaya "hari ini libur" terdeteksi', async () => {
    const res = await call('/api/upcoming?from=2026-08-18&limit=1', { headers: AUTH })
    const body = await as<UpcomingBody>(res)

    expect(body.data[0]?.date).toBe('2026-08-25')
  })

  it('limit dibatasi 1-50', async () => {
    expect((await call('/api/upcoming?from=2026-01-01&limit=0', { headers: AUTH })).status).toBe(400)
    expect((await call('/api/upcoming?from=2026-01-01&limit=999', { headers: AUTH })).status).toBe(400)
  })

  it('tahun habis ditandai exhausted, bukan disamarkan jadi array kosong biasa', async () => {
    const res = await call('/api/upcoming?from=2027-12-27', { headers: AUTH })
    const body = await as<UpcomingBody>(res)

    expect(body.data).toEqual([])
    expect(body.meta.exhausted).toBe(true)
    expect(body.meta.next_year_available).toBe(false)
  })

  it('tahun habis tapi tahun berikutnya ada: exhausted tetap jujur, next_year_available true', async () => {
    const res = await call('/api/upcoming?from=2026-12-26', { headers: AUTH })
    const body = await as<UpcomingBody>(res)

    expect(body.data).toEqual([])
    expect(body.meta.exhausted).toBe(true)
    expect(body.meta.next_year_available).toBe(true)
  })
})
