import { HOLIDAY_TYPES, type Holiday, type YearResponse } from './types.ts'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DAY = /^(Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu)$/

export const DAY_NAMES = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const

export type DayName = (typeof DAY_NAMES)[number]

export function dayName(date: string): DayName {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Tanggal tidak valid: "${date}"`)
  }
  return DAY_NAMES[parsed.getUTCDay()] as DayName
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  // new Date() tidak menolak tanggal overflow, dia meloverflow ke bulan berikutnya
  // (2026-02-30 jadi 2026-03-02). Round-trip ini yang menangkapnya.
  return parsed.toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateHoliday(entry: unknown, year: number, index: number, errors: string[]): void {
  const at = `data[${index}]`

  if (!isRecord(entry)) {
    errors.push(`${at}: bukan object`)
    return
  }

  const { date, name, type, is_holiday, is_joint_holiday } = entry

  if (typeof date !== 'string') {
    errors.push(`${at}.date: harus string, dapat ${typeof date}`)
  } else if (!isIsoDate(date)) {
    errors.push(`${at}.date: "${date}" bukan tanggal ISO 8601 yang nyata`)
  } else if (date.slice(0, 4) !== String(year)) {
    errors.push(`${at}.date: "${date}" bukan tahun ${year} - filename dan isi harus_year sama`)
  }

  if (typeof name !== 'string' || name.trim() === '') {
    errors.push(`${at}.name: harus string yang tidak kosong`)
  }

  if (typeof type !== 'string' || !HOLIDAY_TYPES.includes(type as never)) {
    errors.push(`${at}.type: "${String(type)}" bukan salah satu dari ${HOLIDAY_TYPES.join(', ')}`)
  }

  if (is_holiday !== (type === 'holiday')) {
    errors.push(
      `${at}.is_holiday: harus ${String(type === 'holiday')} karena type adalah "${String(type)}"`,
    )
  }

  if (is_joint_holiday !== (type === 'leave')) {
    errors.push(
      `${at}.is_joint_holiday: harus ${String(type === 'leave')} karena type adalah "${String(type)}"`,
    )
  }

  if (is_holiday === true && is_joint_holiday === true) {
    errors.push(`${at}: is_holiday dan is_joint_holiday tidak boleh true bersamaan`)
  }
}

export function validateYear(year: number, payload: unknown): string[] {
  const errors: string[] = []

  if (!isRecord(payload)) {
    return [`payload: bukan object (dapat ${payload === null ? 'null' : typeof payload})`]
  }

  if (payload.success !== true) {
    errors.push(`success: harus boolean true`)
  }

  const { data, meta } = payload

  if (!Array.isArray(data)) {
    errors.push(`data: harus array, dapat ${data === undefined ? 'undefined' : typeof data}`)
  } else {
    if (data.length === 0) {
      errors.push(`data: array kosong - itu berarti "tahun ini tanpa libur", bukan "belum ada data"`)
    }
    data.forEach((entry, index) => validateHoliday(entry, year, index, errors))

    const dates = data
      .map((entry) => (isRecord(entry) ? entry.date : undefined))
      .filter((value): value is string => typeof value === 'string')

    for (let i = 1; i < dates.length; i++) {
      const previous = dates[i - 1] as string
      const current = dates[i] as string
      if (previous === current) {
        errors.push(`data: tanggal duplikat "${current}"`)
      } else if (previous > current) {
        errors.push(`data: tidak terurut menaik - "${previous}" muncul sebelum "${current}"`)
      }
    }
  }

  if (!isRecord(meta)) {
    errors.push(`meta: harus object`)
  } else {
    if (meta.year !== year) {
      errors.push(`meta.year: harus ${year}, dapat ${String(meta.year)}`)
    }
    if (Array.isArray(data) && meta.count !== data.length) {
      errors.push(`meta.count: harus ${data.length}, dapat ${String(meta.count)}`)
    }
    for (const field of ['source', 'published', 'last_updated'] as const) {
      if (typeof meta[field] !== 'string' || (meta[field] as string).trim() === '') {
        errors.push(`meta.${field}: harus string yang tidak kosong`)
      }
    }
  }

  return errors
}

export function assertValidYear(year: number, payload: unknown): asserts payload is YearResponse {
  const errors = validateYear(year, payload)
  if (errors.length > 0) {
    throw new Error(`data/holidays-${year}.json tidak valid:\n  - ${errors.join('\n  - ')}`)
  }
}

export function holidayOn(holidays: Holiday[], date: string): Holiday[] {
  return holidays.filter((holiday) => holiday.date === date)
}
