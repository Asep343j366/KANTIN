-- =========================================================
-- MIGRASI v13 — Toko Demo (view-only untuk landing "Lihat Demo")
-- Jalankan di Supabase > SQL Editor SETELAH migration_v12_platform_settings.sql.
--
-- is_demo: toko demo bisa dilihat publik tapi TIDAK menerima transaksi,
-- dan tidak tunduk pada langganan (selalu aktif). Idempoten.
-- =========================================================

alter table stores add column if not exists is_demo boolean not null default false;

-- Blok pembuatan order pada toko demo (enforce di DB, bukan cuma UI).
create or replace function block_demo_orders()
returns trigger language plpgsql as $$
declare v_demo boolean;
begin
  select is_demo into v_demo from stores where id = new.store_id;
  if v_demo then
    raise exception 'Toko demo tidak menerima transaksi';
  end if;
  return new;
end $$;

drop trigger if exists trg_block_demo_orders on orders;
create trigger trg_block_demo_orders before insert on orders
  for each row execute function block_demo_orders();

-- Toko demo & platform-admin selalu aktif (tak tunduk langganan).
create or replace function refresh_subscription_status()
returns void language plpgsql security definer as $$
begin
  update stores set status = case
    when is_platform_admin or is_demo then 'aktif'
    when langganan_until is null then 'nonaktif'
    when now() < langganan_until then 'aktif'
    when now() < langganan_until + interval '3 days' then 'grace'
    else 'nonaktif'
  end
  where status <> 'suspended';
end $$;
