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

-- ---------- 3) mark_order_paid TANPA kurang stok ----------
-- Stok sudah dikurangi trigger trg_decrement_stock saat order_items INSERT
-- (order dibuat/pending). Mengurangi lagi di sini = dobel. Cukup settle.
create or replace function mark_order_paid(p_payment_ref text, p_amount int)
returns boolean as $$
declare
  v_order_id uuid;
begin
  update orders
     set payment_status = 'paid',
         status         = 'selesai',
         paid_at        = now(),
         amount_charged = coalesce(p_amount, amount_charged)
   where payment_ref = p_payment_ref
     and payment_status <> 'paid'
   returning id into v_order_id;

  -- true bila baru saja berpindah ke paid; stok TIDAK disentuh di sini.
  return v_order_id is not null;
end;
$$ language plpgsql security definer;

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
