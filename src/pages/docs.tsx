import type { FC, PropsWithChildren } from 'hono/jsx'

/**
 * Halaman dokumentasi. Bukan `app.ts` dan bukan `core/`.
 *
 *-module ini stateless dan tidak tahu apa pun soal routing, auth, atau
 * filesystem. Dia hanya menerima data lewat props dan mengembalikan HTML.
 * Itu yang membuatnya bisa dites tanpa server.
 *
 * Catatan kenapa JSX dan bukan `hono/html`: lihat `.knowlages/decision-log.md`
 * D-014. `hono/html` sebenarnya bisa menulis halaman tanpa build step sama
 * sekali, tapi ditulis sebagai template literal dan jadi jauh lebih sulit
 * dirawat kalau halamannya panjang.
 */

const NAV = [
  { href: '#mulai', label: 'Mulai cepat' },
  { href: '#endpoint', label: 'Endpoint' },
  { href: '#contoh', label: 'Contoh' },
  { href: '#error', label: 'Kode error' },
  { href: '#statis', label: 'JSON statis' },
] as const

const ENDPOINTS = [
  {
    path: 'GET /health',
    auth: false,
    desc: 'Cek apakah service hidup. Dipakai uptime monitor, tidak butuh API key.',
  },
  {
    path: 'GET /api/years',
    auth: false,
    desc: 'Daftar tahun yang datanya sudah tersedia, lengkap dengan jumlah hari dan sumber SKB-nya.',
  },
  {
    path: 'GET /api/holidays',
    auth: true,
    desc: 'Daftar hari libur satu tahun, atau satu bulan kalau parameter month diisi.',
  },
  {
    path: 'GET /api/check',
    auth: true,
    desc: 'Cek satu tanggal: apakah libur, cuti bersama, akhir pekan, atau hari kerja.',
  },
  {
    path: 'GET /api/upcoming',
    auth: true,
    desc: 'Libur terdekat dari suatu tanggal.',
  },
] as const

const PARAMETERS = [
  { name: 'year', endpoint: '/api/holidays', desc: 'Tahun empat digit. Wajib.' },
  { name: 'month', endpoint: '/api/holidays', desc: 'Bulan 1-12. Opsional.' },
  { name: 'date', endpoint: '/api/check', desc: 'Tanggal format YYYY-MM-DD. Wajib.' },
  { name: 'from', endpoint: '/api/upcoming', desc: 'Tanggal mulai, inklusif. Default hari ini.' },
  { name: 'limit', endpoint: '/api/upcoming', desc: 'Jumlah hasil, 1-50. Default 5.' },
] as const

type ErrorRow = { code: string; when: string; contoh: string }

const ERRORS: ErrorRow[] = [
  { code: '400', when: 'Parameter tidak valid', contoh: 'year=abc, date=2026-02-30, limit=999' },
  { code: '401', when: 'API key salah atau tidak dikirim', contoh: 'Header Authorization hilang' },
  { code: '404', when: 'Tahun itu belum ada datanya', contoh: 'year=2024' },
  { code: '500', when: 'Server salah konfigurasi', contoh: 'API_KEY belum di-set' },
]

const Code: FC<PropsWithChildren<{ lang?: string }>> = ({ children }) => (
  <pre class="kode">
    <code>{children}</code>
  </pre>
)

const Section: FC<PropsWithChildren<{ id: string; title: string }>> = ({
  id,
  title,
  children,
}) => (
  <section id={id}>
    <h2>{title}</h2>
    {children}
  </section>
)

const Param: FC<{ name: string; endpoint: string; desc: string }> = ({ name, endpoint, desc }) => (
  <tr>
    <td>
      <code>{name}</code>
    </td>
    <td>
      <code>{endpoint}</code>
    </td>
    <td>{desc}</td>
  </tr>
)

const AuthBadge: FC<{ auth: boolean }> = ({ auth }) =>
  auth ? <span class="badge ya">butuh key</span> : <span class="badge">terbuka</span>

export const DocsPage: FC<{ years: number[]; origin: string }> = ({ years, origin }) => (
  <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Kalender API - Dokumentasi</title>
      <meta
        name="description"
        content="API kalender nasional Indonesia: hari libur nasional dan cuti bersama dari SKB 3 Menteri."
      />
      <style>{STYLE}</style>
    </head>
    <body>
      <header>
        <h1>Kalender API</h1>
        <p class="sub">
          Hari libur nasional dan cuti bersama Indonesia, sesuai SKB 3 Menteri. Tanpa
          menghitung sendiri, tanpa tabel hard-code per tahun.
        </p>
        <nav>
          {NAV.map((item) => (
            <a href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>

      <main>
        <Section id="mulai" title="Mulai cepat">
          <p>
            Endpoint yang diawali <code>/api/</code> butuh API key, kecuali <code>/api/years</code> dan{' '}
            <code>/health</code>. Kirim key lewat header <code>Authorization</code> dengan awalan{' '}
            <code>Bearer</code>:
          </p>
          <Code>{`curl -s -H "Authorization: Bearer $API_KEY" \\\n  "${origin}/api/holidays?year=2026" | jq`}</Code>

          <p>
            Belum punya key? Yang Jalur JSON statis tidak butuh key sama sekali. Kalau kamu cuma
            butuh daftar libur, ambil saja file JSON-nya langsung - gratis, tanpa rate limit, dan
            tidak bisa tiba-tiba mati.:
          </p>
          <Code>{`curl -s "${origin}/holidays-2026.json" | jq`}</Code>

          <p class="catatan">
           -years tersedia saat ini: <strong>{years.join(', ')}</strong>. Tahun yang tidak ada di
            daftar ini memang belum punya data - baca bagian <a href="#error">kode error</a>.
          </p>
        </Section>

        <Section id="endpoint" title="Endpoint">
          <table>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Auth</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((row) => (
                <tr>
                  <td>
                    <code>{row.path}</code>
                  </td>
                  <td>
                    <AuthBadge auth={row.auth} />
                  </td>
                  <td>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Parameter</h3>
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Endpoint</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {PARAMETERS.map((row) => (
                <Param name={row.name} endpoint={row.endpoint} desc={row.desc} />
              ))}
            </tbody>
          </table>

          <h3>Field setiap hari libur</h3>
          <Code>
            {`{
  "date": "2026-08-17",
  "name": "Proklamasi Kemerdekaan Republik Indonesia",
  "type": "holiday",
  "is_holiday": true,
  "is_joint_holiday": false
}`}
          </Code>
          <p>
            <code>type</code> bernilai <code>holiday</code> (libur nasional), <code>leave</code>{' '}
            (cuti bersama), atau <code>observance</code> (peringatan nasional, bukan hari libur).
            Dua boolean itu tidak pernah <code>true</code> bersamaan, jadi cek hari bebas kerja
            cukup satu baris: <code>is_holiday || is_joint_holiday</code>.
          </p>
        </Section>

        <Section id="contoh" title="Contoh">
          <h3>Cek satu tanggal</h3>
          <Code>{`curl -s -H "Authorization: Bearer $API_KEY" \\\n  "${origin}/api/check?date=2026-08-17" | jq`}</Code>
          <p>Hasilnya:</p>
          <Code>
            {`{
  "success": true,
  "data": {
    "date": "2026-08-17",
    "day": "Senin",
    "is_weekend": false,
    "is_holiday": true,
    "is_joint_holiday": false,
    "is_day_off": true,
    "holidays": [ ... ]
  },
  "meta": { "year": 2026 }
}`}
          </Code>

          <h3>Libur bulan tertentu</h3>
          <Code>{`curl -s -H "Authorization: Bearer $API_KEY" \\\n  "${origin}/api/holidays?year=2026&month=8" | jq`}</Code>

          <h3>Libur yang akan datang</h3>
          <Code>{`curl -s -H "Authorization: Bearer $API_KEY" \\\n  "${origin}/api/upcoming?limit=3" | jq`}</Code>
          <p>
            Pakai dalam JavaScript:
          </p>
          <Code>{`const res = await fetch("${origin}/api/check?date=2026-08-17", {
  headers: { Authorization: \`Bearer \${process.env.API_KEY}\` }
})
const { data } = await res.json()

if (data.is_day_off) {
  console.log(data.date, data.day, '-', data.holidays.map((h) => h.name).join(', '))
}`}</Code>
        </Section>

        <Section id="error" title="Kode error">
          <p>
            Respons gagal selalu punya <code>success: false</code> dan <code>error.message</code>{" "}
            yang menyebut penyebabnya - bukan array kosong yang terlihat valid.
          </p>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Ketika</th>
                <th>Contoh</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map((row) => (
                <tr>
                  <td>
                    <code>{row.code}</code>
                  </td>
                  <td>{row.when}</td>
                  <td>
                    <code>{row.contoh}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="catatan">
            Kalau minta tahun yang datanya belum ada, jawabannya <code>404</code> yang menyebut
            tahun yang diminta dan tahun yang tersedia. <code>404</code> berarti "tahun ini belum
            ada datanya" - beda maknanya dari array kosong, yang artinya "tahun ini memang tanpa
            libur".
          </p>
        </Section>

        <Section id="statis" title="JSON statis tanpa API key">
          <p>
            Untuk klien web, mobile, atau apa pun yang tidak mau menyimpan key, ambil file-nya
            langsung:
          </p>
          <ul>
            <li>
              <code>{origin}/holidays-2026.json</code>
            </li>
            <li>
              <code>{origin}/index.json</code> - manifest daftar tahun yang tersedia
            </li>
          </ul>
          <p>
            Satu file per tahun, dan isinya identik dengan response <code>/api/holidays</code> untuk
            tahun yang sama. Tidak ada file gabungan semua tahun, jadi kalau satu tahun belum ada,
            hasilnya <code>404</code> - bukan data yang hilang diam-diam.
          </p>
        </Section>
      </main>

      <footer>
        <p>
          Data ditulis tangan dari SKB Menteri Agama, Ketenagakerjaan, dan PANRB. Kalau kamu punya
          SKB untuk tahun yang belum ada di sini, kirim PR - sertakan nomor SKB dan tanggal
          verifikasinya.
        </p>
        <p>MIT (c) 2026 Maulana Muhammad Rifqi</p>
      </footer>
    </body>
  </html>
)

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
.badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; background: var(--c); color: var(--d); border: 1px solid var(--l); white-space: nowrap; }
.badge.ya { color: #92400e; border-color: #fcd34d; }
@media (prefers-color-scheme: dark) { .badge.ya { color: #fcd34d; } }
.catatan { background: var(--c); border-left: 3px solid var(--a); padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 0.93rem; }
ul { padding-left: 22px; }
li { margin: 6px 0; }
footer { margin-top: 56px; padding: 24px 20px 40px; border-top: 1px solid var(--l); color: var(--d); font-size: 0.88rem; }
`
