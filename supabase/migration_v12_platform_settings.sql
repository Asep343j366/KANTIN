-- =========================================================
-- MIGRASI v12 — Pengaturan Platform (Landing) untuk admin J366
-- Jalankan di Supabase > SQL Editor SETELAH migration_v11_subscription_tokens.sql.
--
-- Nomor WhatsApp & info harga di landing page bisa diatur dari admin platform.
-- Public read (landing/anon perlu baca). Tulis hanya via route service_role.
-- Idempoten.
-- =========================================================

create table if not exists platform_settings (
  id int primary key default 1,
  wa_number text,             -- format 62xxx (tanpa +/0)
  harga_label text,           -- cth: "Rp50.000"
  harga_note text,            -- cth: "/bulan" atau "Hubungi kami untuk harga"
  updated_at timestamptz not null default now(),
  constraint platform_settings_single check (id = 1)
);

insert into platform_settings (id, wa_number, harga_label, harga_note)
values (1, '6281234567890', '', 'Hubungi kami untuk harga & aktivasi.')
on conflict (id) do nothing;

alter table platform_settings enable row level security;
drop policy if exists "public read platform settings" on platform_settings;
create policy "public read platform settings" on platform_settings for select using (true);
-- Tulis hanya lewat service_role (route admin) → tanpa policy insert/update.
