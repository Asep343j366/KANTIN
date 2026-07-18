-- =========================================================
-- MIGRASI v2 — Penyederhanaan alur + dukungan Dashboard/Laporan
-- Jalankan di Supabase > SQL Editor SETELAH schema.sql.
-- =========================================================

-- 1) Kolom ambang "stok menipis" pada settings (dipakai Dashboard)
alter table settings add column if not exists stok_menipis_threshold int not null default 5;

-- 2) Kurangi stok produk otomatis saat item transaksi tercatat.
--    Dibuat SECURITY DEFINER agar bisa mengubah stok walau pemesan adalah anon.
create or replace function decrement_stock_on_sale()
returns trigger
language plpgsql
security definer
as $$
begin
  update products
    set stok = greatest(0, stok - new.jumlah)
    where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists trg_decrement_stock on order_items;
create trigger trg_decrement_stock
  after insert on order_items
  for each row execute function decrement_stock_on_sale();

-- 3) (Opsional) Karena alur verifikasi dihapus, semua pesanan baru
--    langsung berstatus 'selesai' dari aplikasi. Jika ada data lama
--    berstatus menunggu/diproses/siap_diambil dan ingin dianggap selesai:
-- update orders set status = 'selesai'
--   where status in ('menunggu_verifikasi','diproses','siap_diambil');
