import { build } from 'esbuild'
import { rm } from 'node:fs/promises'

/**
 * Bundle server ke `build/`, BUKAN ke `dist/`.
 *
 * `dist/` itu untuk GitHub Pages dan isinya harus byte-identik dengan `data/`.
 * Kalau file server ikut masuk ke sana, isi `dist/` jadi dua jenis asset yang
 * punya aturan berbeda, dan `build-static.ts` jadi tidak bisa lagi jadi satu
 *-satunya penulis direktori itu.
 */
const OUT_DIR = 'build'

await rm(OUT_DIR, { recursive: true, force: true })

const result = await build({
  entryPoints: ['src/server/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outdir: OUT_DIR,
  entryNames: 'server',
  // `.js` sekarang wajib: Node tidak bisa transform JSX tanpa bundler
  // (ERR_UNKNOWN_FILE_EXTENSION kalau dijalankan langsung).
  outExtension: { '.js': '.js' },
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx',
  minify: false,
  sourcemap: true,
  logLevel: 'warning',
  metafile: true,
})

const bytes = Object.values(result.metafile.outputs).reduce((sum, out) => sum + out.bytes, 0)
console.log(`OK build/server.js (${(bytes / 1024).toFixed(1)} kB)`)
