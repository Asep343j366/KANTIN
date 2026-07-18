# Panduan Setup Supabase & Deploy ke Vercel

Ikuti langkah berikut secara berurutan.

---

## 1. Buat Project Supabase
1. Masuk ke https://supabase.com → **New Project**.
2. Isi nama project, password database, pilih region terdekat (mis. Singapore).
3. Tunggu project selesai dibuat (~2 menit).

## 2. Jalankan Skema Database
1. Di dashboard Supabase, buka **SQL Editor** → **New query**.
2. Salin seluruh isi `supabase/schema.sql`, tempel, klik **Run**.
3. (Opsional) Jalankan `supabase/seed.sql` untuk data contoh produk.

> Skema ini otomatis membuat tabel, RLS policy, dan storage bucket (`products`, `qris`, `payments`). Jika bucket gagal dibuat via SQL, buat manual di menu **Storage** dengan nama yang sama dan set **Public**.

## 3. Buat Akun Admin
1. Buka **Authentication** → **Users** → **Add user** → **Create new user**.
2. Isi email & password admin. Centang **Auto Confirm User**.
3. Email/password inilah yang dipakai login di halaman `/admin`.

## 4. Ambil Kredensial API
Buka **Project Settings** → **API**, catat:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (rahasia)

---

## 5. Push Kode ke GitHub
Repo ini sudah berupa git repository. Dari folder project:
```bash
git add .
git commit -m "Kantin PWA - initial"
git branch -M main
git remote add origin https://github.com/USERNAME/KANTIN.git   # jika belum ada remote
git push -u origin main
```

## 6. Deploy ke Vercel
1. Masuk ke https://vercel.com → **Add New** → **Project**.
2. **Import** repository GitHub `KANTIN`.
3. Framework Preset terdeteksi **Next.js** (biarkan default).
   - Build Command: `next build`
   - Output: otomatis
4. Buka bagian **Environment Variables**, tambahkan:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

   Set untuk environment **Production, Preview, Development** (ketiganya).
5. Klik **Deploy**. Tunggu build selesai.

## 7. Konfigurasi Setelah Deploy
1. Buka domain hasil deploy (mis. `kantin.vercel.app`).
2. Masuk ke `/admin`, login dengan akun admin.
3. Di **Pengaturan**: isi nama kantin, jam operasional, dan **unggah gambar QRIS statis**.
4. Di **Produk**: tambahkan menu + foto.
5. Coba alur pelanggan: pesan → checkout → upload bukti → cek `/order/KODE`.

---

## Catatan Build & Domain
- Setiap `git push` ke branch `main` memicu **auto-deploy** di Vercel.
- Untuk domain kustom: Vercel → Project → **Settings** → **Domains**.
- Bila mengubah environment variable, lakukan **Redeploy** agar diterapkan.

## Troubleshooting
- **Produk tidak muncul** → cek env var Supabase sudah benar & schema sudah dijalankan.
- **Gagal upload bukti/QRIS** → pastikan bucket `payments`/`qris`/`products` ada & Public.
- **Tidak bisa login admin** → pastikan user dibuat & di-*confirm* di Supabase Auth.
- **Service worker error saat dev** → normal di beberapa browser; PWA aktif penuh di production (HTTPS).
