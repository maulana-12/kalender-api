import { build } from 'esbuild'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Render `dist/kalender.html` untuk GitHub Pages.
 *
 * Script TERPISAH dari `build-static.ts` dan `build-static-page.ts`, bukan
 * digabung. Alasannya batas SRP di `AGENTS.md`: `build-static.ts` tugasnya
 * validasi lalu menyalin `data/`, dan `build-static-page.ts` menulis
 * `index.html`. File ini menulis file berbeda dengan bentuk berbeda: HTML yang
 * isinya document, bukan data.
 *
 * Dua kali bundel, dua alasan berbeda:
 *
 * 1. `src/client/static-calendar.ts` di-bundle jadi satu string JavaScript
 *    untuk di-inline ke `<script>`. No framework, no import data - halaman ini
 *    membaca file JSON publiknya sendiri saat dibuka.
 * 2. `src/pages/static-calendar.tsx` di-bundle ke modul sementara supaya Node
 *    bisa memanggil `render()`. Node tidak bisa transform JSX tanpa bundler.
 *
 * Generator ini tidak pernah membaca `data/`. Kalau nanti dia ikut meng-import
 * JSON, halaman jadi berisi tanggal yang di-bundle dan harus dibangun ulang
 * setiap publish - persis yang harus dihindari. Test yang menjaga.
 */
const DIST_DIR = 'dist'

const tmp = await mkdtemp(join(tmpdir(), 'kalender-static-cal-'))

try {
  const clientJs = join(tmp, 'client.js')
  await build({
    entryPoints: ['src/client/static-calendar.ts'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    outfile: clientJs,
    logLevel: 'warning',
  })

  const page = join(tmp, 'page.mjs')
  await build({
    entryPoints: ['src/pages/static-calendar.tsx'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: page,
    jsx: 'automatic',
    jsxImportSource: 'hono/jsx',
    logLevel: 'warning',
  })

  const { render } = (await import(page)) as {
    render: (clientJs: string, baseUrl?: string) => string
  }

  const baseUrl = process.env.PAGES_BASE_URL?.trim() || undefined
  const html = render(await readFile(clientJs, 'utf8'), baseUrl)

  if (!html.startsWith('<!doctype html>')) {
    throw new Error('render() tidak mengembalikan dokumen HTML yang lengkap')
  }

  // Guard utama halaman ini: tidak boleh ada tanggal libur yang ter-bundle.
  // Kalau nanti ada, halaman jadi stale diam-diam - dan staleness di kalender
  // lebih berbahaya daripada 404, karena orang akan menjadwalkannya.
  const leaked = html.match(/\d{4}-\d{2}-\d{2}/g)
  if (leaked !== null) {
    throw new Error(
      `kalender.html memuat tanggal (${[...new Set(leaked)].join(', ')}). ` +
        'Halaman ini harus membaca file JSON saat dibuka, bukan meng-import data.',
    )
  }

  if (baseUrl && !html.includes(`<link rel="canonical" href="${baseUrl}/kalender.html">`)) {
    throw new Error(`baseUrl ${baseUrl} tidak masuk ke canonical; cek render()`)
  }

  await writeFile(join(DIST_DIR, 'kalender.html'), html, 'utf8')
  const suffix = baseUrl ? `, base ${baseUrl}` : ', tanpa base URL'
  console.log(`OK dist/kalender.html (${html.length} byte${suffix})`)
} finally {
  await rm(tmp, { recursive: true, force: true })
}
