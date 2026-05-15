# Les Koding - Railway Ready

Project ini sudah disiapkan untuk deploy ke Railway.

## Jalankan local
```bash
npm install
npm start
```

Buka:
- http://localhost:3000/admin.html
- http://localhost:3000/parent.html

## Environment Variable Railway
Tambahkan di Railway > Variables:

```txt
ADMIN_PASSWORD=kolimntcode001
```

Railway otomatis memberi PORT, jadi tidak perlu set PORT manual.

## Deploy
1. Upload folder ini ke GitHub.
2. Railway > New Project > Deploy from GitHub Repo.
3. Pilih repo.
4. Tambahkan variable ADMIN_PASSWORD.
5. Generate domain.

## Catatan
Railway Free cocok untuk testing/awal. Kalau pakai SQLite dan upload file, storage free bisa terbatas.
