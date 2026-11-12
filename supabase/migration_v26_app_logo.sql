-- =========================================================
-- migration_v26: SATU logo aplikasi untuk SEMUA site.
-- platform_settings.app_logo_url (public-read, hanya admin platform yang
-- bisa mengubah lewat API). Logo per-site (settings.logo_url) tidak dipakai lagi.
-- Logo J366 yang sudah terlanjur diunggah ikut dipindahkan. Idempoten.
-- =========================================================
set search_path = public;

alter table public.platform_settings add column if not exists app_logo_url text;

update public.platform_settings p
set app_logo_url = s.logo_url
from public.settings s join public.stores st on st.id = s.store_id
where p.id = 1 and p.app_logo_url is null and st.is_platform_admin and s.logo_url is not null;
