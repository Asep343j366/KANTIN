-- =========================================================
-- migration_v25: Logo kantin HANYA boleh diubah admin platform (J366).
-- Admin store biasa tetap bisa mengubah pengaturan lain di tabel settings,
-- tapi perubahan kolom logo_url dari akun mereka DIABAIKAN (nilai lama tetap).
-- Server (service role, auth.uid() kosong) & admin platform bebas mengubah.
-- Idempoten.
-- =========================================================
set search_path = public;

create or replace function public.guard_settings_logo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- server / service role
  if exists (
    select 1 from store_members m join stores s on s.id = m.store_id
    where m.user_id = auth.uid() and s.is_platform_admin
  ) then return new; end if;
  if tg_op = 'INSERT' then
    new.logo_url := null;
  elsif new.logo_url is distinct from old.logo_url then
    new.logo_url := old.logo_url;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_settings_logo on public.settings;
create trigger trg_guard_settings_logo before insert or update on public.settings
  for each row execute function public.guard_settings_logo();
