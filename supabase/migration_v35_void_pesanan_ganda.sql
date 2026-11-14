-- =========================================================
-- migration_v35: Batalkan PESANAN GANDA yang telanjur lunas.
-- Pembeli kadang checkout 2x (klik ganda / ulang) → 2 order identik; yang
-- kembar ikut "Tandai Lunas" massal → omzet, jurnal & stok tercatat 2x.
-- void_duplicate_order(): khusus admin store pemilik order.
--   • stok dikembalikan (+ catatan pergerakan stok)
--   • entri jurnal "Penjualan" milik order itu dihapus (saldo kas terkoreksi)
--   • order ditandai dibatalkan (data tetap ada, tidak dihapus)
-- Idempoten: order yang sudah dibatalkan → tidak diproses ulang.
-- =========================================================
create or replace function public.void_duplicate_order(p_order_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_store uuid; v_status text;
begin
  select store_id, status into v_store, v_status from orders where id = p_order_id;
  if not found then raise exception 'Order tidak ditemukan.'; end if;
  if v_store is distinct from current_store_id() then
    raise exception 'Order bukan milik store Anda.';
  end if;
  if v_status = 'dibatalkan' then return true; end if;

  -- 1) kembalikan stok
  update products p
     set stok = p.stok + oi.jumlah
    from order_items oi
   where oi.order_id = p_order_id and oi.product_id = p.id;

  insert into stock_movements(store_id, product_id, nama_produk, tipe, jumlah, stok_akhir, catatan, oleh)
  select oi.store_id, oi.product_id, oi.nama_produk, 'masuk', oi.jumlah,
         (select stok from products where id = oi.product_id),
         'Pembatalan pesanan ganda', 'sistem'
    from order_items oi
   where oi.order_id = p_order_id and oi.product_id is not null;

  -- 2) hapus jurnal penjualan order ini
  delete from journal
   where order_id = p_order_id and jenis = 'masuk' and kategori = 'Penjualan';

  -- 3) tandai dibatalkan
  update orders
     set status = 'dibatalkan', payment_status = 'cancel'
   where id = p_order_id;

  return true;
end $$;

revoke all on function public.void_duplicate_order(uuid) from public, anon;
grant execute on function public.void_duplicate_order(uuid) to authenticated;
