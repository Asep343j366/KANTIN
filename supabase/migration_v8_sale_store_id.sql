-- =========================================================
-- MIGRASI v8 — Multi-Store (Fase 3A: store_id pada entri penjualan otomatis)
-- Jalankan di Supabase > SQL Editor SETELAH migration_v7_store_members.sql.
--
-- Sekarang orders & order_items sudah membawa store_id (diisi storefront).
-- Perbarui trigger penjualan agar journal & stock_movements ikut ber-store_id,
-- supaya data penjualan tetap muncul saat bacaan admin difilter (Fase 3B).
-- Idempoten (create or replace).
-- =========================================================

-- Saat item terjual: kurangi stok + catat pergerakan stok (bawa store_id dari order_item)
create or replace function decrement_stock_on_sale()
returns trigger language plpgsql security definer as $$
declare cur int;
begin
  update products set stok = greatest(0, stok - new.jumlah)
    where id = new.product_id returning stok into cur;
  insert into stock_movements(store_id, product_id, nama_produk, tipe, jumlah, stok_akhir, catatan, oleh)
    values (new.store_id, new.product_id, new.nama_produk, 'keluar', new.jumlah, cur, 'Penjualan', 'sistem');
  return new;
end; $$;

-- Saat order 'selesai' dibuat: catat jurnal "Masuk — Penjualan" (bawa store_id dari order)
create or replace function journal_on_order()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'selesai' then
    insert into journal(store_id, jenis, kategori, keterangan, jumlah, dicatat_oleh, order_id)
      values (new.store_id, 'masuk', 'Penjualan',
        'Penjualan ' || new.kode_pesanan || ' (' || new.nama_pelanggan || ')',
        new.total, 'sistem', new.id);
  end if;
  return new;
end; $$;

-- Trigger sudah terpasang dari migration_v3 (nama sama) — cukup ganti isi fungsi.
