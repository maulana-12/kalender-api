import {
  DAY_NAMES,
  MONTH_NAMES,
  dayName,
  filterByMonth,
  isDayOff,
  monthGrid,
  validateYear,
  type DayCell,
  type Holiday,
  type YearMeta,
} from '../core/index.ts'

/**
 * Skrip kalender untuk GitHub Pages.
 *
 * Data TIDAK di-import. Halaman ini hidup di hosting yang tidak menjalankan
 * Node, jadi tidak ada `dataset.ts` yang bisa dibaca, dan meng-import
 * `data/holidays-*.json` berarti setiap publish harus membangun ulang HTML-nya.
 * File JSON-nya sendiri sudah publik dari awal, jadi halaman ini membacanya
 * saat dibuka: `./index.json` untuk daftar tahun, lalu
 * `./holidays-{year}.json` untuk isinya.
 *
 * Konsekuensinya halaman ini butuh HTTP, bukan `file://`. Itu tertulis di
 * pesan kesalahannya, bukan diam-diam menampilkan grid kosong.
 *
 * Yang dipakai dari `core/`: aritmatika bulan, nama bulan dan hari, filter per
 * bulan, dan `validateYear()`. File JSON publik divalidasi dengan aturan yang
 * sama dengan `data/`, jadi file yang rusak di CDN tidak dirender seolah-olah
 * benar.
 *
 * Fungsi render-nya murni dan mengembalikan string HTML, supaya bisa dites
 * tanpa DOM. Yang menyentuh `document` cuma entry point di paling bawah.
 */

/**
 * Repo ini tidak men-set `lib: ["DOM"]` dengan sengaja: server dan browser
 * ada di satu project, dan memberi tipe DOM ke semuanya berarti `document`
 * lolos typecheck di kode yang tidak berjalan di browser. Jadi yang dipakai
 * skrip ini dideklarasikan sendiri, persis secukupnya.
 */
declare const document: {
  getElementById(id: string): { innerHTML: string; textContent: string } | null
  body: { innerHTML: string }
}
declare const window: { location: { search: string } }

const DAY_SHORT = DAY_NAMES.map((hari) => hari.slice(0, 3))
const KOSONG = '<td class="kosong"></td>'

export type YearSummary = { year: number; count: number }

export type CalendarInput = {
  year: number
  month: number | undefined
  years: number[]
  holidays: Holiday[]
  meta: YearMeta
  today: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatShort(date: string): string {
  const nama = MONTH_NAMES[Number(date.slice(5, 7)) - 1] as string
  return `${Number(date.slice(8, 10))} ${nama.slice(0, 3)}`
}

function classFor(cell: DayCell, holiday: Holiday | undefined): string {
  if (holiday?.is_holiday) return 'hari libur'
  if (holiday?.is_joint_holiday) return 'hari cuti'
  if (cell.weekday === 0 || cell.weekday === 6) return 'hari akhirpekan'
  return 'hari'
}

function dayCellHtml(cell: DayCell, holiday: Holiday | undefined, today: string): string {
  const classes = [classFor(cell, holiday)]
  if (cell.date === today) classes.push('sekarang')

  const titik = holiday === undefined ? '' : '<span class="titik"></span>'
  const title = holiday === undefined ? '' : ` title="${escapeHtml(holiday.name)}"`

  return (
    `<td class="${classes.join(' ')}" data-date="${cell.date}"` +
    ` data-type="${holiday === undefined ? 'kerja' : holiday.type}"${title}>` +
    `<span class="tgl">${cell.day}</span>${titik}</td>`
  )
}

function monthHtml(year: number, month: number, holidays: Holiday[], today: string): string {
  const byDate = new Map<string, Holiday>()
  for (const holiday of holidays) byDate.set(holiday.date, holiday)

  const nama = MONTH_NAMES[month - 1] as string
  const rincian = filterByMonth(holidays, month).filter(isDayOff)
  const cells = monthGrid(year, month)

  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells
      .slice(i, i + 7)
      .map((cell) => (cell === null ? KOSONG : dayCellHtml(cell, byDate.get(cell.date), today)))
      .join('')
    rows.push(`<tr>${week}</tr>`)
  }

  const jumlah = rincian.length === 0 ? 'tanpa libur' : `${rincian.length} tanggal`
  const kepala =
    `<header class="bulan-kepala"><h3>` +
    `<a href="./kalender.html?year=${year}&amp;month=${month}">${escapeHtml(nama)}</a>` +
    `</h3><span class="bulan-jumlah">${jumlah}</span></header>`

  const tabel =
    `<table class="kalender" aria-label="${escapeHtml(nama)} ${year}">` +
    `<thead><tr>${DAY_SHORT.map((hari) => `<th scope="col">${hari}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.join('')}</tbody></table>`

  if (rincian.length === 0) {
    return (
      `<section class="bulan" id="bulan-${String(month).padStart(2, '0')}">` +
      `${kepala}${tabel}` +
      `<p class="bulan-kosong">Tidak ada libur nasional atau cuti bersama bulan ini.</p>` +
      `</section>`
    )
  }

  const daftar = rincian
    .map((holiday) => {
      const kelas = holiday.is_holiday ? 'libur' : 'cuti'
      const tag = holiday.is_holiday ? 'Libur' : 'Cuti'
      return (
        `<li class="${kelas}">` +
        `<span class="r-meta"><span class="tag">${tag}</span>` +
        `<span class="r-tgl">${dayName(holiday.date)}, ${formatShort(holiday.date)}</span></span>` +
        `<span class="r-nama">${escapeHtml(holiday.name)}</span></li>`
      )
    })
    .join('')

  return (
    `<section class="bulan" id="bulan-${String(month).padStart(2, '0')}">` +
    `${kepala}${tabel}<ul class="rincian">${daftar}</ul></section>`
  )
}

/** Isi halaman untuk satu tahun, penuh atau satu bulan. Markup-nya sama dengan
 *  `src/pages/calendar.tsx`; class-nya datang dari `calendar-style.ts`. */
export function calendarHtml(input: CalendarInput): string {
  const { year, month, years, holidays, meta, today } = input
  const shown =
    month === undefined ? MONTH_NAMES.map((_, index) => index + 1) : [month]
  const position = years.indexOf(year)
  const sebelum = position > 0 ? years[position - 1] : undefined
  const sesudah =
    position >= 0 && position < years.length - 1 ? years[position + 1] : undefined

  const totalLibur = holidays.filter((holiday) => holiday.is_holiday).length
  const totalCuti = holidays.filter((holiday) => holiday.is_joint_holiday).length

  const tahunLinks = years
    .map(
      (option) =>
        `<a href="./kalender.html?year=${option}"` +
        `${option === year ? ' class="aktif" aria-current="page"' : ''}>${option}</a>`,
    )
    .join('')

  const geser = (sebelum === undefined
    ? '<span class="mati">Tahun sebelumnya</span>'
    : `<a href="./kalender.html?year=${sebelum}">Tahun sebelumnya: ${sebelum}</a>`
  )
    .concat('<span class="pemisah"></span>')
    .concat(
      month === undefined
        ? '<span class="teks">Setahun penuh</span>'
        : `<a href="./kalender.html?year=${year}">Tampilkan setahun penuh</a>`,
    )
    .concat('<span class="pemisah"></span>')
    .concat(
      sesudah === undefined
        ? '<span class="mati">Tahun berikutnya</span>'
        : `<a href="./kalender.html?year=${sesudah}">Tahun berikutnya: ${sesudah}</a>`,
    )

  const bulanNav =
    month === undefined
      ? `<nav class="bulan-nav" aria-label="Lompat ke bulan">` +
        MONTH_NAMES.map(
          (nama, index) =>
            `<a href="#bulan-${String(index + 1).padStart(2, '0')}">${escapeHtml(nama)}</a>`,
        ).join('') +
        `</nav>`
      : ''

  return (
    `<p class="sub">Hari libur nasional dan cuti bersama, sesuai ${escapeHtml(meta.source)}. ` +
    `Ditetapkan ${escapeHtml(meta.published)}.</p>` +
    `<ul class="statistik">` +
    `<li><strong>${totalLibur}</strong><span>Libur nasional</span></li>` +
    `<li><strong>${totalCuti}</strong><span>Cuti bersama</span></li>` +
    `<li><strong>${years.length}</strong><span>Tahun tersedia</span></li>` +
    `</ul>` +
    `<nav class="tahun-nav" aria-label="Pilih tahun">${tahunLinks}</nav>` +
    `<div class="geser">${geser}</div>` +
    bulanNav +
    `<div class="tahun">` +
    shown.map((option) => monthHtml(year, option, holidays, today)).join('') +
    `</div>` +
    `<p class="legenda">` +
    `<span class="kunci libur">Libur nasional</span>` +
    `<span class="kunci cuti">Cuti bersama</span>` +
    `<span class="kunci akhirpekan">Akhir pekan</span>` +
    `</p>`
  )
}

export function errorHtml(judul: string, detail: string, years: number[]): string {
  return (
    `<div class="gagal"><h2>${escapeHtml(judul)}</h2><p>${escapeHtml(detail)}</p>` +
    `<p>Tahun yang tersedia: <strong>${years.join(', ')}</strong></p></div>`
  )
}

export type Query = { year: number | undefined; month: number | undefined }

/**
 * Baca `?year=` dan `?month=`. Nilai yang tidak masuk akal dibuang, bukan
 * diteruskan ke renderer - `kalender.html?year=abc` harus tetap bisa
 * menampilkan tahun yang tersedia, bukan grid kosong.
 */
export function readQuery(search: string): Query {
  const params = new URLSearchParams(search)

  const year = Number(params.get('year'))
  const month = Number(params.get('month'))

  return {
    year:
      params.has('year') && Number.isInteger(year) && year >= 1900 && year <= 2999
        ? year
        : undefined,
    month:
      params.has('month') && Number.isInteger(month) && month >= 1 && month <= 12
        ? month
        : undefined,
  }
}

async function readJson(url: string, what: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url)
  } catch (cause) {
    throw new Error(
      `Gagal membuka ${url} (${what}). Halaman ini butuh file JSON-nya lewat HTTP, ` +
        `jadi jalankan lewat server statis - membuka ${url} langsung dari file:// tidak bisa. ` +
        ` Penyebab: ${String(cause)}`,
    )
  }

  if (response.status === 404) {
    throw new Error(`HTTP 404 untuk ${url} (${what})`)
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} untuk ${url} (${what})`)
  }

  return response.json()
}

function pickYear(years: number[], wanted: number | undefined, today: string): number {
  const now = Number(today.slice(0, 4))
  if (wanted === undefined) return years.includes(now) ? now : (years[years.length - 1] ?? now)
  if (!years.includes(wanted)) {
    throw new Error(
      `Data hari libur untuk tahun ${wanted} belum tersedia. ` +
        `SKB 3 Menteri untuk tahun tersebut belum terbit atau masih dalam proses, ` +
        `jadi data sengaja tidak dikirim daripada mengirim perkiraan yang bisa salah. ` +
        `Tahun yang tersedia: ${years.join(', ')}.`,
    )
  }
  return wanted
}

export type BootOptions = {
  /** Elemen yang isinya diganti seluruhnya dengan hasil render. */
  isi: { innerHTML: string }
  /** Elemen tahun di judul halaman, diisi setelah tahun diketahui. */
  tahun: { textContent: string }
  search: string
  today: string
}

/** Ambil dan render. Satu-satunya bagian yang menyentuh jaringan. */
export async function boot(options: BootOptions): Promise<void> {
  const { isi, tahun, search, today } = options

  const manifest = (await readJson('./index.json', 'daftar tahun')) as {
    data?: YearSummary[]
  }
  const entries = Array.isArray(manifest.data) ? manifest.data : []
  const years = entries
    .map((entry) => entry.year)
    .filter((year): year is number => Number.isInteger(year))

  if (years.length === 0) {
    isi.innerHTML = errorHtml(
      'index.json tidak memuat tahun apa pun',
      'Tidak ada yang bisa ditampilkan. Server statisnya kemungkinan salah.',
      [],
    )
    return
  }

  const query = readQuery(search)
  let year: number
  try {
    year = pickYear(years, query.year, today)
  } catch (cause) {
    isi.innerHTML = errorHtml('Tahun tidak tersedia', String(cause), years)
    return
  }

  tahun.textContent = String(year)

  let payload: unknown
  try {
    payload = await readJson(`./holidays-${year}.json`, 'data hari libur')
  } catch (cause) {
    isi.innerHTML = errorHtml('Data gagal diambil', String(cause), years)
    return
  }

  const errors = validateYear(year, payload)
  if (errors.length > 0) {
    isi.innerHTML = errorHtml(`holidays-${year}.json tidak valid`, errors.join('; '), years)
    return
  }

  const valid = payload as { data: Holiday[]; meta: YearMeta }
  isi.innerHTML = calendarHtml({
    year,
    month: query.month,
    years,
    holidays: valid.data,
    meta: valid.meta,
    today,
  })
}

/**
 * Entry point di browser. Dijaga `typeof document` supaya file ini bisa
 * di-import test Node tanpa efek samping - yang di-import cuma fungsi murni.
 */
if (typeof document !== 'undefined') {
  const isi = document.getElementById('isi')
  const tahun = document.getElementById('tahun')

  if (isi === null || tahun === null) {
    document.body.innerHTML =
      '<p class="gagal">kalender.html harus punya elemen #isi dan #tahun</p>'
  } else {
    boot({
      isi,
      tahun,
      search: window.location.search,
      today: new Date().toISOString().slice(0, 10),
    }).catch((cause: unknown) => {
      isi.innerHTML = errorHtml('Gagal memuat halaman', String(cause), [])
    })
  }
}
