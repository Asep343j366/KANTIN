-- =========================================================
-- migration_v17: Papan Kejujuran (kata-kata di Kantin TV)
-- Kolom teks per-store; satu kalimat per baris. Dibaca publik
-- oleh halaman /s/<slug>/tv (settings sudah public-read).
-- Idempoten.
-- =========================================================
set search_path = public;

alter table public.settings
  add column if not exists papan_kejujuran text;
