import { createFactory } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { bearerAuth } from 'hono/bearer-auth'
import { timingSafeEqual } from 'hono/utils/buffer'
import { getYear, listYears } from './dataset.ts'
import { DocsPage } from './pages/docs.tsx'
import {
  countByType,
  dayName,
  filterByMonth,
  holidayOn,
  isDayOff,
  isIsoDate,
  upcoming,
  type Holiday,
} from './core/index.ts'

/**
 * Cloudflare Worker supplying `API_KEY` as a binding makes `c.env.API_KEY`
 * directly accessible - no need to read `process.env`. That's the runtime
 * Workers offers natively.
 *
 * The Node side does NOT get that for free: `serve()` from @hono/node-server
 * only passes `HttpBindings`. So `src/server/index.ts` reads `process.env` and
 * hands it over as the second argument of `app.fetch()`. That belongs in the
 * adapter, not in `app.ts` - otherwise this file would know there's a Node
 * runtime existing, which breaks the SRP boundary.
 *
 * createFactory is used so that this Env type is declared only once here, and
 * middleware/handlers get the same type automatically. Setting it again on
 * `new Hono<Env>()` would be redundant.
 */
type Env = { Bindings: { API_KEY: string } }

const factory = createFactory<Env>()

function readApiKey(c: { env: Env['Bindings'] }): string {
  const key = c.env?.API_KEY
  if (typeof key === 'string' && key !== '') return key

  throw new Error(
    'API_KEY belum dikonfigurasi. Salin .env.example jadi .env, atau set lewat `wrangler secret put API_KEY`.',
  )
}

type Ctx = Parameters<Parameters<typeof factory.createMiddleware>[0]>[0]

function fail(c: Ctx, status: 400 | 404 | 500, message: string) {
  return c.json({ success: false as const, error: { message } }, status)
}

function missingYear(c: Ctx, year: number) {
  return fail(
    c,
    404,
    `Data hari libur untuk tahun ${year} belum tersedia. ` +
      `SKB 3 Menteri untuk tahun tersebut belum terbit atau masih dalam proses, ` +
      `jadi data sengaja tidak dikirimi daripada mengirim perkiraan yang bisa salah. ` +
      `Tahun yang tersedia: ${listYears().join(', ')}.`,
  )
}

export const app = factory.createApp()

app.use('*', cors({ origin: '*' }))

/** Endpoint yang boleh dibuka tanpa key. Manifest tahun dibutuhkan client
 *  untuk tahu endpoint lain ada - jadi dikecualikan, sisanya tidak. */
const PUBLIC_API_PATHS = new Set(['/api/years'])

const authenticate = factory.createMiddleware(
  bearerAuth({
    verifyToken: async (token, c) => timingSafeEqual(readApiKey(c), token),
  }),
)

app.use('/api/*', async (c, next) => {
  if (PUBLIC_API_PATHS.has(c.req.path)) return next()
  return authenticate(c, next)
})

app.onError((error, c) => {
  // 401/400 dari middleware auth harus tetap apa adanya, bukan jadi 500.
  if (error instanceof HTTPException) return error.getResponse()
  return fail(c, 500, `Kesalahan server: ${error.message}`)
})

app.get('/health', (c) =>
  c.json({ success: true as const, data: { up: true, years: listYears() } }),
)

app.get('/', (c) => {
  const origin = new URL(c.req.url).origin
  return c.html(<DocsPage years={listYears()} origin={origin} />)
})

app.get('/api/years', (c) => {
  const years = listYears()
  return c.json({
    success: true as const,
    data: years.map((year) => {
      const found = getYear(year) as { data: Holiday[]; meta: { source: string } }
      return { year, count: found.data.length, source: found.meta.source }
    }),
    meta: { count: years.length },
  })
})

app.get('/api/holidays', (c) => {
  const yearParam = c.req.query('year')
  const year = yearParam === undefined ? new Date().getUTCFullYear() : Number(yearParam)

  if (!Number.isInteger(year) || year < 1900 || year > 2999) {
    return fail(c, 400, `year harus bilangan bulat antara 1900 dan 2999, dapat "${yearParam}"`)
  }

  const found = getYear(year)
  if (found === undefined) return missingYear(c, year)

  const monthParam = c.req.query('month')
  if (monthParam === undefined) {
    return c.json({ success: true as const, data: found.data, meta: found.meta })
  }

  const month = Number(monthParam)
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return fail(c, 400, `month harus bilangan bulat antara 1 dan 12, dapat "${monthParam}"`)
  }

  const data = filterByMonth(found.data, month)
  return c.json({
    success: true as const,
    data,
    meta: { ...found.meta, month, count: data.length, breakdown: countByType(data) },
  })
})

app.get('/api/check', (c) => {
  const date = c.req.query('date')
  if (date === undefined || !isIsoDate(date)) {
    return fail(c, 400, `date wajib diisi dengan format YYYY-MM-DD, dapat "${date ?? ''}"`)
  }

  const year = Number(date.slice(0, 4))
  const found = getYear(year)
  if (found === undefined) return missingYear(c, year)

  const day = dayName(date)
  const matches = holidayOn(found.data, date)

  return c.json({
    success: true as const,
    data: {
      date,
      day,
      is_weekend: day === 'Minggu' || day === 'Sabtu',
      is_holiday: matches.some((holiday) => holiday.is_holiday),
      is_joint_holiday: matches.some((holiday) => holiday.is_joint_holiday),
      is_day_off: matches.some(isDayOff),
      holidays: matches,
    },
    meta: { year },
  })
})

app.get('/api/upcoming', (c) => {
  const limitParam = c.req.query('limit') ?? '5'
  const limit = Number(limitParam)
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return fail(c, 400, `limit harus bilangan bulat antara 1 dan 50, dapat "${limitParam}"`)
  }

  const from = c.req.query('from') ?? new Date().toISOString().slice(0, 10)
  if (!isIsoDate(from)) {
    return fail(c, 400, `from harus format YYYY-MM-DD, dapat "${from}"`)
  }

  const year = Number(from.slice(0, 4))
  const found = getYear(year)
  if (found === undefined) return missingYear(c, year)

  const data = upcoming(found.data, from, limit)
  const nextYear = getYear(year + 1)

  return c.json({
    success: true as const,
    data,
    meta: {
      year,
      from,
      count: data.length,
      exhausted: data.length === 0,
      next_year_available: nextYear !== undefined,
    },
  })
})
