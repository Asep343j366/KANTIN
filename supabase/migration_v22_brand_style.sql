-- =========================================================
-- migration_v22: Gaya logo teks aplikasi (aksen huruf depan, warna, ukuran, dll)
-- Disimpan sebagai JSON di platform_settings. Kosong = gaya default.
-- Aplikasi tetap jalan walau migrasi ini belum dijalankan. Idempoten.
-- =========================================================
set search_path = public;

alter table public.platform_settings
  add column if not exists app_brand_style jsonb not null default '{}'::jsonb;
