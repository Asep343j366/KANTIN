-- =========================================================
-- migration_v19: Simpan qr_string pada order
-- Agar QRIS dinamis (Casaku) bisa DITAMPILKAN ULANG di halaman status
-- (/s/<slug>/order/[code]) saat pelanggan kembali dari menu Pesanan —
-- bukan hanya di layar checkout. Idempoten.
-- =========================================================
set search_path = public;

alter table public.orders
  add column if not exists qr_string text;
