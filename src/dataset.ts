import holidays2026 from '../data/holidays-2026.json' with { type: 'json' }
import type { Holiday, YearMeta } from './core/index.ts'

export type YearData = {
  data: Holiday[]
  meta: YearMeta
}

const RAW = {
  2026: holidays2026,
}

/**
 * Satu-satunya tempat di repo ini yang tahu file JSON di `data/` ada.
 * Tambah file baru di `data/`? Daftarkan di sini juga - test
 * `test/dataset-parity.test.ts` gagal kalau lupa.
 */
export const YEARS: Record<number, YearData> = Object.fromEntries(
  Object.entries(RAW).map(([year, value]) => [Number(year), value as YearData]),
)

export function getYear(year: number): YearData | undefined {
  return YEARS[year]
}

export function listYears(): number[] {
  return Object.keys(YEARS).map(Number).sort((a, b) => a - b)
}
