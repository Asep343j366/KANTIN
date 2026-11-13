-- =========================================================
-- migration_v29: Dashboard Store AM — tabel Jurnal Kas menampilkan hingga 2000
-- catatan per periode (sebelumnya 300; satu bulan bisa > 300 catatan).
-- Hanya mengganti fungsi am_store_dashboard. Idempoten.
-- =========================================================
set search_path = public;

-- ---------- 2b) Dashboard Store (rentang tanggal) ----------
create or replace function public.am_store_dashboard(p_store uuid, p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_m0 date := date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date;
  v_lo timestamptz; v_hi timestamptz;
  res jsonb;
begin
  if not (am_can_read_store(p_store) or is_platform_admin()) then return null; end if;
  v_lo := (least(p_start, v_m0))::timestamp at time zone 'Asia/Jakarta';
  v_hi := (greatest(p_end, v_today) + 1)::timestamp at time zone 'Asia/Jakarta';

  with o as (
    select o.id, o.total, (o.created_at at time zone 'Asia/Jakarta')::date as d
    from orders o where o.store_id = p_store and o.status = 'selesai' and o.created_at >= v_lo and o.created_at < v_hi
  ), li as (
    select o.d, oi.product_id, oi.nama_produk, oi.jumlah, oi.harga * oi.jumlah as subtotal,
           (oi.harga - coalesce(p.hpp, 0)) * oi.jumlah as laba
    from order_items oi join o on o.id = oi.order_id left join products p on p.id = oi.product_id
  ), lp as (select * from li where d between p_start and p_end),
  op as (select * from o where d between p_start and p_end),
  jr as (
    select j.id, j.created_at, j.jenis, j.kategori, j.keterangan, j.jumlah
    from journal j where j.store_id = p_store
      and j.created_at >= (p_start::timestamp at time zone 'Asia/Jakarta')
      and j.created_at < ((p_end + 1)::timestamp at time zone 'Asia/Jakarta')
  )
  select jsonb_build_object(
    'hari',  jsonb_build_object('omzet', (select coalesce(sum(total),0) from o where d = v_today), 'trx', (select count(*) from o where d = v_today),
                                'laba', (select coalesce(sum(laba),0) from li where d = v_today)),
    'bulan', jsonb_build_object('omzet', (select coalesce(sum(total),0) from o where d >= v_m0), 'trx', (select count(*) from o where d >= v_m0),
                                'laba', (select coalesce(sum(laba),0) from li where d >= v_m0)),
    'periode', jsonb_build_object(
        'omzet', (select coalesce(sum(total),0) from op), 'trx', (select count(*) from op),
        'qty', (select coalesce(sum(jumlah),0) from lp), 'sku', (select count(distinct product_id) from lp),
        'laba', (select coalesce(sum(laba),0) from lp),
        'avg_basket', (select coalesce(round(avg(total)),0) from op)),
    'saldo', (select coalesce(sum(case when jenis='masuk' then jumlah else -jumlah end),0) from journal where store_id = p_store),
    'total_produk', (select count(*) from products where store_id = p_store),
    'kas', jsonb_build_object(
        'masuk', (select coalesce(sum(jumlah),0) from jr where jenis = 'masuk'),
        'keluar', (select coalesce(sum(jumlah),0) from jr where jenis = 'keluar'),
        'count', (select count(*) from jr)),
    'jurnal', coalesce((select jsonb_agg(x order by x.created_at desc) from (select * from jr order by created_at desc limit 2000) x), '[]'::jsonb),
    'top_qty', coalesce((select jsonb_agg(t) from (select product_id as key, max(nama_produk) as label, sum(jumlah) as value from lp group by product_id order by 3 desc limit 10) t), '[]'::jsonb),
    'top_total', coalesce((select jsonb_agg(t) from (select product_id as key, max(nama_produk) as label, sum(subtotal) as value from lp group by product_id order by 3 desc limit 10) t), '[]'::jsonb),
    'trend', (select jsonb_agg(jsonb_build_object('date', to_char(g.d, 'YYYY-MM-DD'),
                'omzet', (select coalesce(sum(total),0) from op where op.d = g.d),
                'qty', (select coalesce(sum(jumlah),0) from lp where lp.d = g.d)) order by g.d)
              from generate_series(p_start, p_end, interval '1 day') as g0(t), lateral (select g0.t::date as d) g)
  ) into res;
  return res;
end $$;
grant execute on function public.am_store_dashboard(uuid, date, date) to authenticated;
