-- =========================================================
-- MIGRASI v3 — HPP, Jurnal Kas, Inventory (stock movements)
-- Jalankan di Supabase > SQL Editor SETELAH schema.sql & migration_v2.sql.
-- =========================================================

-- 1) HPP (Harga Pokok / modal) pada produk
alter table products add column if not exists hpp int not null default 0;

-- 2) JURNAL KAS
create table if not exists journal (
  id uuid primary key default gen_random_uuid(),
  jenis text not null,                 -- 'masuk' | 'keluar'
  kategori text not null,              -- Penjualan / Belanja Stok / Operasional / Setoran Modal / Lainnya
  keterangan text,
  jumlah int not null default 0,
  dicatat_oleh text,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table journal enable row level security;
drop policy if exists "admin all journal" on journal;
create policy "admin all journal" on journal for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 3) PERGERAKAN STOK (Inventory ledger)
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  nama_produk text,
  tipe text not null,                  -- 'masuk' | 'keluar' | 'penyesuaian'
  jumlah int not null,
  stok_akhir int,
  catatan text,
  oleh text,
  created_at timestamptz not null default now()
);
alter table stock_movements enable row level security;
drop policy if exists "admin all stockmov" on stock_movements;
create policy "admin all stockmov" on stock_movements for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4) Saat item terjual: kurangi stok + catat pergerakan stok (SECURITY DEFINER)
create or replace function decrement_stock_on_sale()
returns trigger language plpgsql security definer as $$
declare cur int;
begin
  update products set stok = greatest(0, stok - new.jumlah)
    where id = new.product_id returning stok into cur;
  insert into stock_movements(product_id, nama_produk, tipe, jumlah, stok_akhir, catatan, oleh)
    values (new.product_id, new.nama_produk, 'keluar', new.jumlah, cur, 'Penjualan', 'sistem');
  return new;
end; $$;

drop trigger if exists trg_decrement_stock on order_items;
create trigger trg_decrement_stock after insert on order_items
  for each row execute function decrement_stock_on_sale();

-- 5) Saat transaksi selesai dibuat: catat jurnal "Masuk — Penjualan" otomatis
create or replace function journal_on_order()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'selesai' then
    insert into journal(jenis, kategori, keterangan, jumlah, dicatat_oleh, order_id)
      values ('masuk', 'Penjualan',
        'Penjualan ' || new.kode_pesanan || ' (' || new.nama_pelanggan || ')',
        new.total, 'sistem', new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_journal_on_order on orders;
create trigger trg_journal_on_order after insert on orders
  for each row execute function journal_on_order();
