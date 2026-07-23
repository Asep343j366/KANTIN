-- =========================================================
-- MIGRASI v5 — Integrasi Casaku (QRIS dinamis + auto-verifikasi)
-- Jalankan di Supabase > SQL Editor SETELAH migration_v4.sql.
-- =========================================================

-- Kolom pelacak transaksi Casaku pada tabel orders
alter table orders add column if not exists payment_ref    text;                 -- transactionId dari Casaku (cth: CSK-...)
alter table orders add column if not exists payment_status text default 'pending'; -- pending | paid | failed
alter table orders add column if not exists amount_charged int;                  -- nominal dibayar (termasuk kode unik) — 0% fee
alter table orders add column if not exists paid_at        timestamptz;          -- waktu pembayaran dikonfirmasi

-- Index untuk pencarian cepat saat webhook masuk
create index if not exists idx_orders_payment_ref on orders (payment_ref);

-- =========================================================
-- Fungsi settle: tandai order lunas + kurangi stok, IDEMPOTEN.
-- Dipanggil server (service_role) dari /api/pay/webhook HANYA
-- setelah status "settled" diverifikasi ulang ke Louvin.
-- Mengembalikan true bila order baru saja berpindah ke "paid"
-- (false bila tidak ditemukan atau sudah lunas sebelumnya).
-- =========================================================
-- Drop versi lama (mis. parameter p_net dari iterasi sebelumnya) agar
-- bisa dibuat ulang dengan nama parameter baru.
drop function if exists mark_order_paid(text, int);

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

  if v_order_id is null then
    return false; -- tidak ada / sudah lunas → jangan proses ulang (anti dobel-kurang stok)
  end if;

  -- Kurangi stok sesuai item pesanan (tidak boleh minus)
  update products p
     set stok = greatest(0, p.stok - oi.jumlah)
    from order_items oi
   where oi.order_id = v_order_id
     and oi.product_id = p.id;

  return true;
end;
$$ language plpgsql security definer;
