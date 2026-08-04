-- =========================================================
-- MIGRASI v15 — Langganan OTOMATIS (self-service + QRIS Casaku ke akun J366)
-- Jalankan di Supabase > SQL Editor SETELAH migration_v14_fixes.sql. Idempoten.
--
-- Isi:
--  1) stores.is_trial            — tandai masa percobaan (badge countdown).
--  2) platform_settings          — harga & durasi voucher langganan (diatur J366).
--  3) subscription_orders        — pesanan pembayaran langganan (TERPISAH dari
--                                  orders storefront; tak masuk transaksi store).
--  4) journal.sub_order_id       — telusur entri jurnal langganan J366.
-- =========================================================

-- Pastikan resolusi nama tabel ke schema public (hindari error "relation ...
-- does not exist" bila search_path SQL Editor tak menyertakan public).
set search_path = public;

-- ---------- 1) FLAG TRIAL ----------
alter table public.stores add column if not exists is_trial boolean not null default false;

-- ---------- 2) HARGA & DURASI VOUCHER (diatur platform-admin J366) ----------
alter table public.platform_settings add column if not exists langganan_harga int;             -- nominal ditagih via QRIS (angka)
alter table public.platform_settings add column if not exists langganan_durasi_hari int default 120; -- 4 bulan

-- ---------- 3) PESANAN LANGGANAN ----------
create table if not exists public.subscription_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  amount int not null,                    -- harga layanan (base, utk jurnal)
  amount_charged int,                     -- nominal unik Casaku (yg benar2 dibayar)
  durasi_hari int not null,               -- durasi langganan yg diperpanjang
  payment_ref text,                       -- transactionId Casaku (akun J366)
  status text not null default 'pending', -- pending | paid | expired | cancel
  token_code text,                        -- voucher yang diterbitkan otomatis
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_suborders_store on public.subscription_orders(store_id);
create index if not exists idx_suborders_ref on public.subscription_orders(payment_ref);
create index if not exists idx_suborders_status on public.subscription_orders(status);

-- RLS aktif TANPA policy = server-only (semua akses lewat route service_role).
alter table public.subscription_orders enable row level security;

-- ---------- 4) TELUSUR JURNAL LANGGANAN ----------
alter table public.journal add column if not exists sub_order_id uuid references public.subscription_orders(id) on delete set null;
