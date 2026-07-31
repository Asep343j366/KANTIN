-- =========================================================
-- MIGRASI v10 — Multi-Store (Fase 4: Pembayaran per Store)
-- Jalankan di Supabase > SQL Editor SETELAH migration_v9_rls_multistore.sql.
--
-- store_payment_config: config pembayaran per store (mode + rahasia Casaku).
--   RLS AKTIF TANPA POLICY -> hanya service_role (server) yang bisa akses.
--   Rahasia (license_key/webhook_secret) TIDAK PERNAH dibaca dari client.
-- settings.info_rekening: info tampilan pembayaran manual (public read).
-- Idempoten.
-- =========================================================

create table if not exists store_payment_config (
  store_id uuid primary key references stores(id) on delete cascade,
  mode text not null default 'manual',        -- 'casaku' (otomatis) | 'manual'
  -- Field mode Casaku (RAHASIA):
  license_key text,
  qr_id text,
  webhook_secret text,
  package_ids text default 'id.dana',
  expire_minutes int default 1440,
  base_url text default 'https://api.casaku.id',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- RLS aktif tanpa policy = default deny untuk anon & authenticated.
-- Hanya service_role (server route: pay/create, webhook, admin/payment-config) yang akses.
alter table store_payment_config enable row level security;

-- Info tampilan pembayaran MANUAL (bukan rahasia) — di settings (public read).
alter table settings add column if not exists info_rekening text;

-- Catatan: store yang BELUM punya baris di store_payment_config akan
-- di-fallback oleh server ke ENV Casaku (agar J366 lama tetap jalan tanpa config).
