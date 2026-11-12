-- =========================================================
-- migration_v23: Cegah bukti pembayaran dipakai ulang.
-- orders.bukti_ref = nomor referensi transaksi yang terbaca OCR dari bukti bayar
-- saat order lunas otomatis. Bukti dengan nomor yang sama tak bisa melunasi
-- order lain (masuk antrean cek admin).
-- Aplikasi tetap jalan walau migrasi ini belum dijalankan (cek dilewati). Idempoten.
-- =========================================================
set search_path = public;

alter table public.orders add column if not exists bukti_ref text;
create index if not exists orders_bukti_ref_idx on public.orders (bukti_ref) where bukti_ref is not null;
