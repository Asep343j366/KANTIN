-- =========================================================
-- migration_v27: PROMO (diskon item & bundling) + banner yang didesain di admin.
--  - promos: per store. jenis 'diskon' (items = [{product_id}], diskon_tipe
--    'persen'|'nominal', diskon_nilai) atau 'bundling' (items = [{product_id, qty}],
--    harga_paket). mulai/berakhir = tanggal (inklusif). kuota opsional.
--    banner = jsonb {template, judul, sub, aksen, foto}.
--  - order_items.promo_id: menandai item yang dibeli lewat promo (kuota & laporan).
--  - promo_usage(): jumlah terpakai (diskon = unit, bundling = paket) dari order selesai.
-- Public read (toko pembeli membaca promo); tulis hanya admin store sendiri.
-- Idempoten.
-- =========================================================
set search_path = public;

create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  jenis text not null check (jenis in ('diskon','bundling')),
  nama text not null,
  aktif boolean not null default true,
  mulai date not null default current_date,
  berakhir date not null default (current_date + 7),
  kuota int,
  diskon_tipe text check (diskon_tipe in ('persen','nominal')),
  diskon_nilai int,
  harga_paket int,
  items jsonb not null default '[]'::jsonb,
  banner jsonb not null default '{}'::jsonb,
  urutan int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists promos_store_idx on public.promos (store_id, aktif, berakhir);

alter table public.promos enable row level security;
drop policy if exists "public read promos" on public.promos;
create policy "public read promos" on public.promos for select using (true);
drop policy if exists "store insert promos" on public.promos;
create policy "store insert promos" on public.promos for insert with check (store_id = current_store_id());
drop policy if exists "store update promos" on public.promos;
create policy "store update promos" on public.promos for update using (store_id = current_store_id()) with check (store_id = current_store_id());
drop policy if exists "store delete promos" on public.promos;
create policy "store delete promos" on public.promos for delete using (store_id = current_store_id());

alter table public.order_items add column if not exists promo_id uuid;
create index if not exists order_items_promo_idx on public.order_items (promo_id) where promo_id is not null;

-- Jumlah terpakai sebuah promo (hanya dari order SELESAI).
create or replace function public.promo_usage(p_promo uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_jenis text; v_items jsonb; v_per int; v_units int;
begin
  select jenis, items into v_jenis, v_items from promos where id = p_promo;
  if v_jenis is null then return 0; end if;
  select coalesce(sum(oi.jumlah), 0) into v_units
    from order_items oi join orders o on o.id = oi.order_id
   where oi.promo_id = p_promo and o.status = 'selesai';
  if v_jenis = 'bundling' then
    select coalesce(sum(greatest((e->>'qty')::int, 1)), 1) into v_per from jsonb_array_elements(v_items) e;
    return v_units / greatest(v_per, 1);
  end if;
  return v_units;
end $$;
grant execute on function public.promo_usage(uuid) to anon, authenticated;
