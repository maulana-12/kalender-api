/**
 * Stylesheet untuk halaman kalender, dipakai oleh dua halaman: yang dirender
 * server (`src/pages/calendar.tsx`) dan yang statis di GitHub Pages
 * (`src/pages/static-calendar.tsx`).
 *
 * Dua halaman, satu konstanta. Ini bukan abstraksi: cuma memindahkan string
 * yang sama supaya tidak punya dua salinan yang bisa berbeda diam-diam. Nama
 * class-nya jadi kontrak bersama dengan markup - kalau berubah di sini, dua
 * pemanggil harus ikut berubah. Test parity di
 * `test/static-calendar.test.ts` yang menjaga itu.
 */
export const CALENDAR_STYLE = `
:root {
  color-scheme: light dark;
  --b: #14161a; --d: #6b7280; --l: #e5e7eb; --a: #2563eb; --bg: #f6f7f9;
  --card: #ffffff; --c: #f1f2f5;
  --libur: #fee2e2; --libur-t: #b91c1c;
  --cuti: #fef3c7; --cuti-t: #b45309;
}
@media (prefers-color-scheme: dark) {
  :root {
    --b: #e8e8e8; --d: #9ca3af; --l: #333; --a: #7aa2f7; --bg: #121216;
    --card: #1c1c22; --c: #26262e;
    --libur: #3f1d1d; --libur-t: #fca5a5;
    --cuti: #3d2f10; --cuti-t: #fcd34d;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0; background: var(--bg); color: var(--b);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.top, main, footer { width: 100%; padding-inline: clamp(16px, 3vw, 48px); }
.top { padding-top: 40px; }
.top-judul { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; justify-content: space-between; }
.eyebrow { margin: 0; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--a); }
h1 { font-size: clamp(1.7rem, 3vw, 2.4rem); margin: 2px 0 0; letter-spacing: -0.02em; }
h1 .angka { color: var(--a); }
h3 { font-size: 1rem; margin: 0; }
h3 a { color: var(--b); text-decoration: none; }
h3 a:hover { color: var(--a); text-decoration: underline; }
.sub { color: var(--d); margin: 14px 0 0; max-width: 70ch; }
a { color: var(--a); }
.tautan-docs {
  text-decoration: none; font-size: 0.9rem; font-weight: 600;
  border: 1px solid var(--l); background: var(--card);
  padding: 8px 16px; border-radius: 999px; white-space: nowrap;
}
.tautan-docs:hover { border-color: var(--a); text-decoration: none; }
.statistik {
  list-style: none; display: flex; flex-wrap: wrap; gap: 12px;
  margin: 22px 0 0; padding: 0;
}
.statistik li {
  background: var(--card); border: 1px solid var(--l); border-radius: 12px;
  padding: 10px 18px; display: flex; flex-direction: column; min-width: 130px;
}
.statistik strong { font-size: 1.5rem; font-variant-numeric: tabular-nums; line-height: 1.2; }
.statistik span { font-size: 0.76rem; color: var(--d); }
nav { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 22px 0 0; }
nav a { color: var(--a); text-decoration: none; font-size: 0.9rem; }
nav a:hover { text-decoration: underline; }
.tahun-nav a {
  padding: 5px 14px; border-radius: 999px; border: 1px solid var(--l);
  background: var(--card); font-variant-numeric: tabular-nums;
}
.tahun-nav a.aktif { background: var(--a); border-color: var(--a); color: #fff; font-weight: 700; }
@media (prefers-color-scheme: dark) { .tahun-nav a.aktif { color: #0b1220; } }
.geser {
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
  margin: 16px 0 0; font-size: 0.9rem;
}
.geser .mati { color: var(--d); opacity: 0.45; }
.geser .teks { color: var(--d); }
.geser .pemisah { width: 1px; height: 16px; background: var(--l); }
.bulan-nav { margin: 14px 0 0; gap: 6px; font-size: 0.82rem; }
.bulan-nav a { padding: 3px 8px; border-radius: 6px; }
.bulan-nav a:hover { background: var(--card); text-decoration: none; }
main { padding-top: 4px; padding-bottom: 24px; }
.tahun {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 20px; margin-top: 26px;
}
.bulan {
  background: var(--card); border: 1px solid var(--l); border-radius: 16px;
  padding: 16px 18px 18px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex; flex-direction: column;
}
.bulan-kepala {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 10px; margin-bottom: 12px;
}
.bulan-jumlah { font-size: 0.72rem; color: var(--d); white-space: nowrap; }
.kalender { width: 100%; border-collapse: separate; border-spacing: 3px; table-layout: fixed; }
.kalender th {
  font-size: 0.68rem; color: var(--d); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; padding: 0 0 4px; text-align: center;
}
.kalender td {
  vertical-align: top; height: 46px; padding: 5px 2px 3px; font-size: 0.85rem;
  text-align: center; border-radius: 8px; font-variant-numeric: tabular-nums;
  background: var(--card); border: 1px solid var(--l);
}
.hari .tgl { display: block; }
.hari .titik {
  display: block; width: 5px; height: 5px; border-radius: 50%;
  margin: 2px auto 0; background: currentColor; opacity: 0.75;
}
.hari.libur { background: var(--libur); color: var(--libur-t); font-weight: 600; }
.hari.cuti { background: var(--cuti); color: var(--cuti-t); font-weight: 600; }
.hari.akhirpekan { background: var(--c); color: var(--d); }
.hari.sekarang { box-shadow: inset 0 0 0 2px var(--a); }
.kosong { background: transparent; border-color: transparent; }
.rincian {
  list-style: none; margin: 14px 0 0; padding: 12px 0 0;
  border-top: 1px dashed var(--l); display: flex; flex-direction: column; gap: 9px;
}
.rincian li { padding-left: 10px; border-left: 3px solid var(--l); }
.rincian li.libur { border-left-color: var(--libur-t); }
.rincian li.cuti { border-left-color: var(--cuti-t); }
.r-meta { display: flex; align-items: center; gap: 8px; }
.r-tgl { font-size: 0.74rem; color: var(--d); }
.tag { font-size: 0.66rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
.libur .tag { background: var(--libur); color: var(--libur-t); }
.cuti .tag { background: var(--cuti); color: var(--cuti-t); }
.r-nama { display: block; margin-top: 2px; font-size: 0.86rem; line-height: 1.35; }
.bulan-kosong { margin: 14px 0 0; padding-top: 12px; border-top: 1px dashed var(--l); font-size: 0.8rem; color: var(--d); }
.legenda {
  display: flex; flex-wrap: wrap; gap: 18px; margin-top: 28px;
  font-size: 0.85rem; color: var(--d);
}
.kunci { display: inline-flex; align-items: center; gap: 7px; }
.kunci::before {
  content: ""; width: 13px; height: 13px; border-radius: 4px;
  border: 1px solid var(--l); display: inline-block;
}
.kunci.libur::before { background: var(--libur); }
.kunci.cuti::before { background: var(--cuti); }
.kunci.akhirpekan::before { background: var(--c); }
.gagal {
  background: var(--card); border: 1px solid var(--libur-t); border-left-width: 4px;
  border-radius: 12px; padding: 16px 18px; margin-top: 26px;
}
.gagal h2 { margin: 0 0 6px; font-size: 1.05rem; }
.gagal p { margin: 0 0 8px; color: var(--d); font-size: 0.9rem; }
.gagal ul { margin: 0; padding-left: 20px; font-size: 0.9rem; }
.memuat { color: var(--d); margin-top: 26px; }
footer {
  margin-top: 40px; padding-top: 20px; padding-bottom: 48px;
  border-top: 1px solid var(--l); color: var(--d); font-size: 0.85rem;
}
`
