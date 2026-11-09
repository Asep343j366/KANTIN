-- =========================================================
-- migration_v21: Nama aplikasi bisa diatur dari web (platform-admin)
-- Kolom di platform_settings (1 baris, public-read). Default DKantin /
-- Digital Kantin. Aplikasi tetap jalan walau migrasi ini belum dijalankan
-- (kode memakai default). Idempoten.
-- =========================================================
set search_path = public;

alter table public.platform_settings add column if not exists app_name text not null default 'DKantin';
alter table public.platform_settings add column if not exists app_tagline text not null default 'Digital Kantin';

-- Pastikan baris tunggal ada & memakai nama baru.
insert into public.platform_settings (id, app_name, app_tagline)
values (1, 'DKantin', 'Digital Kantin')
on conflict (id) do update set app_name = 'DKantin', app_tagline = 'Digital Kantin';
