-- =========================================================
-- MIGRASI v4 — Jurnal: foto nota & nama toko untuk Uang Keluar
-- Jalankan di Supabase > SQL Editor SETELAH migration_v3.sql.
-- =========================================================

alter table journal add column if not exists foto_url text;   -- foto nota belanja / bukti transaksi
alter table journal add column if not exists nama_toko text;  -- nama toko tempat belanja (untuk Uang Keluar)

-- Foto jurnal memakai bucket "payments" yang sudah ada (publik read + write).
-- Tidak perlu bucket/izin baru.
