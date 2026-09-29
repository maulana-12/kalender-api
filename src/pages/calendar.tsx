import type { FC } from 'hono/jsx'
import type { DayCell, Holiday, YearMeta } from '../core/index.ts'
import {
  DAY_NAMES,
  MONTH_NAMES,
  dayName,
  filterByMonth,
  isDayOff,
  monthGrid,
} from '../core/index.ts'
import { CALENDAR_STYLE } from './calendar-style.ts'

/**
 * Halaman kalender. Sama seperti `docs.tsx`: stateless, tidak tahu routing,
 * auth, maupun filesystem. Semua data masuk lewat props.
 *
 * Halaman ini sengaja dirender di server dari `dataset.ts` - bukan memanggil
 * `/api/*` dari browser. Jadi bisa dibuka tanpa API key, tanpa CORS, dan tetap
 * jalan di Cloudflare Worker.
 *
 * Versinya untuk GitHub Pages ada di `static-calendar.tsx`: markup dan
 * stylesheet-nya sama, tapi data diambil dari file JSON publik saat halaman
 * dibuka, bukan di-bundle. Aritmatika bulan dan nama bulan tidak diulang di
 * sana, dua-duanya pakai `core/`.
 */

const DAY_SHORT = DAY_NAMES.map((hari) => hari.slice(0, 3))

function formatShort(date: string): string {
  const nama = MONTH_NAMES[Number(date.slice(5, 7)) - 1] as string
  return `${Number(date.slice(8, 10))} ${nama.slice(0, 3)}`
}

type Cell = DayCell & { holiday: Holiday | undefined }

function withHolidays(year: number, month: number, byDate: Map<string, Holiday>): (Cell | null)[] {
  return monthGrid(year, month).map((cell) =>
    cell === null ? null : { ...cell, holiday: byDate.get(cell.date) },
  )
}

function weeks(cells: (Cell | null)[]): (Cell | null)[][] {
  const rows: (Cell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

function classFor(cell: Cell): string {
  if (cell.holiday?.is_holiday) return 'hari libur'
  if (cell.holiday?.is_joint_holiday) return 'hari cuti'
  if (cell.weekday === 0 || cell.weekday === 6) return 'hari akhirpekan'
  return 'hari'
}

const DayCellView: FC<{ cell: Cell; today: string }> = ({ cell, today }) => {
  const holiday = cell.holiday
  const classes = [classFor(cell)]
  if (cell.date === today) classes.push('sekarang')

  return (
    <td
      class={classes.join(' ')}
      data-date={cell.date}
      data-type={holiday ? holiday.type : 'kerja'}
      title={holiday ? holiday.name : ''}
    >
      <span class="tgl">{cell.day}</span>
      {holiday ? <span class="titik" /> : null}
    </td>
  )
}

const MonthGrid: FC<{
  year: number
  month: number
  holidays: Holiday[]
  byDate: Map<string, Holiday>
  today: string
}> = ({ year, month, holidays, byDate, today }) => {
  const nama = MONTH_NAMES[month - 1] as string
  const cells = withHolidays(year, month, byDate)
  const rincian = filterByMonth(holidays, month).filter(isDayOff)

  return (
    <section class="bulan" id={`bulan-${String(month).padStart(2, '0')}`}>
      <header class="bulan-kepala">
        <h3>
          <a href={`/kalender?year=${year}&month=${month}`}>{nama}</a>
        </h3>
        <span class="bulan-jumlah">
          {rincian.length === 0 ? 'tanpa libur' : `${rincian.length} tanggal`}
        </span>
      </header>

      <table class="kalender" aria-label={`${nama} ${year}`}>
        <thead>
          <tr>
            {DAY_SHORT.map((hari) => (
              <th scope="col">{hari}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks(cells).map((week) => (
            <tr>
              {week.map((cell) =>
                cell === null ? <td class="kosong" /> : <DayCellView cell={cell} today={today} />,
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {rincian.length === 0 ? (
        <p class="bulan-kosong">Tidak ada libur nasional atau cuti bersama bulan ini.</p>
      ) : (
        <ul class="rincian">
          {rincian.map((holiday) => (
            <li class={holiday.is_holiday ? 'libur' : 'cuti'}>
              <span class="r-meta">
                <span class="tag">{holiday.is_holiday ? 'Libur' : 'Cuti'}</span>
                <span class="r-tgl">
                  {dayName(holiday.date)}, {formatShort(holiday.date)}
                </span>
              </span>
              <span class="r-nama">{holiday.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export type CalendarProps = {
  year: number
  meta: YearMeta
  holidays: Holiday[]
  years: number[]
  today: string
  month?: number | undefined
}

export const CalendarPage: FC<CalendarProps> = ({ year, meta, holidays, years, today, month }) => {
  const byDate = new Map<string, Holiday>()
  for (const holiday of holidays) byDate.set(holiday.date, holiday)

  const shown = month === undefined ? MONTH_NAMES.map((_, index) => index + 1) : [month]
  const position = years.indexOf(year)
  const sebelum = position > 0 ? years[position - 1] : undefined
  const sesudah = position >= 0 && position < years.length - 1 ? years[position + 1] : undefined
  const totalLibur = holidays.filter((holiday) => holiday.is_holiday).length
  const totalCuti = holidays.filter((holiday) => holiday.is_joint_holiday).length

  return (
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Kalender {year} - Kalender API</title>
        <meta
          name="description"
          content={`Kalender hari libur nasional dan cuti bersama Indonesia tahun ${year}.`}
        />
        <style>{CALENDAR_STYLE}</style>
      </head>
      <body>
        <header class="top">
          <div class="top-judul">
            <div>
              <p class="eyebrow">Kalender API</p>
              <h1>
                Kalender <span class="angka">{year}</span>
              </h1>
            </div>
            <a class="tautan-docs" href="/">
              Dokumentasi API
            </a>
          </div>

          <p class="sub">
            Hari libur nasional dan cuti bersama, sesuai {meta.source}. Ditetapkan{' '}
            {meta.published}.
          </p>

          <ul class="statistik">
            <li>
              <strong>{totalLibur}</strong>
              <span>Libur nasional</span>
            </li>
            <li>
              <strong>{totalCuti}</strong>
              <span>Cuti bersama</span>
            </li>
            <li>
              <strong>{years.length}</strong>
              <span>Tahun tersedia</span>
            </li>
          </ul>

          <nav class="tahun-nav" aria-label="Pilih tahun">
            {years.map((option) => (
              <a
                href={`/kalender?year=${option}`}
                class={option === year ? 'aktif' : ''}
                aria-current={option === year ? 'page' : undefined}
              >
                {option}
              </a>
            ))}
          </nav>

          <div class="geser">
            {sebelum === undefined ? (
              <span class="mati">Tahun sebelumnya</span>
            ) : (
              <a href={`/kalender?year=${sebelum}`}>Tahun sebelumnya: {sebelum}</a>
            )}
            <span class="pemisah" />
            {month === undefined ? (
              <span class="teks">Setahun penuh</span>
            ) : (
              <a href={`/kalender?year=${year}`}>Tampilkan setahun penuh</a>
            )}
            <span class="pemisah" />
            {sesudah === undefined ? (
              <span class="mati">Tahun berikutnya</span>
            ) : (
              <a href={`/kalender?year=${sesudah}`}>Tahun berikutnya: {sesudah}</a>
            )}
          </div>

          {month === undefined ? (
            <nav class="bulan-nav" aria-label="Lompat ke bulan">
              {MONTH_NAMES.map((nama, index) => (
                <a href={`#bulan-${String(index + 1).padStart(2, '0')}`}>{nama}</a>
              ))}
            </nav>
          ) : null}
        </header>

        <main>
          <div class="tahun">
            {shown.map((option) => (
              <MonthGrid
                year={year}
                month={option}
                holidays={holidays}
                byDate={byDate}
                today={today}
              />
            ))}
          </div>

          <p class="legenda">
            <span class="kunci libur">Libur nasional</span>
            <span class="kunci cuti">Cuti bersama</span>
            <span class="kunci akhirpekan">Akhir pekan</span>
          </p>
        </main>

        <footer>
          <p>
            Sumber: {meta.source}. Total {meta.count} entri untuk tahun {year}.
          </p>
          <p>MIT (c) 2026 Maulana Muhammad Rifqi</p>
        </footer>
      </body>
    </html>
  )
}
