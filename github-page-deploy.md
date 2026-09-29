# Deploy ke GitHub Pages

Deployomatic terjadi setiap kali ada tag yang berakhiran `-github`, misalnya
`v0.1.0-github`. Push ke `main` tidak men-deploy apa pun.

## 1. Aktifkan GitHub Pages

```
https://github.com/{username}/{repo_name}/settings/pages
```

Di bagian **Build and deployment**, set **Source** jadi **GitHub Actions**.

Custom domain boleh ditambahkan, tapi **daftarkan dulu di GitHub, baru ubah
DNS** - urutannya penting. Kalau DNS diubah lebih dulu tanpa mendaftarkan
domainnya di GitHub, orang lain bisa mengambil alih subdomain itu.

DNS yang dibutuhkan:

| Kasus | Tipe | Nama | Nilai |
|---|---|---|---|
| Apex (`example.com`) | A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| Apex | AAAA | `@` | `2606:50c0:8000::153` s.d. `2606:50c0:8003::153` |
| Apex | ALIAS/ANAME | `@` | `USERNAME.github.io` |
| Subdomain (`www.example.com`) | CNAME | `www.example.com` | `USERNAME.github.io` |

Catatan: subdomain harus menunjuk ke `USERNAME.github.io` **tanpa** nama repo.
Jangan pakai wildcard `*.example.com` - itu berisiko takeover. Cek hasilnya
dengan `dig`, propagasi bisa memakan 24 jam.

Kalau belum yakin, jangan dulu. Pages tetap jalan di domain
`username.github.io` tanpa ini, dan domain default selalu bisa pakai HTTPS.

## 2. Batasi Actions ke workflow ini

```
https://github.com/{username}/{repo_name}/settings/actions/rules
```

Klik **New ruleset** > **Import ruleset from JSON**, lalu pakai
`github-action-page.json` di repo ini. Sesuaikan isinya: ganti `source`
dari `{username}/{reponame}` dengan repo aslimu, dan kosongkan `id` kalau
GitHub belum menyediakannya.

Ruleset itu membatasi event yang boleh memanggil Actions jadi
`push`, `release`, dan `workflow_dispatch` - dan hanya untuk
`.github/workflows/pages.yml`. Efeknya: workflow lain di repo ini, dan
juga `pull_request` dari fork, tidak bisa menjalankan Actions seenengaja.
Itu memang yang diinginkan untuk repo yang punya API key.

Bisa juga dibuat manual: ruleset dengan target **Actions**, kondisi
**Include workflows** `.github/workflows/pages.yml`, dan rule
**Restrict actions** dengan event yang diizinkan di atas.

## 3. Bikin tag

```
https://github.com/{username}/{repo_name}/releases
```

Buat release baru dengan tag berakhiran `-github`, contoh `v0.1.0-github`.
Deploy jalan dari tag itu.

```bash
npm version patch --no-git-tag-version
git commit -am "release: 0.1.1"
git tag v0.1.1-github
git push origin main --follow-tags
```

Tag tanpa akhiran `-github` tidak menyentuh Pages - itu cara menandai
channel distribusi, jadi tag untuk Worker atau Docker bisa hidup berdampingan
dengan versi yang sama.

## Environment protection rule

Environment `github-pages` punya daftar ref sendiri yang terpisah dari ruleset
di langkah 2. Kalau tag ditolak dengan pesan *not allowed to deploy due to
environment protection rules*, itu daftar ini yang menyaring, bukan ruleset.

```
https://github.com/{username}/{repo_name}/settings/environments
```

Environment `github-pages` > **Deployment branches and tags** harus memuat
policy bertipe `tag` dengan pola `*-github`. Tanpa itu, tag selalu ditolak
walaupun event-nya `push` dan sudah diizinkan.

## Kalau deploy gagal

Cek urutan ini dari atas:

- **Typecheck dan test gagal** - masalahnya di kode, bukan setting. Lihat log
  step yang merah.
- **`not allowed to deploy ... protection rules`** - daftar Deployment
  branches and tags di environment belum punya policy untuk tag.
- **`Get Pages site` 404 di log base URL** - Pages belum pernah aktif, atau
  dipanggil sebelum langkah 1 selesai. Bukan fatal: halaman tetap ter-deploy
  tanpa canonical.
- **Upload artifact gagal** - cek `dist/` benar-benar berisi hasil
  `npm run build:static` di runner.
