-- =========================================================
-- migration_v24: Logo/ikon per kantin.
-- settings.logo_url = URL gambar logo (PNG persegi 512px, disimpan di bucket
-- publik 'qris' dengan nama logo-<store_id>-<waktu>.png). Kosong = logo bawaan.
-- Dipakai: header toko, struk, sidebar admin, ikon aplikasi (manifest PWA).
-- Aplikasi tetap jalan walau migrasi ini belum dijalankan. Idempoten.
-- =========================================================
set search_path = public;

alter table public.settings add column if not exists logo_url text;
