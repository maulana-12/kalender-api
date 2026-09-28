import { build } from 'esbuild'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Render halaman statis untuk GitHub Pages ke `dist/index.html`.
 *
 * Script TERPISAH dari `build-static.ts`, bukan gabung. Alasannya batas SRP di
 * `AGENTS.md`: `build-static.ts` tugasnya validasi lalu menyalin `data/`, dan
 * tidak boleh menyentuh Hono. Halaman ini justru Hono JSX, jadi gabung
 * berarti dua tanggung jawab dalam satu file dan `dist/` punya dua penulis.
 *
 * File JSON tetap byte-identik dengan `data/`. `index.html` tidak ikut aturan
 * itu karena bukan salinan data - dia dokumen. Yang dijaga di sini cuma satu:
 * halaman ini tidak pernah menulis ulang file JSON.
 */
const DIST_DIR = 'dist'

// Node tidak bisa transform JSX tanpa bundler (ERR_UNKNOWN_FILE_EXTENSION),
// jadi komponennya dibundle dulu ke direktori sementara, baru dieksekusi.
const tmp = await mkdtemp(join(tmpdir(), 'kalender-static-'))
const bundle = join(tmp, 'page.mjs')

try {
  await build({
    entryPoints: ['src/pages/static.tsx'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
    jsx: 'automatic',
    jsxImportSource: 'hono/jsx',
    logLevel: 'warning',
  })

  // Manifest jadi sumber daftar tahun, supaya halaman ini tidak pernah
  // menampilkan tahun yang tidak ada di `data/`.
  const manifest = JSON.parse(await readFile(join(DIST_DIR, 'index.json'), 'utf8')) as {
    data: { year: number; count: number }[]
  }

  const years = manifest.data.map((d) => d.year)
  const counts = manifest.data.map((d) => d.count)
  const total = counts[0]
  if (total === undefined) {
    throw new Error('index.json tidak memuat tahun apa pun; tidak ada yang bisa didokumentasikan')
  }
  if (new Set(counts).size > 1) {
    throw new Error(
      `jumlah entri berbeda antar tahun: ${manifest.data
        .map((d) => `${d.year}=${d.count}`)
        .join(', ')}. Halaman ini butuh satu angka untuk semua tahun.`
    )
  }

  const { render } = (await import(bundle)) as {
    render: (years: number[], total: number, baseUrl?: string) => string
  }

  // Opsional. Generator lokal tidak punya hostname, dan itu tidak masalah:
  // link navigasi relatif dan bagian yang butuh absolut dilewati. Workflow CI
  // yang menyetelnya lewat env.
  const baseUrl = process.env.PAGES_BASE_URL?.trim() || undefined

  // Validasi host-nya di dalam `render()`, bukan di sini: satu tempat, dan
  // bisa dites tanpa menjalankan generator.
  const page = render(years, total, baseUrl)

  if (!page.startsWith('<!doctype html>')) {
    throw new Error('render() tidak mengembalikan dokumen HTML yang lengkap')
  }

  if (baseUrl && !page.includes(`<link rel="canonical" href="${baseUrl}/">`)) {
    throw new Error(`baseUrl ${baseUrl} tidak masuk ke canonical; cek render()`)
  }

  await writeFile(join(DIST_DIR, 'index.html'), page, 'utf8')
  const suffix = baseUrl ? `, base ${baseUrl}` : ', tanpa base URL'
  console.log(`OK dist/index.html (${page.length} byte, ${years.length} tahun${suffix})`)
} finally {
  await rm(tmp, { recursive: true, force: true })
}
