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
const manifestYears = async (): Promise<{ year: number; file: string }[]> => {
  if (!existsSync('dist/index.json')) {
    const { listYears } = await import('../src/dataset.ts')
    return listYears().map((year) => ({ year, file: `holidays-${year}.json` }))
  }
  const manifest = JSON.parse(await readFile('dist/index.json', 'utf8')) as {
    data: { year: number; file: string }[]
  }
  return manifest.data
}

type Render = (years: number[], total: number, baseUrl?: string | undefined) => string

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

describe('static page untuk GitHub Pages', () => {
  const page = BUNDLED.render([2026], 25)

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
    const withHost = BUNDLED.render([2026], 25, 'https://libur.example.co.id')

    expect(withHost).toContain('<link rel="canonical" href="https://libur.example.co.id/">')
    expect(withHost).toContain('og:url" content="https://libur.example.co.id/"')
    // Contoh yang dicopy-paste orang harus bisa langsung dipakai.
    expect(withHost).toContain('curl -O https://libur.example.co.id/holidays-2026.json')
    // Tapi navigasi tetap relatif.
    expect(withHost).toContain('href="./holidays-2026.json"')
  })

  it('baseUrl dengan trailing slash tidak menghasilkan double slash', () => {
    for (const raw of ['https://a.co.id', 'https://a.co.id/', 'https://a.co.id///']) {
      const html = BUNDLED.render([2026], 25, raw)
      expect(html).toContain('curl -O https://a.co.id/holidays-2026.json')
      expect(html).not.toContain('a.co.id//holidays')
    }
  })

  it('baseUrl kosong berarti tidak diketahui, bukan host kosong', () => {
    const html = BUNDLED.render([2026], 25, '')
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('https://')
  })

  it('tahun yang dirender harus benar-benar ada di data', async () => {
    const years = await manifestYears()
    expect(years.length).toBeGreaterThan(0)
    for (const entry of years) {
      expect(page).toContain(entry.file)
      expect(page).toContain(String(entry.year))
    }
  })

  it('tahun yang tidak dipublikasikan tidak boleh muncul sebagai link', () => {
    for (const year of [2024, 2025, 2030]) {
      expect(page).not.toContain(`holidays-${year}.json`)
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
      expect(() => BUNDLED.render([2026], 25, bad)).toThrow()
    }
    expect(() => BUNDLED.render([2026], 25, 'https://ok.co.id?a=1')).toThrow()
    expect(() => BUNDLED.render([2026], 25, 'https://ok.co.id#x')).toThrow()
  })

  it('render() tidak butuh dist/ atau subprocess', () => {
    // Guard: kalau suatu saat validasi pindah lagi ke luar `render()`, test ini
    // yang memastikan pemanggilnya tidak diam-diam bergantung pada file.
    // Sengaja tidak mengecek keberadaan `dist/`: `npm test` sah dijalankan
    // sebelum ATAU sesudah build, jadi state direktori bukan input yang boleh
    // dipakai assertion.
    expect(BUNDLED.render([2026], 25)).toContain('<!doctype html>')
    expect(BUNDLED.render([2026], 25, 'https://a.co.id')).toContain('<!doctype html>')
  })

  it('menolak tahun kosong, bukan diam-diam menghasilkan halaman kosong', () => {
    expect(() => BUNDLED.render([], 25)).toThrow(/minimal satu tahun/)
  })
})
