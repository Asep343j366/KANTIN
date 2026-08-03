-- =========================================================
-- MIGRASI v14 — Perbaikan multi-store
-- Jalankan di Supabase > SQL Editor SETELAH migration_v13_demo_store.sql.
-- Idempoten.
--
-- Isi:
--  1) Bersihkan keanggotaan J366 yang keliru (dobel) → 1 user = 1 store.
--  2) current_store_id() deterministik (utamakan store non-platform).
--  3) mark_order_paid TANPA kurang stok (stok sudah dikurangi trigger saat
--     order_items dibuat) → hilangkan dobel-decrement.
--  4) cancel_order_restock() — kembalikan stok saat order pending dibatalkan.
-- =========================================================

-- ---------- 1) BERSIHKAN MEMBERSHIP GANDA ----------
-- Auto-enroll v7 memasukkan SEMUA user lama ke J366. User yang sebenarnya
-- pemilik store lain jadi punya 2 baris store_members → resolusi store
-- non-deterministik (kadang J366). Hapus baris J366 utk user yang juga
-- anggota store non-platform. Platform-admin J366 (yang HANYA punya J366)
-- tidak tersentuh.
delete from store_members sm
using stores s
where sm.store_id = s.id
  and s.is_platform_admin = true
  and exists (
    select 1 from store_members sm2
    join stores s2 on s2.id = sm2.store_id
    where sm2.user_id = sm.user_id
      and s2.is_platform_admin = false
  );

-- ---------- 2) current_store_id() DETERMINISTIK ----------
-- Utamakan store non-platform bila (masih) ada lebih dari satu, lalu yang
-- paling awal dibuat. Aman untuk kasus 1 user = 1 store.
create or replace function current_store_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select m.store_id
  from store_members m
  join stores s on s.id = m.store_id
  where m.user_id = auth.uid()
  order by s.is_platform_admin asc, m.created_at asc
  limit 1;
$$;

-- ---------- 3) mark_order_paid: settle + JURNAL penjualan (tanpa kurang stok) ----------
-- Stok sudah dikurangi trigger trg_decrement_stock saat order_items INSERT
-- (order dibuat/pending). Mengurangi lagi di sini = dobel → dihapus.
-- PENTING: order dibuat 'menunggu_pembayaran' lalu DI-UPDATE jadi 'selesai' di
-- sini. Trigger journal_on_order hanya jalan saat INSERT status='selesai',
-- sehingga entri "Masuk — Penjualan" TAK PERNAH tercatat pada alur QRIS/manual.
-- Maka catat jurnalnya di sini (bawa store_id order, idempoten via order_id).
create or replace function mark_order_paid(p_payment_ref text, p_amount int)
returns boolean as $$
declare
  v_order orders%rowtype;
begin
  update orders
     set payment_status = 'paid',
         status         = 'selesai',
         paid_at        = now(),
         amount_charged = coalesce(p_amount, amount_charged)
   where payment_ref = p_payment_ref
     and payment_status <> 'paid'
   returning * into v_order;

  if v_order.id is null then
    return false; -- tidak ada / sudah lunas → jangan proses ulang
  end if;

  -- Jurnal "Masuk — Penjualan" (idempoten: hanya bila belum ada utk order ini)
  insert into journal(store_id, jenis, kategori, keterangan, jumlah, dicatat_oleh, order_id)
  select v_order.store_id, 'masuk', 'Penjualan',
         'Penjualan ' || v_order.kode_pesanan || ' (' || v_order.nama_pelanggan || ')',
         v_order.total, 'sistem', v_order.id
  where not exists (select 1 from journal j where j.order_id = v_order.id);

  return true;
end;
$$ language plpgsql security definer;

-- ---------- 3b) BACKFILL jurnal penjualan yang hilang ----------
-- Order yang SUDAH lunas sebelum perbaikan ini tak punya entri "Penjualan"
-- (karena trigger INSERT tak pernah jalan pada alur update). Buatkan sekarang.
-- Idempoten: hanya untuk order paid/selesai yang belum punya baris jurnal.
insert into journal(store_id, jenis, kategori, keterangan, jumlah, dicatat_oleh, order_id, created_at)
select o.store_id, 'masuk', 'Penjualan',
       'Penjualan ' || o.kode_pesanan || ' (' || o.nama_pelanggan || ')',
       o.total, 'sistem', o.id, coalesce(o.paid_at, o.created_at)
from orders o
where (o.payment_status = 'paid' or o.status = 'selesai')
  and o.store_id is not null
  and not exists (select 1 from journal j where j.order_id = o.id);

-- ---------- 3c) PERBAIKI store_id jurnal yang salah (entri ber-order) ----------
-- Entri jurnal yang tertaut order tapi store_id-nya beda dari order (akibat
-- current_store_id() lama yang salah) — samakan ke store order (otoritatif).
update journal j
   set store_id = o.store_id
  from orders o
 where j.order_id = o.id
   and o.store_id is not null
   and j.store_id is distinct from o.store_id;

-- ---------- 4) RESTOCK saat order pending dibatalkan ----------
-- Kembalikan stok + catat pergerakan 'masuk'. Idempoten: order yang sudah
-- 'dibatalkan' tak diproses ulang. Order 'paid' ditolak (jangan restock omzet).
create or replace function cancel_order_restock(p_order_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_pay text; v_status text;
begin
  select payment_status, status into v_pay, v_status
    from orders where id = p_order_id;
  if not found then return false; end if;
  if v_pay = 'paid' then
    raise exception 'Order sudah lunas, tidak bisa dibatalkan.';
  end if;
  if v_status = 'dibatalkan' then return true; end if; -- sudah dibatalkan

  -- kembalikan stok
  update products p
     set stok = p.stok + oi.jumlah
    from order_items oi
   where oi.order_id = p_order_id and oi.product_id = p.id;

  -- catat pergerakan stok masuk (pakai stok terkini setelah dikembalikan)
  insert into stock_movements(store_id, product_id, nama_produk, tipe, jumlah, stok_akhir, catatan, oleh)
  select oi.store_id, oi.product_id, oi.nama_produk, 'masuk', oi.jumlah,
         (select stok from products where id = oi.product_id),
         'Pembatalan pesanan', 'sistem'
  from order_items oi
  where oi.order_id = p_order_id;

  update orders
     set status = 'dibatalkan', payment_status = 'cancel'
   where id = p_order_id;

  return true;
end $$;
