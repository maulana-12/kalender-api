import { html, raw } from 'hono/html'
import type { FC, PropsWithChildren } from 'hono/jsx'

/**
 * Halaman dokumentasi untuk distribusi JSON statis (GitHub Pages).
 *
 * Sengaja BERBEDA dari `docs.tsx` yang dipakai server. Alasannya bukan sekadar
 * "dipakai di tempat berbeda", tapi dua produk dengan aturan berbeda:
 *
 * - Halaman ini statis penuh. Tidak ada server, tidak ada API key, tidak ada
 *   endpoint. Yang pembaca lakukan adalah mengunduh file.
 * - Halaman server menjelaskan request HTTP dan response error.
 * - Halaman ini menjelaskan file, formatnya, dan cara membacanya.
 *
 * Karena isinya berbeda, komponennya juga berbeda. Tidak ada usaha untuk
 * memakai ulang bagian dari `docs.tsx`: yang sama persis cuma stylesheet, dan
 * menyalin 30 baris CSS lebih baik daripada membuat file CSS terpisah yang
 * cuma dipakai dua halaman di repo ini.
 *
 * Link NAVIGASI selalu RELATIF, dengan atau tanpa `baseUrl`. Itu benar di
 * hostname mana pun dan tetap jalan kalau repo di-fork, jadi tidak ada yang perlu
 * disuntik untuk navigasi.
 *
 * `baseUrl` hanya dipakai untuk hal yang memang butuh URL absolut: canonical,
 * Open Graph, dan contoh curl/fetch yang dicopy-paste orang. Kalau tidak
 * diberikan, halaman tetap valid - bagian yang butuh absolutnya dilewati.
 */

type Props = {
  years: number[]
  totalPerYear: number
  /** Host lengkap tanpa trailing slash. Kosong berarti "tidak diketahui". */
  baseUrl?: string | undefined
}

const Section: FC<PropsWithChildren<{ id: string; title: string }>> = ({ id, title, children }) => (
  <section id={id}>
    <h2>{title}</h2>
    {children}
  </section>
)

const Code: FC<PropsWithChildren<{ lang?: string }>> = ({ lang, children }) => (
  <pre class="kode">
    <code data-lang={lang}>{children}</code>
  </pre>
)

/** Nama file JSON untuk satu tahun. Dipakai juga oleh generator. */
const fileFor = (year: number): string => `holidays-${year}.json`

/**
 * Bersihkan host dari env atau API. Trailing slash dibuang supaya penggabungan
 * tidak pernah jadi `https://host//file.json`. String kosong berarti "tidak
 * diketahui" dan itu sah, bukan error.
 */
function normalizeHost(raw?: string): string | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return undefined
  }

  const parsed = new URL(trimmed)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`baseUrl harus http(s), dapat "${parsed.protocol}"`)
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new Error('baseUrl tidak boleh berisi query atau fragment')
  }

  return trimmed.replace(/\/+$/, '')
}

const STATIC_PAGE: FC<Props> = ({ years, totalPerYear, baseUrl }) => {
  const terbaru = years[0]
  if (terbaru === undefined) {
    throw new Error('render() butuh minimal satu tahun')
  }

  // Dipakai di contoh yang dicopy-paste orang. Kalau hostname belum diketahui,
  // contoh tetap ditulis relatif supaya tidak teaches yang salah.
  const contohUrl = (file: string) => (baseUrl ? `${baseUrl}/${file}` : file)

  return (
    <>
      <style>{raw(STYLE)}</style>
      <header>
        <h1>Kalender Libur Nasional</h1>
        <p class="sub">
          Data hari libur nasional Indonesia, satu file JSON per tahun. Murni statis: tanpa
          API key, tanpa server, tanpa permintaan jaringan ke arah kita.
        </p>
        <nav>
          <a href="#mulai">Mulai cepat</a>
          <a href="#tahun">Tahun tersedia</a>
          <a href="#format">Format</a>
          <a href="#cara-pakai">Cara pakai</a>
          <a href="#bicara">Bahasa lain</a>
        </nav>
      </header>

      <main>
        <Section id="mulai" title="Mulai cepat">
          <p>
            Ambil satu file, parse JSON-nya, selesai. Tidak ada auth, tidak ada rate limit, tidak
            ada key yang perlu disimpan.
          </p>
          <Code lang="bash">{`# ${years.length} tahun tersedia: ${years.join(', ')}

curl -O ${contohUrl(fileFor(terbaru))}
cat ${fileFor(terbaru)}`}</Code>
          <p>Dari browser atau Node, tanpa install apa pun:</p>
          <Code lang="javascript">{`const res = await fetch('${contohUrl(fileFor(terbaru))}')
if (!res.ok) throw new Error(\`HTTP \${res.status}\`)

const { success, data } = await res.json()
if (!success) throw new Error(data === null ? 'gagal' : 'gagal')

console.log(\`\${data.length} hari libur\`)
for (const h of data) {
  console.log(h.date, '-', h.name)
}`}</Code>
          <p class="catatan">
            File JSON per tahun, bukan satu file gabungan. Kalau kamu butuh beberapa tahun, ambil
            masing-masing. Alasannya ada di bagian <a href="#tahun">Tahun tersedia</a>.
          </p>
        </Section>

        <Section id="tahun" title="Tahun tersedia">
          <p>
            Hanya tahun yang SKB final-nya sudah ada yang dipublikasikan. {totalPerYear} entri per
            tahun: libur nasional plus cuti bersama.
          </p>
          <table>
            <thead>
              <tr>
                <th>Tahun</th>
                <th>File</th>
                <th>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr>
                  <td>
                    <strong>{y}</strong>
                  </td>
                  <td>
                    <a href={`./${fileFor(y)}`}>
                      <code>{fileFor(y)}</code>
                    </a>
                  </td>
                  <td>{totalPerYear} entri</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Tahun yang tidak ada di daftar ini memang tidak punya data, bukan server-nya yang
            salah. Mengambil file yang tidak ada akan membalas <code>404</code>. Data yang hilang
            selalu lebih baik daripada data yang salah.
          </p>
        </Section>

        <Section id="format" title="Format file">
          <p>
            Setiap file memakai envelope yang sama dengan response API, jadi isinya valid sebagai
            JSON biasa:
          </p>
          <Code lang="json">{`{
  "success": true,
  "data": [
    {
      "date": "2026-01-01",
      "name": "Tahun Baru Masehi",
      "is_holiday": true,
      "is_joint_holiday": false
    }
  ],
  "meta": {
    "year": ${terbaru},
    "total": ${totalPerYear},
    "source": "SKB 3 Menteri"
  }
}`}</Code>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Tipe</th>
                <th>Arti</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>date</code>
                </td>
                <td>string</td>
                <td>Tanggal format <code>YYYY-MM-DD</code>, selalu sudah termasuk hitungan cuti.</td>
              </tr>
              <tr>
                <td>
                  <code>name</code>
                </td>
                <td>string</td>
                <td>Nama hari libur dalam Bahasa Indonesia, apa adanya dari SKB.</td>
              </tr>
              <tr>
                <td>
                  <code>is_holiday</code>
                </td>
                <td>boolean</td>
                <td>
                  <code>true</code> untuk hari libur nasional.
                </td>
              </tr>
              <tr>
                <td>
                  <code>is_joint_holiday</code>
                </td>
                <td>boolean</td>
                <td>
                  <code>true</code> untuk cuti bersama.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            Mengecek apakah sebuah tanggal libur, cukup bandingkan dengan <code>date</code>:
          </p>
          <Code lang="javascript">{`const hariLibur = new Set(data.map((h) => h.date))

// Weekend belum dihitung di sini. Ini data hari libur resmi, bukan kalender kerja.
const isLibur = hariLibur.has('2026-03-21')`}</Code>
        </Section>

        <Section id="cara-pakai" title="Catatan pemakaian">
          <div class="catatan">
            <p>
              Tanggal di sini adalah hasil transkripsi SKB, bukan hasil hitungan. Libur religious yang
              bergeser tiap tahun diambil dari keputusan resmi, bukan dari algoritma. Jadi kalender
              ini yang salah kalau diperbaiki dengan rumus.
            </p>
            <p>
              File tidak berubah setelah dipublikasikan, jadi aman di-cache. Tidak ada tanggal yang
              bisa berubah di tempat.
            </p>
          </div>
          <p>Kalau butuh query dinamis, filter per bulan, atau hari terdekat dari sekarang, itu jalur API-nya.</p>
        </Section>

        <Section id="bicara" title="Bahasa lain">
          <p>
           Node.js dan browser punya <code>fetch</code> bawaan, jadi tidak perlu library. Python dan
            bahasa lain bisa pakai <code>urllib</code> atau <code>requests</code> seperti biasa,
            hasilnya cuma array biasa.
          </p>
          <Code lang="python">{`import json, urllib.request

with urllib.request.urlopen("${contohUrl(fileFor(terbaru))}") as r:
    hari_libur = json.load(r)["data"]`}</Code>
        </Section>
      </main>

      <footer>
        Data transkripsi dari SKB 3 Menteri. Satu sumber kebenaran, tanpa dependency runtime.
      </footer>
    </>
  )
}

/**
 * Entry point untuk generator. Dipanggil setelah bundling, bukan oleh server.
 *
 * `head` dan `body` ditulis eksplisit, bukan diserahkan ke parser. Halaman ini
 * dibuka lewat `file://` saat dicek lokal dan lewat Pages saat online, jadi
 * strukturnya tidak boleh bergantung pada tag yang boleh dihilangkan diam-diam.
 *
 * `baseUrl` opsional dan di-normalisasi di sini: trailing slash dibuang supaya
 * penggabungannya tidak pernah menghasilkan `https://host//file.json`.
 */
export const render = (years: number[], totalPerYear: number, baseUrl?: string): string => {
  // `baseUrl` masuk ke `href` dan jadi teks di blok contoh. Nilai dari env atau
  // dari REST API bisa saja bukan URL, dan `javascript:...` akan lolos jadi
  // `href` yang bisa diklik. Dicek di sini, dekat dengan tempat pakainya, supaya
  // bisa dites tanpa subprocess dan tanpa `dist/` sudah ada.
  const host = normalizeHost(baseUrl)
  const head = [
    '<!doctype html>',
    '<html lang="id">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Kalender Libur Nasional - JSON statis</title>',
    '<meta name="description" content="Data hari libur nasional Indonesia, satu file JSON per tahun. Tanpa API key.">',
  ]

  // Hanya kalau host-nya benar-benar diketahui. Menebak hostname lebih buruk
  // daripada tidak punya canonical sama sekali.
  if (host) {
    head.push(`<link rel="canonical" href="${host}/">`)
    head.push(`<meta property="og:url" content="${host}/">`)
    head.push('<meta property="og:type" content="website">')
    head.push('<meta property="og:title" content="Kalender Libur Nasional">')
  }

  head.push('</head>', '<body>')

  return [...head, String(STATIC_PAGE({ years, totalPerYear, baseUrl: host })), '</body>', '</html>', ''].join(
    '\n'
  )
}

const STYLE = `
:root { color-scheme: light dark; --b: #1a1a1a; --d: #6b7280; --l: #e5e7eb; --a: #2563eb; --bg: #ffffff; --c: #f7f8fa; }
@media (prefers-color-scheme: dark) {
  :root { --b: #e8e8e8; --d: #9ca3af; --l: #333; --a: #7aa2f7; --bg: #16161a; --c: #1e1e24; }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0; background: var(--bg); color: var(--b);
  font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
header, main, footer { max-width: 880px; margin: 0 auto; padding: 0 20px; }
header { padding-top: 48px; padding-bottom: 8px; }
h1 { font-size: 2.1rem; margin: 0 0 8px; letter-spacing: -0.02em; }
h2 { font-size: 1.35rem; margin: 48px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--l); }
h3 { font-size: 1.05rem; margin: 28px 0 8px; }
.sub { color: var(--d); margin: 0 0 20px; }
nav { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; }
nav a { color: var(--a); text-decoration: none; font-size: 0.92rem; }
nav a:hover { text-decoration: underline; }
p { margin: 12px 0; }
a { color: var(--a); }
code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.88em; }
p code, li code, td code, .catatan code { background: var(--c); padding: 2px 5px; border-radius: 4px; }
.kode { background: var(--c); border: 1px solid var(--l); border-radius: 8px; padding: 14px 16px; overflow-x: auto; margin: 14px 0; }
.kode code { background: none; padding: 0; font-size: 0.85rem; line-height: 1.55; white-space: pre; }
table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 0.92rem; }
th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--l); vertical-align: top; }
th { font-weight: 600; color: var(--d); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
.catatan { background: var(--c); border-left: 3px solid var(--a); padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 0.93rem; }
ul { padding-left: 22px; }
li { margin: 6px 0; }
footer { margin-top: 56px; padding: 24px 20px 40px; border-top: 1px solid var(--l); color: var(--d); font-size: 0.88rem; }
`
