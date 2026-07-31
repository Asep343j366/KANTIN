-- =========================================================
-- MIGRASI v6 — Multi-Store (Fase 1: Isolasi Data)
-- Jalankan di Supabase > SQL Editor SETELAH migration_v5.sql.
--
-- Tujuan: setiap baris data "milik" satu store.
-- Aman & idempoten. TIDAK memperketat RLS (itu Fase 2) supaya
-- aplikasi lama tetap jalan sampai kode diperbarui.
-- =========================================================

-- ---------- 1) TABEL STORES ----------
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  kode_site text unique not null,          -- cth: J366
  slug text unique not null,               -- kode_site(lower) + '-' + 3 huruf acak, cth: j366-nvd
  nama text not null default 'Kantin',
  status text not null default 'aktif',    -- aktif | grace | nonaktif | suspended
  is_platform_admin boolean not null default false,  -- J366 = true (super-admin platform)
  langganan_until timestamptz,             -- diperpanjang lewat token langganan (Fase 5)
  created_at timestamptz not null default now()
);
alter table stores enable row level security;
drop policy if exists "public read stores" on stores;
create policy "public read stores" on stores for select using (true);
drop policy if exists "admin all stores" on stores;
create policy "admin all stores" on stores for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- 2) STORE DEFAULT (J366 = pemilik/platform-admin) ----------
-- Slug memakai 3 huruf acak 'nvd' (boleh diganti kemudian).
insert into stores (kode_site, slug, nama, status, is_platform_admin)
values ('J366', 'j366-nvd', 'Kantin Digital', 'aktif', true)
on conflict (kode_site) do nothing;

-- ---------- 3) TAMBAH store_id KE SEMUA TABEL TENANT ----------
alter table categories      add column if not exists store_id uuid references stores(id) on delete cascade;
alter table products        add column if not exists store_id uuid references stores(id) on delete cascade;
alter table orders          add column if not exists store_id uuid references stores(id) on delete cascade;
alter table order_items     add column if not exists store_id uuid references stores(id) on delete cascade;
alter table journal         add column if not exists store_id uuid references stores(id) on delete cascade;
alter table stock_movements add column if not exists store_id uuid references stores(id) on delete cascade;
alter table settings        add column if not exists store_id uuid references stores(id) on delete cascade;

-- ---------- 4) BACKFILL: semua data lama -> store J366 ----------
do $$
declare v_store uuid;
begin
  select id into v_store from stores where kode_site = 'J366';
  update categories      set store_id = v_store where store_id is null;
  update products        set store_id = v_store where store_id is null;
  update orders          set store_id = v_store where store_id is null;
  update order_items     set store_id = v_store where store_id is null;
  update journal         set store_id = v_store where store_id is null;
  update stock_movements set store_id = v_store where store_id is null;
  update settings        set store_id = v_store where store_id is null;
end $$;

-- ---------- 5) SETTINGS: dari 1-baris-global -> 1-baris-per-store ----------
-- Buang constraint single-row (id=1) agar store lain bisa punya barisnya sendiri.
alter table settings drop constraint if exists settings_single_row;
-- id tak lagi jadi acuan; store_id yang menandai kepemilikan. Jadikan unik per store.
create unique index if not exists uq_settings_store on settings (store_id);

-- ---------- 6) INDEX store_id (query per store cepat) ----------
create index if not exists idx_categories_store      on categories (store_id);
create index if not exists idx_products_store         on products (store_id);
create index if not exists idx_orders_store           on orders (store_id);
create index if not exists idx_order_items_store      on order_items (store_id);
create index if not exists idx_journal_store          on journal (store_id);
create index if not exists idx_stock_movements_store  on stock_movements (store_id);

-- Catatan: orders.kode_pesanan TETAP unik global (aman untuk lookup webhook lintas store).
-- RLS multi-tenant + keanggotaan admin per store menyusul di Fase 2 (migration_v7/store_members).
