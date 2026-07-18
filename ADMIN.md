# Panduan Admin — Login & Pengelolaan Kantin

Halaman admin dipakai untuk memverifikasi pembayaran, mengubah status pesanan, mengelola produk, dan mengatur QRIS. Login admin **tidak memakai pendaftaran publik** — akun admin dibuat manual di Supabase agar hanya orang yang berwenang yang bisa masuk.

---

## A. Alur Login Admin (ringkas)

```
Buka /admin
   │
   ├─ Belum login  ──► otomatis diarahkan ke /admin/login
   │                      │
   │                      ▼
   │              Isi Email + Password
   │                      │
   │                      ▼
   │        Supabase Auth memverifikasi kredensial
   │            │ gagal ─► tampil pesan "Login gagal"
   │            │ berhasil
   │            ▼
   │        Sesi tersimpan di browser (persist)
   │                      │
   │                      ▼
   └──────────►  Masuk ke Dashboard /admin
                          │
             (Pesanan • Produk • Pengaturan • Keluar)

Sudah login + buka /admin/login ──► otomatis diarahkan ke /admin
Klik "Keluar" ──► sesi dihapus ──► kembali ke /admin/login
```

Proteksi ini diatur di `app/admin/layout.js`: setiap halaman di bawah `/admin` mengecek sesi Supabase. Bila belum login, pengguna langsung dilempar ke `/admin/login`.

---

## B. Membuat Akun Admin (sekali saja)

1. Buka dashboard **Supabase** → project Anda.
2. Menu **Authentication** → **Users** → klik **Add user** → **Create new user**.
3. Isi:
   - **Email**: mis. `admin@kantin.com`
   - **Password**: buat password yang kuat
   - Centang **Auto Confirm User** (penting, agar bisa langsung login).
4. Klik **Create user**.

> Untuk menambah admin lain, ulangi langkah di atas. Untuk mengganti password, buka user tersebut di Supabase → **Reset password** / edit.

---

## C. Cara Login

1. Buka `https://NAMA-APP-ANDA.vercel.app/admin`
2. Anda otomatis diarahkan ke halaman **/admin/login**.
3. Masukkan **email** & **password** yang tadi dibuat di Supabase.
4. Setelah berhasil, Anda masuk ke **Dashboard Pesanan**.

Sesi login tersimpan di browser, jadi tidak perlu login ulang setiap kali membuka — sampai Anda menekan **Keluar**.

---

## D. Yang Bisa Dilakukan Admin

**1. Pesanan** (`/admin`)
- Melihat ringkasan pesanan & pendapatan hari ini.
- Filter pesanan per status: Perlu Verifikasi, Diproses, Siap Diambil, Selesai, Batal.
- Buka detail pesanan → **lihat bukti pembayaran** → **Verifikasi & Proses** atau **Tolak** (dengan alasan).
- Ubah status: Diproses → **Siap Diambil** → **Selesai**.
- Pembaruan status langsung terlihat oleh pelanggan (real-time).

**2. Produk** (`/admin/products`)
- Tambah / edit / hapus produk.
- Atur nama, harga, stok, kategori, deskripsi, foto, dan status tersedia/nonaktif.

**3. Pengaturan** (`/admin/settings`)
- Nama kantin, alamat, no. WhatsApp, jam operasional.
- **Unggah gambar QRIS statis** yang akan tampil di halaman pembayaran pelanggan.

---

## E. Alur Kerja Harian (rekomendasi)

1. Pastikan **QRIS** dan **produk** sudah diatur (sekali di awal).
2. Buka `/admin`, pantau tab **Perlu Verifikasi**.
3. Saat pesanan masuk → buka detail → cocokkan nominal pada bukti bayar → **Verifikasi & Proses**.
4. Siapkan pesanan → tandai **Siap Diambil**.
5. Saat pelanggan mengambil (tunjukkan kode pesanan) → tandai **Selesai**.

---

## F. Keamanan
- Jangan bagikan akun admin ke pelanggan.
- Hanya `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` yang boleh publik. **`SUPABASE_SERVICE_ROLE_KEY` wajib rahasia** (hanya di Environment Variables Vercel, jangan di kode klien).
- Operasi tulis sensitif (verifikasi, kelola produk, pengaturan) hanya bisa dilakukan akun yang sudah login (dijaga oleh RLS Supabase).
