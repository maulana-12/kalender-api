import { html, raw } from 'hono/html'
import { CALENDAR_STYLE } from './calendar-style.ts'

/**
 * Shell halaman kalender untuk GitHub Pages, jadi `dist/kalender.html`.
 *
 * Bedanya dengan `calendar.tsx` (versi server) bukan di tampilan, tapi di
 * sumber datanya: halaman ini tidak boleh meng-import `data/`. GitHub Pages
 * hanya menyajikan file, dan data JSON-nya sudah publik, jadi skrip di dalam
 * halaman membacanya saat dibuka. Konsekuensinya file HTML yang dikirim tidak
 * berisi satu pun tanggal - begitu `data/` berubah, halamannya ikut berubah
 * tanpa di-build ulang.
 *
 * Karena itu `render()` menerima script-nya dari luar. Generator membundle
 * `src/client/static-calendar.ts` lalu menitipkan hasilnya ke sini. Script-nya
 * ditulis inline, bukan file terpisah, supaya `dist/` tetap bisa dipakai apa
 * adanya tanpa path tambahan dan tanpa permintaan kedua.
 *
 * Semua link RELATIF, sama seperti `static.tsx`: benar di hostname mana pun
 * dan tetap jalan kalau repo di-fork.
 */

function normalizeHost(value?: string): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  const parsed = new URL(trimmed)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`baseUrl harus http(s), dapat "${parsed.protocol}"`)
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new Error('baseUrl tidak boleh berisi query atau fragment')
  }

  return trimmed.replace(/\/+$/, '')
}

export const render = (clientJs: string, baseUrl?: string): string => {
  // Penutup tag script di dalam string akan memotong halaman lebih dulu, jadi
  // script yang sudah di-bundle tidak boleh mengandungnya. Dicek di sini, dekat
  // dengan tempat dipakainya, supaya generator tidak diam-diam menghasilkan file
  // yang rusak tanpa ada yang tahu.
  if (clientJs.includes('</script')) {
    throw new Error('clientJs tidak boleh mengandung "</script"')
  }
  if (clientJs.trim() === '') {
    throw new Error('clientJs kosong; kalender.html tidak akan bisa menampilkan apa pun')
  }

  const host = normalizeHost(baseUrl)
  const canonical =
    host === undefined ? '' : `<link rel="canonical" href="${host}/kalender.html">`

  return [
    '<!doctype html>',
    '<html lang="id">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Kalender Libur Nasional - kalender</title>',
    '<meta name="description" content="Kalender hari libur nasional dan cuti bersama Indonesia, dibaca langsung dari file JSON publik.">',
    canonical,
    `<style>${raw(CALENDAR_STYLE)}</style>`,
    '</head>',
    '<body>',
    '<div class="top">',
    '<div class="top-judul">',
    '<div>',
    '<p class="eyebrow">Kalender API</p>',
    '<h1>Kalender <span class="angka" id="tahun">-</span></h1>',
    '</div>',
    '<a class="tautan-docs" href="./">Dokumentasi</a>',
    '</div>',
    '<main id="isi"><p class="memuat">Memuat data...</p></main>',
    '<noscript>',
    '<p class="gagal">Halaman ini butuh JavaScript untuk membaca file JSON-nya. ' +
      'Tanpa JavaScript, ambil datanya langsung dari ' +
      '<a href="./index.json">index.json</a>, lalu file ' +
      '<code>holidays-&lt;tahun&gt;.json</code> di folder yang sama.</p>',
    '</noscript>',
    '</div>',
    '<footer>',
    '<p>Data transkripsi dari SKB 3 Menteri, dibaca dari file JSON yang sama persis dengan yang dipakai API. ' +
      'Satu sumber kebenaran, tanpa dependency runtime.</p>',
    '</footer>',
    `<script>${raw(clientJs)}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}
