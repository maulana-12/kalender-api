import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { validateYear, type YearMeta } from '../src/core/index.ts'

const DATA_DIR = 'data'
const DIST_DIR = 'dist'
const FILE_PATTERN = /^holidays-(\d{4})\.json$/

type Entry = {
  year: number
  file: string
  raw: string
  meta: YearMeta
}

async function collect(): Promise<{ entries: Entry[]; errors: string[] }> {
  const errors: string[] = []
  const files = (await readdir(DATA_DIR)).filter((file) => FILE_PATTERN.test(file)).sort()

  if (files.length === 0) {
    return { entries: [], errors: [`Tidak ada file holidays-{year}.json di ${DATA_DIR}/`] }
  }

  const entries: Entry[] = []

  for (const file of files) {
    const year = Number((file.match(FILE_PATTERN) as RegExpMatchArray)[1])
    const raw = await readFile(join(DATA_DIR, file), 'utf8')

    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch (error) {
      errors.push(`${file}: JSON tidak bisa diparse - ${(error as Error).message}`)
      continue
    }

    for (const problem of validateYear(year, payload)) {
      errors.push(`${file}: ${problem}`)
    }
    if (errors.length > 0) continue

    entries.push({ year, file, raw, meta: (payload as { meta: YearMeta }).meta })
  }

  return { entries, errors }
}

async function main(): Promise<void> {
  const { entries, errors } = await collect()

  if (errors.length > 0) {
    console.error(`BUILD GAGAL - ${errors.length} masalah:\n`)
    for (const error of errors) console.error(`  - ${error}`)
    console.error(`\n${DIST_DIR}/ TIDAK ditulis. Perbaiki dulu, lalu jalankan ulang.`)
    process.exitCode = 1
    return
  }

  await mkdir(DIST_DIR, { recursive: true })

  for (const entry of entries) {
    // Ditulis apa adanya supaya byte-identik dengan data/ - bukan di-stringify ulang.
    await writeFile(join(DIST_DIR, entry.file), entry.raw)
  }

  const manifest = {
    success: true,
    data: entries.map((entry) => ({
      year: entry.year,
      file: entry.file,
      count: entry.meta.count,
      source: entry.meta.source,
      published: entry.meta.published,
    })),
    meta: { count: entries.length, first: entries[0]?.year, last: entries.at(-1)?.year },
  }
  await writeFile(join(DIST_DIR, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`OK ${entries.length} file -> ${DIST_DIR}/`)
  for (const entry of entries) {
    console.log(`   ${entry.file}  (${entry.meta.count} hari)`)
  }
}

await main()
