-- =========================================================
-- migration_v20: Musik latar Kantin TV (playlist per store)
-- Tabel tv_musik (daftar lagu per store, diputar berurutan loop di /s/<slug>/tv)
-- + toggle & volume di settings + bucket kantin-musik. Idempoten.
-- =========================================================
set search_path = public;

create table if not exists tv_musik (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  nama text,
  url text not null,
  urutan int not null default 0,
  created_at timestamptz not null default now()
);

alter table tv_musik enable row level security;
drop policy if exists "public read tv_musik"   on tv_musik;
drop policy if exists "store insert tv_musik"   on tv_musik;
drop policy if exists "store update tv_musik"   on tv_musik;
drop policy if exists "store delete tv_musik"   on tv_musik;
create policy "public read tv_musik" on tv_musik for select using (true);
create policy "store insert tv_musik" on tv_musik for insert with check (store_id = current_store_id());
create policy "store update tv_musik" on tv_musik for update using (store_id = current_store_id()) with check (store_id = current_store_id());
create policy "store delete tv_musik" on tv_musik for delete using (store_id = current_store_id());

drop trigger if exists trg_store_id_tv_musik on tv_musik;
create trigger trg_store_id_tv_musik before insert on tv_musik
  for each row execute function set_store_id_default();

-- Toggle & volume musik di settings.
alter table settings add column if not exists musik_aktif boolean not null default true;
alter table settings add column if not exists musik_volume int not null default 55;

-- Bucket audio (publik baca; tulis oleh admin login).
insert into storage.buckets (id, name, public) values ('kantin-musik', 'kantin-musik', true)
on conflict (id) do nothing;
drop policy if exists "public read kantin-musik" on storage.objects;
drop policy if exists "auth write kantin-musik"  on storage.objects;
drop policy if exists "auth update kantin-musik" on storage.objects;
drop policy if exists "auth del kantin-musik"    on storage.objects;
create policy "public read kantin-musik" on storage.objects for select using (bucket_id = 'kantin-musik');
create policy "auth write kantin-musik"  on storage.objects for insert with check (bucket_id = 'kantin-musik' and auth.role() = 'authenticated');
create policy "auth update kantin-musik" on storage.objects for update using (bucket_id = 'kantin-musik' and auth.role() = 'authenticated');
create policy "auth del kantin-musik"    on storage.objects for delete using (bucket_id = 'kantin-musik' and auth.role() = 'authenticated');
