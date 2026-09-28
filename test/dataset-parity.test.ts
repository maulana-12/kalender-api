import { readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { listYears, YEARS } from '../src/dataset.ts'

const FILE_PATTERN = /^holidays-(\d{4})\.json$/

/**
 * Tanpa test ini, tambah file di data/ tapi lupa mendaftarkannya di
 * src/dataset.ts akan menghasilkan 404 diam-diam selamanya.
 */
describe('parity data/ dan dataset.ts', () => {
  it('set tahun di dataset sama persis dengan file di data/', async () => {
    const files = (await readdir('data')).filter((file) => FILE_PATTERN.test(file))
    const yearsOnDisk = files.map((file) => Number((file.match(FILE_PATTERN) as RegExpMatchArray)[1]))

    expect(listYears()).toEqual(yearsOnDisk.sort((a, b) => a - b))
  })

  it('tidak ada file lain yang ngumpet di data/', async () => {
    const files = await readdir('data')
    const stray = files.filter((file) => !FILE_PATTERN.test(file))
    expect(stray).toEqual([])
  })

  it('SEMUA tahun punya data dan tidak kosong', () => {
    for (const [year, payload] of Object.entries(YEARS)) {
      expect(payload.data.length, `tahun ${year} kosong`).toBeGreaterThan(0)
      expect(payload.meta.year).toBe(Number(year))
    }
  })
})
