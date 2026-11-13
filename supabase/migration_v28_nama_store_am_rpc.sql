-- =========================================================
-- migration_v28:
--  1) stores.nama_store = nama store resmi per kode site (beda dari nama kantin
--     yang tampil ke pembeli). Diisi dari tabel site Informa.
--  2) RPC dashboard AM (agregasi di database → halaman AM jauh lebih ringan):
--     - am_area_dashboard(p_month 'YYYY-MM')
--     - am_store_dashboard(p_store, p_start, p_end)
--     Hanya untuk AM pemilik site tsb (atau admin platform). Tanggal = WIB.
-- Idempoten.
-- =========================================================
set search_path = public;

-- ---------- 1) Nama store ----------
alter table public.stores add column if not exists nama_store text;

update public.stores s set nama_store = v.nama
from (values
  ('J341', 'INFORMA Q MALL BANJARMASIN'),
  ('J359', 'INFORMA SAMARINDA SQUARE'),
  ('J373', 'INFORMA DUTA MALL BANJARMASIN'),
  ('J390', 'INFORMA PONTIANAK'),
  ('J31A', 'INFORMA LP BANJARMASIN'),
  ('J357', 'INFORMA LP BALIKPAPAN'),
  ('J366', 'INFORMA BIG MALL SAMARINDA'),
  ('J31B', 'INFORMA TARAKAN'),
  ('J30X', 'INFORMA DUTA M PLNGKRY')
) as v(kode, nama)
where upper(s.kode_site) = v.kode;

-- ---------- 2a) Dashboard Area (per bulan) ----------
create or replace function public.am_area_dashboard(p_month text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_sites text[];
  v_start date := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_end   date := (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_lo timestamptz; v_hi timestamptz;
  res jsonb;
begin
  select sites into v_sites from am_accounts where user_id = auth.uid();
  if v_sites is null then
    if is_platform_admin() then select array_agg(kode_site) into v_sites from stores;
    else return null; end if;
  end if;
  v_lo := (least(v_start, v_today))::timestamp at time zone 'Asia/Jakarta';
  v_hi := (greatest(v_end, v_today + 1))::timestamp at time zone 'Asia/Jakarta';

  with st as (
    select id, kode_site, nama, nama_store, status, is_trial from stores where kode_site = any (v_sites)
  ), o as (
    select o.id, o.store_id, o.total, (o.created_at at time zone 'Asia/Jakarta')::date as d
    from orders o join st on st.id = o.store_id
    where o.status = 'selesai' and o.created_at >= v_lo and o.created_at < v_hi
  ), li as (
    select o.store_id, o.d, oi.nama_produk, oi.jumlah, (oi.harga - coalesce(p.hpp, 0)) * oi.jumlah as laba
    from order_items oi join o on o.id = oi.order_id left join products p on p.id = oi.product_id
  ), kas as (
    select j.store_id,
      coalesce(sum(case when j.jenis = 'masuk' then j.jumlah else 0 end), 0) as masuk_all,
      coalesce(sum(case when j.jenis = 'keluar' then j.jumlah else 0 end), 0) as keluar_all,
      coalesce(sum(case when j.jenis = 'masuk' and (j.created_at at time zone 'Asia/Jakarta')::date >= v_start
                         and (j.created_at at time zone 'Asia/Jakarta')::date < v_end then j.jumlah else 0 end), 0) as masuk_bln,
      coalesce(sum(case when j.jenis = 'keluar' and (j.created_at at time zone 'Asia/Jakarta')::date >= v_start
                         and (j.created_at at time zone 'Asia/Jakarta')::date < v_end then j.jumlah else 0 end), 0) as keluar_bln
    from journal j join st on st.id = j.store_id group by j.store_id
  )
  select jsonb_build_object(
    'stores', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'kode_site', st.kode_site, 'nama', st.nama, 'nama_store', st.nama_store,
        'status', st.status, 'is_trial', st.is_trial,
        'omzet', (select coalesce(sum(total), 0) from o where o.store_id = st.id and o.d >= v_start and o.d < v_end),
        'trx',   (select count(*) from o where o.store_id = st.id and o.d >= v_start and o.d < v_end),
        'laba',  (select coalesce(sum(laba), 0) from li where li.store_id = st.id and li.d >= v_start and li.d < v_end),
        'omzet_hari', (select coalesce(sum(total), 0) from o where o.store_id = st.id and o.d = v_today),
        'trx_hari',   (select count(*) from o where o.store_id = st.id and o.d = v_today),
        'laba_hari',  (select coalesce(sum(laba), 0) from li where li.store_id = st.id and li.d = v_today),
        'saldo', coalesce(k.masuk_all - k.keluar_all, 0),
        'masuk', coalesce(k.masuk_bln, 0), 'keluar', coalesce(k.keluar_bln, 0)
      )) from st left join kas k on k.store_id = st.id), '[]'::jsonb),
    'trend', (select jsonb_agg(jsonb_build_object('date', to_char(g.d, 'YYYY-MM-DD'),
                'omzet', (select coalesce(sum(total), 0) from o where o.d = g.d)) order by g.d)
              from generate_series(v_start, v_end - 1, interval '1 day') as g0(t), lateral (select g0.t::date as d) g),
    'top', coalesce((select jsonb_agg(t) from (
              select nama_produk as label, sum(jumlah) as value from li
              where li.d >= v_start and li.d < v_end group by nama_produk order by 2 desc limit 10) t), '[]'::jsonb),
    'missing', coalesce((select jsonb_agg(x) from unnest(v_sites) x where x not in (select kode_site from st)), '[]'::jsonb)
  ) into res;
  return res;
end $$;
grant execute on function public.am_area_dashboard(text) to authenticated;

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
    'jurnal', coalesce((select jsonb_agg(x order by x.created_at desc) from (select * from jr order by created_at desc limit 300) x), '[]'::jsonb),
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
