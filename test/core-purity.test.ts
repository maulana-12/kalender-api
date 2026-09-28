import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CORE_DIR = 'src/core'

/**
 * Invariant paling ketat di repo ini (AGENTS.md bagian 2). Kalau core boleh import
 * ke luar dirinya sendiri, dia berhenti bisa jalan di Cloudflare Worker.
 * Aturan ini ditegakkan di sini, bukan oleh linter.
 */
describe('core purity', () => {
  it('tidak meng-import apa pun di luar src/core/', async () => {
    const files = (await readdir(CORE_DIR)).filter((file) => file.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(0)

    const violations: string[] = []

    for (const file of files) {
      const source = await readFile(join(CORE_DIR, file), 'utf8')
      const statements = source.matchAll(/from\s+['"]([^'"]+)['"]/g)

      for (const [, specifier] of statements) {
        if (specifier === undefined) continue

        const isOwnFile = specifier.startsWith('./')
        const isNodeBuiltin = specifier.startsWith('node:')

        if (!isOwnFile && !isNodeBuiltin) {
          violations.push(`${file} -> "${specifier}" (paket eksternal)`)
        } else if (isNodeBuiltin) {
          violations.push(`${file} -> "${specifier}" (I/O, harusnya di dataset.ts)`)
        } else if (!specifier.startsWith('./types') && !specifier.startsWith('./validate') && !specifier.startsWith('./query') && !specifier.startsWith('./index')) {
          violations.push(`${file} -> "${specifier}" (keluar dari core/)`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('tidak menyentuh process, Date.now, atau fetch', async () => {
    const files = (await readdir(CORE_DIR)).filter((file) => file.endsWith('.ts'))
    const banned = /\b(process\.|Date\.now\(|fetch\(|require\()/

    for (const file of files) {
      const source = await readFile(join(CORE_DIR, file), 'utf8')
      expect(source, `${file} memakai API terlarang`).not.toMatch(banned)
    }
  })
})
