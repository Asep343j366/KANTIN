# Kantin Digital — PWA

Aplikasi PWA kantin: pelanggan memesan makanan/minuman, membayar via **QRIS statis** (unggah bukti), dan mengambil pesanan di tempat (pickup). Admin mengelola produk, memverifikasi pembayaran, dan mengatur status pesanan. Dibangun dengan **Next.js 14 (App Router) + Supabase + Tailwind CSS**.

## Fitur
- Katalog produk + kategori + pencarian
- Keranjang belanja (localStorage)
- Checkout guest (tanpa akun) — nama + no. HP
- Pembayaran QRIS statis + unggah bukti
- Status pesanan real-time + **struk digital** (lihat/cetak/bagikan)
- Dashboard admin: verifikasi pembayaran, kelola status, CRUD produk, pengaturan QRIS, rekap harian
- PWA: installable, offline shell

## Struktur
```
app/            Halaman (App Router)
  page.js       Katalog
  product/[id]  Detail produk
  cart          Keranjang
  checkout      Checkout + pembayaran QRIS
  order/[code]  Status pesanan + struk
  admin/        Dashboard admin (login, pesanan, produk, settings)
components/     Komponen UI
lib/            Supabase client, cart, format
public/         manifest, service worker, ikon
supabase/       schema.sql, seed.sql
```

## Menjalankan lokal
```bash
npm install
cp .env.example .env.local   # isi kredensial Supabase
npm run dev
```

Lihat **DEPLOY.md** untuk setup Supabase + deploy ke Vercel.

## Akses Admin
Buka `/admin` lalu login dengan akun yang dibuat di Supabase Auth.
