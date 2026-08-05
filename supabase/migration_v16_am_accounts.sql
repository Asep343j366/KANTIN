-- =========================================================
-- MIGRASI v16 — Area Manager (AM) Controlling Dashboard
-- Jalankan di Supabase > SQL Editor SETELAH migration_v15_auto_subscription.sql.
--
-- Tujuan:
--  - Tabel am_accounts: 1 akun AM = banyak store (by kode_site).
--  - AM = read-only monitoring lintas store (bukan member store).
--  - RLS: AM boleh SELECT journal/stock_movements untuk store under-nya
--    (orders/order_items/products/settings sudah public-read).
--  - Seed akun AM am13@gmail.com + daftar site under-nya.
-- Aman & idempoten.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- 1) TABEL AM ----------
-- sites = array kode_site (cth: {'J366','J341'}). Dipakai walau store belum dibuat;
-- store yang belum ada otomatis terabaikan sampai row stores-nya muncul.
create table if not exists am_accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  nama       text not null default 'Area Manager',
  sites      text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- 2) FUNGSI BANTU (security definer: bypass RLS internal) ----------
-- true bila user yang login adalah AM.
create or replace function is_am()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from am_accounts where user_id = auth.uid());
$$;

-- true bila store (by id) termasuk under AM yang sedang login.
create or replace function am_can_read_store(p_store_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from am_accounts a
    join stores s on s.id = p_store_id
    where a.user_id = auth.uid()
      and s.kode_site = any (a.sites)
  );
$$;

-- ---------- 3) RLS am_accounts ----------
alter table am_accounts enable row level security;

drop policy if exists "am read own" on am_accounts;
create policy "am read own" on am_accounts
  for select using (user_id = auth.uid());

drop policy if exists "platform manage am" on am_accounts;
create policy "platform manage am" on am_accounts
  for all using (is_platform_admin()) with check (is_platform_admin());

-- ---------- 4) RLS SELECT untuk AM di tabel yang terkunci per store ----------
-- journal & stock_movements: tak ada public-read → tambah policy khusus AM (read-only).
drop policy if exists "am read journal" on journal;
create policy "am read journal" on journal
  for select using (am_can_read_store(store_id));

drop policy if exists "am read stockmov" on stock_movements;
create policy "am read stockmov" on stock_movements
  for select using (am_can_read_store(store_id));

-- Catatan: orders / order_items / products / categories / settings sudah punya
-- policy "public read ... using (true)" sehingga AM bisa membacanya lintas store
-- tanpa policy tambahan. AM TIDAK diberi policy write mana pun → murni read-only.

-- ---------- 5) SEED AKUN AM (am13@gmail.com / 12345678) ----------
-- Membuat auth user via pgcrypto bila belum ada, lalu tautkan ke am_accounts.
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'am13@gmail.com';

  if v_uid is null then
    v_uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      'am13@gmail.com', crypt('12345678', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );

    -- identitas provider email (wajib agar login password berfungsi di GoTrue baru)
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      'am13@gmail.com', v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'am13@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    -- pastikan password sesuai bila user sudah ada
    update auth.users
      set encrypted_password = crypt('12345678', gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_uid;
  end if;

  insert into am_accounts (user_id, email, nama, sites)
  values (
    v_uid, 'am13@gmail.com', 'Area Manager',
    ARRAY['J341','J359','J373','J390','J31A','J357','J366','J31B','J30X']
  )
  on conflict (user_id) do update
    set sites = excluded.sites, email = excluded.email;
end $$;

-- =========================================================
-- Selesai. AM login di /am/login (am13@gmail.com / 12345678).
-- Untuk menambah AM lain: ulangi blok SEED dengan email/sites berbeda.
-- =========================================================
