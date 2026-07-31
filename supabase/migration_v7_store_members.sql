-- =========================================================
-- MIGRASI v7 — Multi-Store (Fase 2: Lapisan Identitas Admin)
-- Jalankan di Supabase > SQL Editor SETELAH migration_v6_multistore.sql.
--
-- Tujuan: keanggotaan admin per store + flag platform-admin.
-- BELUM mengunci RLS bacaan tabel tenant (itu Fase 3) supaya
-- entri penjualan otomatis (journal/stock_movements) tak hilang.
-- Aman & idempoten.
-- =========================================================

-- ---------- 1) TABEL KEANGGOTAAN ----------
create table if not exists store_members (
  store_id uuid not null references stores(id) on delete cascade,
  user_id  uuid not null,                      -- auth.users.id
  role     text not null default 'owner',      -- owner | staff
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index if not exists idx_store_members_user on store_members (user_id);

-- ---------- 2) FUNGSI BANTU (security definer: bypass RLS internal) ----------
-- store_id milik user yang sedang login (asumsi 1 user = 1 store).
create or replace function current_store_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from store_members where user_id = auth.uid() limit 1;
$$;

-- true bila user anggota store yang ber-flag platform-admin (J366).
create or replace function is_platform_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from store_members m
    join stores s on s.id = m.store_id
    where m.user_id = auth.uid() and s.is_platform_admin
  );
$$;

-- ---------- 3) RLS store_members ----------
alter table store_members enable row level security;

drop policy if exists "read own membership" on store_members;
create policy "read own membership" on store_members
  for select using (user_id = auth.uid());

drop policy if exists "platform manage members" on store_members;
create policy "platform manage members" on store_members
  for all using (is_platform_admin()) with check (is_platform_admin());

-- ---------- 4) AUTO-ENROLL user lama -> anggota J366 (owner) ----------
-- Semua admin yang sudah ada saat ini adalah admin J366.
insert into store_members (store_id, user_id, role)
select (select id from stores where kode_site = 'J366'), u.id, 'owner'
from auth.users u
on conflict (store_id, user_id) do nothing;

-- =========================================================
-- Belum diubah di sini (menyusul Fase 3):
--  - RLS tabel tenant masih "authenticated = semua".
--  - Filter store_id pada bacaan halaman admin.
--  - Trigger penjualan mengalirkan store_id ke journal/stock_movements.
-- =========================================================
