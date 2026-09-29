import { build } from 'esbuild'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Test harus jalan tanpa build sebelumnya: `npm test` bisa dipanggil kapan saja,
// termasuk di checkout yang bersih. `dist/index.json` dipakai hanya sebagai
// sumber tahun kalau memang ada; kalau belum, test tetap jalan dengan
// `listYears()` yang jadi sumber kebenaran utama.
const manifestEntries = async (): Promise<{ year: number; count: number; file: string }[]> => {
  if (existsSync('dist/index.json')) {
    const manifest = JSON.parse(await readFile('dist/index.json', 'utf8')) as {
      data: { year: number; count: number; file: string }[]
    }
    return manifest.data
  }
  const { listYears } = await import('../src/dataset.ts')
  return Promise.all(
    listYears().map(async (year) => {
      const file = `holidays-${year}.json`
      const raw = JSON.parse(await readFile(`data/${file}`, 'utf8')) as { meta: { count: number } }
      return { year, count: raw.meta.count, file }
    }),
  )
}

type Render = (years: { year: number; count: number }[], baseUrl?: string | undefined) => string

const BUNDLED: { render: Render } = await (async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'kalender-static-test-'))
  const out = join(tmp, 'page.mjs')
  await build({
    entryPoints: ['src/pages/static.tsx'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: out,
    jsx: 'automatic',
    jsxImportSource: 'hono/jsx',
    logLevel: 'warning',
  })
  const mod = (await import(out)) as typeof BUNDLED
  return mod
})()

// Satu tahun tetap dipakai untuk test yang cuma butuh halaman valid; isi
// daftar tahun diuji terpisah lewat ENTRIES yang dibaca dari data/ atau dist/.
const ENTRIES = await manifestEntries()
const SINGLE = [{ year: 2026, count: 25 }]
const page = BUNDLED.render(ENTRIES.map(({ year, count }) => ({ year, count })))

describe('static page untuk GitHub Pages', () => {

  it('halaman terpisah dari docs server: tidak ada endpoint dan tidak ada API key', () => {
    // Static page tidak punya server, jadi menyebut /api/ atau header auth
    // akan menyesatkan orang yang trying mengikuti.
    expect(page).not.toContain('/api/')
    expect(page).not.toContain('Authorization')
    expect(page).not.toContain('Bearer')
  })

  it('link NAVIGASI ke file JSON harus relatif, bukan absolut', () => {
    // Halaman tidak tahu di-host di domain apa. Kalau di-fork, link absolut
    // akan menunjuk ke domain yang salah. Link navigasi selalu relatif,
    // dengan atau tanpa baseUrl.
    expect(page).toContain('href="./holidays-2026.json"')
    expect(page).not.toMatch(/href="https?:\/\//)
  })

  it('tanpa baseUrl: tidak ada canonical, dan halaman tetap valid', () => {
    // Generator lokal tidak punya hostname. Halaman harus tetap jalan, bukan
    // gagal atau menebak URL.
    expect(page).not.toContain('rel="canonical"')
    expect(page).not.toContain('og:url')
    expect(page).toContain('href="./holidays-2026.json"')
  })

  it('dengan baseUrl: canonical, og:url, dan contoh absolut ikut terisi', () => {
    const withHost = BUNDLED.render(SINGLE, 'https://libur.example.co.id')

    expect(withHost).toContain('<link rel="canonical" href="https://libur.example.co.id/">')
    expect(withHost).toContain('og:url" content="https://libur.example.co.id/"')
    // Contoh yang dicopy-paste orang harus bisa langsung dipakai.
    expect(withHost).toContain('curl -O https://libur.example.co.id/holidays-2026.json')
    // Tapi navigasi tetap relatif.
    expect(withHost).toContain('href="./holidays-2026.json"')
  })

  it('baseUrl dengan trailing slash tidak menghasilkan double slash', () => {
    for (const raw of ['https://a.co.id', 'https://a.co.id/', 'https://a.co.id///']) {
      const html = BUNDLED.render(SINGLE, raw)
      expect(html).toContain('curl -O https://a.co.id/holidays-2026.json')
      expect(html).not.toContain('a.co.id//holidays')
    }
  })

  it('baseUrl kosong berarti tidak diketahui, bukan host kosong', () => {
    const html = BUNDLED.render(SINGLE, '')
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('https://')
  })

  it('tahun yang dirender harus benar-benar ada di data', () => {
    expect(ENTRIES.length).toBeGreaterThan(0)
    for (const entry of ENTRIES) {
      expect(page).toContain(entry.file)
      expect(page).toContain(String(entry.year))
    }
  })

  it('jumlah entri tiap tahun ditampilkan per tahun, bukan satu angka untuk semua', () => {
    // 2026 punya 25 entri, 2027 punya 26. Halaman harus menampilkan angka
    // masing-masing, bukan menyeragamkan ke salah satunya.
    for (const entry of ENTRIES) {
      expect(page).toContain(`${entry.count} entri`)
    }
  })

  it('tahun yang tidak dipublikasikan tidak boleh muncul sebagai link', () => {
    for (const year of [2024, 2025, 2030]) {
      expect(page).not.toContain(`holidays-${year}.json`)
    }
  })

  it('contoh jq menyebut field yang benar-benar ada di data', async () => {
    // Contoh jq yang menyebut field tidak ada akan jalan tanpa error dan
    // mencetak `null` - pembaca mengira datanya kosong, bukan contohnya yang
    // salah. Jadi tiap path dikunci ke file aslinya.
    expect(page).toContain('| jq')
    expect(page).toContain('.meta.count')
    expect(page).toContain('.meta.source')
    expect(page).toContain('is_joint_holiday')
    expect(page).toContain('is_holiday')

    for (const entry of ENTRIES) {
      const raw = JSON.parse(
        await readFile(`data/${entry.file}`, 'utf8'),
      ) as { data: Record<string, unknown>[]; meta: Record<string, unknown> }
      for (const field of ['date', 'name', 'is_holiday', 'is_joint_holiday']) {
        expect(raw.data[0]).toHaveProperty(field)
      }
      expect(raw.meta).toHaveProperty('count')
      expect(raw.meta).toHaveProperty('source')
    }
  })

  it('dokumen HTML-nya lengkap: doctype, head, title, body', () => {
    expect(page.startsWith('<!doctype html>')).toBe(true)
    expect(page).toContain('<html lang="id">')
    expect(page).toContain('<meta charset="utf-8">')
    expect(page).toContain('<title>')
    expect(page.trimEnd().endsWith('</html>')).toBe(true)
  })

  it('tidak ada sel kosong atau undefined yang bocor ke HTML', () => {
    // Symptom komponen yang salah baca field: render sukses, isi kosong.
    expect(page).not.toContain('<td></td>')
    expect(page).not.toContain('undefined')
    expect(page).not.toContain('NaN')
  })

  it('navigasi internal punya target yang benar-benar ada', () => {
    const targets = [...page.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1] ?? '')
    expect(targets.length).toBeGreaterThan(0)
    for (const id of targets) {
      expect(page).toContain(`id="${id}"`)
    }
  })

  it('baseUrl bukan http(s) harus ditolak, bukan lolos jadi href', () => {
    // `baseUrl` masuk ke `href` dan jadi teks di blok contoh. Nilai rusak dari
    // env atau dari REST API tidak boleh lolos diam-diam.
    for (const bad of ['javascript:alert(1)', 'ftp://x.co.id', 'data:text/html,x']) {
      expect(() => BUNDLED.render(SINGLE, bad)).toThrow()
    }
    expect(() => BUNDLED.render(SINGLE, 'https://ok.co.id?a=1')).toThrow()
    expect(() => BUNDLED.render(SINGLE, 'https://ok.co.id#x')).toThrow()
  })

  it('render() tidak butuh dist/ atau subprocess', () => {
    // Guard: kalau suatu saat validasi pindah lagi ke luar `render()`, test ini
    // yang memastikan pemanggilnya tidak diam-diam bergantung pada file.
    // Sengaja tidak mengecek keberadaan `dist/`: `npm test` sah dijalankan
    // sebelum ATAU sesudah build, jadi state direktori bukan input yang boleh
    // dipakai assertion.
    expect(BUNDLED.render(SINGLE)).toContain('<!doctype html>')
    expect(BUNDLED.render(SINGLE, 'https://a.co.id')).toContain('<!doctype html>')
  })

  it('menolak tahun kosong, bukan diam-diam menghasilkan halaman kosong', () => {
    expect(() => BUNDLED.render([])).toThrow(/minimal satu tahun/)
  })
})
