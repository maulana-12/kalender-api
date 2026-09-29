# Deploy ke Cloudflare Workers

Target opsional. Repo ini tetap jalan tanpa Cloudflare - Pages dan Docker
punya jalur sendiri. Section ini cuma untuk kalau mau API-nya jalan di edge.

Prasyarat: akun Cloudflare (gratis cukup), Node 22.18 ke atas, dan repo ini
sudah di-clone dengan dependency ter-install:

```bash
npm ci
```

`npm ci` memakai `package-lock.json` apa adanya. `npm install` bisa menaikkan
versi dependency, dan hasil bundle-nya jadi tidak bisa dibandingkan dengan
yang di-CI.

## 1. Login

```bash
npx wrangler login
```

Buka browser yang dibuka otomatis, otorisasi Wrangler. Cek hasilnya:

```bash
npx wrangler whoami
```

Kalau ini tidak bisa -misalnya di container atau server tanpa browser- pakai
API token:

```bash
export CLOUDFLARE_API_TOKEN=<token>
```

Token dibuat di dashboard Cloudflare, scope **Edit Cloudflare Workers**. Jangan
taruh token ini di file yang di-commit.

## 2. Siapkan wrangler.toml

`wrangler.toml` tidak ada di repo, hanya templatenya. Ini disengaja: isinya
per-machine.

```bash
cp wrangler.toml.example wrangler.toml
```

Edit dua baris:

```toml
name = "kalender-api"          # nama Worker, jadi subdomainnya <name>.<subdomain>.workers.dev
account_id = ""                # isi: npx wrangler whoami
```

`compatibility_date` jangan diubah. Tanggal itu mengunci perilaku runtime
Workers dan Hono - kalau berubah, hasil bisa berubah tanpa ada kode yang
berubah. Tahan upgrade-nya terpisah dari upgrade kode.

`wrangler.toml` sudah masuk `.gitignore` (`wrangler*.toml`, dikecualikan
`*.example`). Kalau `git status` pernah menampilkan file itu, ada yang salah
dengan `.gitignore`-nya - jangan di-commit.

## 3. Test lokal

Wrangler menjalankan Worker-nya di miniflare, jadi ini bukan `npm run dev`
yang beda. Auth tetap diuji dengan key yang sama seperti production.

```bash
npx wrangler dev
```

Buka `http://localhost:8787`. Auth-nya bearer token, jadi header-nya
`Authorization: Bearer <key>`.

`/health` dan `/api/years` terbuka tanpa key - `/api/years` sengaja dibiarkan
publik karena client butuh manifest tahun untuk tahu endpoint mana yang ada.
Seluruh `/api/*` lainnya butuh key:

```bash
# terbuka, tanpa key
curl -s http://localhost:8787/health
curl -s http://localhost:8787/api/years

# 401 tanpa key
curl -i http://localhost:8787/api/holidays?year=2026

# 200 dengan key
curl -s -H "Authorization: Bearer <key>" \
  'http://localhost:8787/api/holidays?year=2026'
```

## 4. Set API key

`API_KEY` masuk lewat secret, bukan environment variable. Ini yang membuat
nilainya tidak pernah masuk git, log, atau dashboard.

```bash
npx wrangler secret put API_KEY
```

Wrangler prompting, paste key, selesai. Kalau lupa, `/api/*` membalas 500
dengan pesan yang menyebut `API_KEY belum dikonfigurasi` - bukan 401,
karena memang belum ada key-nya sama sekali.

Verifikasi:

```bash
npx wrangler secret list
```

## 5. Deploy

Wrangler membundle sendiri, jadi `build/server.js` tidak dipakai di sini.
Yang perlu dijaga tetap sama: kode dan data harus lolos test sebelum
dipublish.

```bash
npm run typecheck && npm test && npx wrangler deploy
```

Kalau sudah pernah `npm run build`, typecheck dan test-nya sudah termasuk -
cukup `npx wrangler deploy`.

Test dulu, deploy belakangan. Worker production dan yang lokal menghasilkan
bundle yang sama persis, tapi data bisa saja rusak di antara dua langkah itu.

Output deploy menyebutkan URL:

```
https://kalender-api.<subdomain>.workers.dev
```

Cek dari luar:

```bash
curl -s https://kalender-api.<subdomain>.workers.dev/health
curl -s -H "Authorization: Bearer <key>" \
  'https://kalender-api.<subdomain>.workers.dev/api/holidays?year=2026'
```

Bundle sekitar 127 KiB, 31 KiB gzip. Worker di plan gratis punya kuota
100.000 request per hari, dan API ini tidak mungkin mendekati itu.

## 6. Deploy ulang

Setelah kode atau data berubah:

```bash
npm run build && npx wrangler deploy
```

`npm run build` melakukan typecheck, test, dan build static. Yang menentukan
Workers immutable adalah langkah typecheck dan test-nya - `build/server.js`
dipakai untuk `npm start`, bukan untuk Workers.

Deploy tidak menghapus secret. Tapi kalau `API_KEY` dirotasi karena bocor:

```bash
npx wrangler secret put API_KEY
```

Rotasi itu langsung berlaku, tanpa deploy ulang - secretnya terpisah dari
bundle.

## Kalau deploy gagal

**`The entry-point file at "src/worker/index.ts" was not found`** - `wrangler.toml`
ada di tempat yang salah, jadi `main` relatif ke lokasi file itu. Pastikan file
nya di root repo.

**`Your login is not currently authenticated`** - `wrangler login` ulang, atau
set `CLOUDFLARE_API_TOKEN`. Kalau token, cek scope-nya masih Edit Workers.

**`Account not found` / `account_id` ditolak** - `account_id` disalin dari
tempat yang salah. Ambil dari `wrangler whoami`, bukan dari dashboard URL.

**`No bindings found` saat dry-run** - itu normal kalau belum `secret put`.
Binding secret tidak muncul di dry-run, dan tidak perlu. Yang penting deploy
sukses dan `/api/*` bukan 500.

**Deploy sukses tapi 401** - secret-nya belum di-set, atau key yang dipakai
request beda. `wrangler secret list` untuk lihat apa yang benar-benar ada.

**Deploy sukses tapi 500 dengan `API_KEY belum dikonfigurasi`** - Worker
menjalankan bundle lama, atau secret belum ter-deploy. Coba deploy ulang;
kalau masih, `wrangler tail` untuk lihat log runtime.

## Kalau Worker perlu di-rollback

Wrangler menyimpan versi. `npx wrangler deployments list` untuk lihat
historisnya, `npx wrangler rollback` untuk kembali ke versi sebelumnya.
Berguna kalau data yang salah sempat ter-deploy - dan menurut aturan di
`AGENTS.md`, data yang salah lebih berbahaya daripada data yang tidak ada.
