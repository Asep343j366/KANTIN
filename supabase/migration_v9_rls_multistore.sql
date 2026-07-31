-- =========================================================
-- MIGRASI v9 — Multi-Store (Fase 3B: kunci RLS + auto-fill store_id)
-- Jalankan di Supabase > SQL Editor SETELAH migration_v8_sale_store_id.sql.
--
-- - Isi store_id otomatis saat admin insert (tak perlu diisi dari app).
-- - Batasi tulis tabel tenant ke store milik admin (current_store_id()).
-- - Public read tetap (storefront pelanggan).
-- Idempoten.
-- =========================================================

-- ---------- 1) AUTO-FILL store_id saat INSERT ----------
create or replace function set_store_id_default()
returns trigger language plpgsql security definer as $$
begin
  if new.store_id is null then
    new.store_id := current_store_id();
  end if;
  return new;
end $$;

drop trigger if exists trg_store_id_products on products;
create trigger trg_store_id_products before insert on products
  for each row execute function set_store_id_default();

drop trigger if exists trg_store_id_categories on categories;
create trigger trg_store_id_categories before insert on categories
  for each row execute function set_store_id_default();

drop trigger if exists trg_store_id_journal on journal;
create trigger trg_store_id_journal before insert on journal
  for each row execute function set_store_id_default();

drop trigger if exists trg_store_id_stockmov on stock_movements;
create trigger trg_store_id_stockmov before insert on stock_movements
  for each row execute function set_store_id_default();

drop trigger if exists trg_store_id_settings on settings;
create trigger trg_store_id_settings before insert on settings
  for each row execute function set_store_id_default();

-- ---------- 2) SETTINGS: id auto (sequence) agar tiap store bisa punya baris ----------
create sequence if not exists settings_id_seq;
alter table settings alter column id set default nextval('settings_id_seq');
select setval('settings_id_seq', greatest((select coalesce(max(id), 1) from settings), 1));

-- ---------- 3) RLS: batasi TULIS ke store milik admin ----------
-- PRODUCTS (public read tetap)
drop policy if exists "admin all products" on products;
create policy "store insert products" on products for insert with check (store_id = current_store_id());
create policy "store update products" on products for update using (store_id = current_store_id()) with check (store_id = current_store_id());
create policy "store delete products" on products for delete using (store_id = current_store_id());

-- CATEGORIES (public read tetap)
drop policy if exists "admin all categories" on categories;
create policy "store insert categories" on categories for insert with check (store_id = current_store_id());
create policy "store update categories" on categories for update using (store_id = current_store_id()) with check (store_id = current_store_id());
create policy "store delete categories" on categories for delete using (store_id = current_store_id());

-- SETTINGS (public read tetap)
drop policy if exists "admin all settings" on settings;
create policy "store insert settings" on settings for insert with check (store_id = current_store_id());
create policy "store update settings" on settings for update using (store_id = current_store_id()) with check (store_id = current_store_id());

-- ORDERS: public read + public insert (pelanggan) tetap; update dibatasi store admin
drop policy if exists "admin update orders" on orders;
create policy "store update orders" on orders for update using (store_id = current_store_id()) with check (store_id = current_store_id());

-- JOURNAL: tak ada public read → full per store (baca & tulis)
drop policy if exists "admin all journal" on journal;
create policy "store all journal" on journal for all using (store_id = current_store_id()) with check (store_id = current_store_id());

-- STOCK_MOVEMENTS: idem
drop policy if exists "admin all stockmov" on stock_movements;
create policy "store all stockmov" on stock_movements for all using (store_id = current_store_id()) with check (store_id = current_store_id());

-- Catatan:
--  - Trigger penjualan (decrement_stock_on_sale, journal_on_order) SECURITY DEFINER
--    → bypass RLS, dan sudah membawa store_id dari order (migration_v8). Aman.
--  - Bacaan tabel ber-public-read (products/categories/settings/orders) TIDAK terisolasi
--    oleh RLS → halaman admin memfilter store_id di query (perubahan app Fase 3B).
