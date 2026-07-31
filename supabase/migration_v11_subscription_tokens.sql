-- =========================================================
-- MIGRASI v11 — Multi-Store (Fase 5: Token Langganan Manual)
-- Jalankan di Supabase > SQL Editor SETELAH migration_v10_payment_config.sql.
--
-- Langganan tanpa payment gateway: platform-admin (J366) generate kode token,
-- owner store menukarkannya untuk memperpanjang stores.langganan_until.
-- Cron harian menyetel status aktif/grace/nonaktif. Idempoten.
-- =========================================================

-- ---------- TABEL TOKEN ----------
create table if not exists subscription_tokens (
  code text primary key,                 -- cth: KTN-9F3A-2K7Q
  durasi_hari int not null,              -- 30 / 90 / 365 dst
  status text not null default 'aktif',  -- aktif | terpakai
  redeemed_by_store uuid references stores(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
-- RLS aktif tanpa policy = server-only (route service_role). Kode tak boleh bocor ke publik.
alter table subscription_tokens enable row level security;

-- ---------- REDEEM (idempoten, transaksional) ----------
create or replace function redeem_subscription_token(p_code text, p_store uuid)
returns timestamptz language plpgsql security definer as $$
declare v_days int; v_new timestamptz;
begin
  select durasi_hari into v_days
    from subscription_tokens
   where code = p_code and status = 'aktif'
   for update;
  if v_days is null then
    raise exception 'Kode tidak valid atau sudah dipakai';
  end if;

  update subscription_tokens
     set status = 'terpakai', redeemed_by_store = p_store, redeemed_at = now()
   where code = p_code;

  -- Perpanjang dari sisa masa aktif (bila masih ada) atau dari sekarang.
  update stores
     set langganan_until = greatest(coalesce(langganan_until, now()), now()) + (v_days || ' days')::interval,
         status = 'aktif'
   where id = p_store
   returning langganan_until into v_new;

  return v_new;
end $$;

-- ---------- REFRESH STATUS (dipanggil cron harian) ----------
-- Platform-admin (J366) selalu aktif. Store 'suspended' (manual) tak diubah.
-- grace = 3 hari setelah langganan_until habis, lalu nonaktif.
create or replace function refresh_subscription_status()
returns void language plpgsql security definer as $$
begin
  update stores set status = case
    when is_platform_admin then 'aktif'
    when langganan_until is null then 'nonaktif'
    when now() < langganan_until then 'aktif'
    when now() < langganan_until + interval '3 days' then 'grace'
    else 'nonaktif'
  end
  where status <> 'suspended';
end $$;
