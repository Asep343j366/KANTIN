-- =========================================================
-- migration_v33: Laba (omzet − HPP) per bulan untuk menu Jurnal admin.
-- store_laba_bulanan() → [{bulan:'YYYY-MM', omzet, laba}] untuk store milik
-- user yang login (current_store_id()). Order SELESAI, bulan menurut WIB,
-- laba = (harga jual − HPP produk) × qty (sama dengan menu Laporan).
-- Idempoten.
-- =========================================================
set search_path = public;

create or replace function public.store_laba_bulanan()
returns jsonb language sql stable security definer set search_path = public as $$
  with o as (
    select o.id, o.total, to_char(o.created_at at time zone 'Asia/Jakarta', 'YYYY-MM') as bulan
    from orders o
    where o.store_id = current_store_id() and o.status = 'selesai'
  ), l as (
    select o.bulan, sum((oi.harga - coalesce(p.hpp, 0)) * oi.jumlah) as laba
    from order_items oi join o on o.id = oi.order_id left join products p on p.id = oi.product_id
    group by o.bulan
  ), om as (select bulan, sum(total) as omzet from o group by bulan)
  select coalesce(jsonb_agg(jsonb_build_object('bulan', om.bulan, 'omzet', om.omzet, 'laba', coalesce(l.laba, 0)) order by om.bulan), '[]'::jsonb)
  from om left join l on l.bulan = om.bulan;
$$;
grant execute on function public.store_laba_bulanan() to authenticated;
