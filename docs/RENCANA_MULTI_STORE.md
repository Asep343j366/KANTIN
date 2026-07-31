# Rencana Pengembangan KANTIN → Multi-Store SaaS (Berlangganan)

Status awal: single-tenant. Target: banyak store, admin masing-masing, pembayaran
masing-masing (Casaku per store), sistem langganan bulanan.

Keputusan yang sudah diambil:
- **Kode Site & slug:** tiap store punya `kode_site` (cth `J366`). **slug = kode_site(lowercase) + "-" + 3 huruf acak** biar tak mudah ditebak store lain (cth `j366-nvd`). Store lama = kode site **J366**.
- **Platform-admin = store J366 sendiri** (flag `is_platform_admin`). Tak ada app admin terpisah — menu **"Kelola Store"** (tambah store baru) & **"Buat Kode Langganan"** muncul khusus di admin J366.
- **Routing storefront:** path `/s/[slug]` (contoh `kantin.app/s/warung-budi`).
- **Pembayaran:** config **per store disimpan di DATABASE, bukan ENV Vercel**. Uang langsung ke pemilik store; platform hanya jual software. Tiap store pilih salah satu **mode**:
  - `casaku` — otomatis via webhook Casaku (butuh HP Android + license Casaku).
  - `manual` — QRIS statis / rekening; owner tandai lunas sendiri dari menu **"Menunggu"** (route settle yang sudah ada). Onboarding tercepat.
- **Langganan:** **manual tanpa payment gateway** — Metode A: **kode token aktivasi** sekali pakai yang di-generate platform-admin. Tidak ada Xendit/webhook/cron rekonsiliasi pembayaran.

Prinsip: tiap fase harus bisa dijalankan & di-deploy tanpa merusak store yang sudah ada.
Store lama jadi store pertama (di-backfill `store_id`).

---

## FASE 1 — Isolasi Data (fondasi multi-tenant)
Tujuan: setiap baris data "milik" satu store.

- Tabel baru `stores`: `id, slug (unik), nama, status ('aktif'|'grace'|'nonaktif'|'suspended'), created_at`.
- Tambah `store_id uuid references stores(id)` ke: `products`, `categories`, `orders`, `order_items`, `settings`.
- `settings`: buang constraint single-row (`id=1`), jadikan 1 baris **per store** (unik `store_id`).
- Backfill: buat 1 store default, isi `store_id` semua data lama ke store itu.
- Index `store_id` di semua tabel + `orders.kode_pesanan` tetap unik global.
- RLS diperbarui: baca publik difilter `store_id`; tulis admin difilter keanggotaan store (lihat Fase 2).
- Migrasi: `supabase/migration_v6_multistore.sql`.

## FASE 2 — Admin per Store: LAPISAN IDENTITAS (keanggotaan & role)
Tujuan: tahu "user ini admin store mana" + siapa platform-admin. BELUM mengunci RLS
bacaan (itu Fase 3, biar tak regresi — lihat catatan bawah).

- Tabel `store_members`: `store_id, user_id, role ('owner'|'staff')` (PK gabungan) + RLS.
- Fungsi bantu SQL (security definer): `current_store_id()`, `is_platform_admin()`.
- Auto-enroll: semua `auth.users` yang sudah ada → anggota **J366** role `owner`.
- `lib/store.js` `getMyStore()`: resolusi store user (cache).
- `AdminShell`: tampilkan nama store (ganti teks hardcode); sediakan flag `is_platform_admin` untuk menu platform (menu "Kelola Store"/"Kode Langganan" dibuat di Fase 5/6).
- Migrasi: `migration_v7_store_members.sql`.

> **Catatan urutan:** filter `store_id` pada bacaan halaman admin (`products/inventory/journal/reports/settings/transaksi/pending`) + pengetatan RLS dipindah ke **Fase 3**, karena baris `journal`/`stock_movements` dari penjualan otomatis baru ber-`store_id` setelah storefront multi-tenant. Menerapkannya sebelum itu = entri penjualan J366 hilang dari tampilan.

## FASE 3 — Routing Storefront `/s/[slug]`
Tujuan: pelanggan masuk ke katalog store yang benar.

- Pindah storefront ke `app/s/[slug]/...` (page, product, cart, order, checkout).
- Resolusi `slug → store_id` di server; 404 kalau store tidak ada / nonaktif.
- Cart & order dibawa konteks `store_id`. Cegah campur item antar store dalam 1 keranjang.
- `next.config` / redirect `/` → landing pilih store atau halaman marketing.

## FASE 4 — Pembayaran per Store (2 mode: Casaku / Manual)
Tujuan: config pembayaran keluar dari ENV, jadi per store; owner pilih mode.

- Tabel `store_payment_config`: `store_id, mode ('casaku'|'manual'), license_key, qr_id, webhook_secret, package_ids, qris_statis_url, info_rekening, active`. Rahasia (license/secret) hanya service-role — RLS tolak baca publik.
- `lib/casaku.js`: fungsi terima config sebagai argumen (bukan baca ENV langsung).
- `app/api/pay/create/route.js`: cek `mode` store.
  - `casaku` → generate QRIS dinamis seperti sekarang.
  - `manual` → skip Casaku; order masuk status pending, tampilkan QRIS statis / info rekening dari config.
- Webhook per store: `app/api/pay/webhook/[storeId]/route.js` — verifikasi HMAC pakai `webhook_secret` store itu, lalu `mark_order_paid`. Hanya relevan untuk mode `casaku`. URL ini didaftarkan store di dashboard Casaku.
- **Mode manual** memakai ulang fitur yang SUDAH ADA: menu **"Menunggu"** (`app/admin/pending`) + route `app/api/admin/settle` → owner klik "Tandai Lunas". Tinggal difilter `store_id`.
- Halaman admin baru "Pembayaran": owner pilih mode & isi field yang sesuai (license/QR id/secret untuk casaku, atau QRIS statis/rekening untuk manual).
- Migrasi: `migration_v7_payment_per_store.sql`.

## FASE 5 — Langganan (Token Aktivasi Manual)
Tujuan: perpanjang langganan store via kode token; pembayaran langsung ke pemilik platform (di luar sistem). Tanpa payment gateway.

- Tabel `subscription_tokens`: `code (unik), durasi_hari, status ('aktif'|'terpakai'), redeemed_by_store, redeemed_at, created_at`.
- Kolom di `stores`: `status`, `langganan_until` (timestamptz).
- **Generate token**: platform-admin bikin kode (mis. `KTN-9F3A-2K7Q`) dengan durasi 30/90/365 hari. Bisa batch.
- **Redeem**: halaman admin "Langganan" di store → owner tempel kode → validasi (ada & belum terpakai) → `langganan_until += durasi` → token ditandai `terpakai` (sekali pakai). Idempoten, transaksi DB.
- Cron harian: `langganan_until` lewat → `grace` (mis. 3 hari) → `nonaktif`. Store nonaktif: storefront tampil "toko nonaktif", admin terkunci selain halaman Langganan.
- Guard di Fase 2 & 3 baca `stores.status`.
- (Opsional nanti) payment gateway tinggal dijadikan generator token yang sama — model tidak berubah.

## FASE 6 — Onboarding & Platform Admin
Tujuan: store baru bisa daftar sendiri; kamu pantau semua.

- Alur signup: buat user → buat `stores` (+slug) → `store_members` owner → trial/langganan.
- Dashboard platform-admin: daftar semua store, status langganan, suspend/aktifkan.
- Landing marketing + halaman harga.

---

## Urutan kerja disarankan
1 → 2 → 3 dulu (multi-tenant fungsional, 1 store yang sama jalan seperti sekarang).
Lalu 4 (pembayaran per store). Lalu 5 (monetisasi). 6 menyusul untuk skala.

## Risiko/catatan
- **Backfill wajib hati-hati**: pastikan semua data lama dapat `store_id` sebelum RLS diperketat, atau data "hilang" dari tampilan.
- **kode_pesanan** tetap unik global → aman untuk lookup webhook lintas store.
- **Rahasia pembayaran** (license/secret Casaku) jangan pernah ter-expose ke client; hanya service-role.
- Rujukan pola dari Posku: multi-outlet-design, recurring-billing, subscription-lifecycle, landing-and-admin.
