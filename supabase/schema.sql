-- =========================================================
-- KANTIN DIGITAL — Skema Database Supabase (PostgreSQL)
-- Jalankan di Supabase Dashboard > SQL Editor
-- =========================================================

-- Ekstensi UUID
create extension if not exists "pgcrypto";

-- ---------- KATEGORI ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  urutan int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- PRODUK ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  deskripsi text,
  harga int not null default 0,
  category_id uuid references categories(id) on delete set null,
  foto_url text,
  stok int not null default 0,
  tersedia boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- PESANAN ----------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  kode_pesanan text unique not null,
  nama_pelanggan text not null,
  no_hp text not null,
  catatan text,
  total int not null default 0,
  status text not null default 'menunggu_verifikasi',
  bukti_bayar_url text,
  alasan_tolak text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ITEM PESANAN ----------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  nama_produk text not null,
  harga int not null,
  jumlah int not null,
  catatan text
);

-- ---------- PENGATURAN KANTIN (baris tunggal) ----------
create table if not exists settings (
  id int primary key default 1,
  nama_kantin text not null default 'Kantin Digital',
  qris_image_url text,
  no_wa_admin text,
  jam_operasional text,
  alamat text,
  constraint settings_single_row check (id = 1)
);
insert into settings (id, nama_kantin) values (1, 'Kantin Digital')
on conflict (id) do nothing;

-- Update otomatis kolom updated_at pada orders
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

-- =========================================================
-- ROW LEVEL SECURITY
-- Pelanggan (anon) hanya boleh: baca produk/kategori/settings,
-- membuat pesanan + item. Admin (authenticated) boleh semua.
-- Operasi tulis sensitif (verifikasi, ubah status) dilakukan
-- lewat server route memakai service_role (bypass RLS).
-- =========================================================
alter table categories  enable row level security;
alter table products    enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table settings    enable row level security;

-- Baca publik untuk katalog
create policy "public read categories" on categories for select using (true);
create policy "public read products"   on products   for select using (true);
create policy "public read settings"   on settings   for select using (true);

-- Pelanggan boleh membuat pesanan & item (checkout)
create policy "public insert orders"      on orders      for insert with check (true);
create policy "public insert order_items" on order_items for insert with check (true);

-- Pelanggan boleh membaca pesanannya sendiri (via kode) — dfilter di aplikasi
create policy "public read orders"      on orders      for select using (true);
create policy "public read order_items" on order_items for select using (true);

-- Admin (authenticated) boleh kelola penuh
create policy "admin all categories"  on categories  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin all products"    on products    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin all settings"    on settings    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin update orders"   on orders      for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =========================================================
-- STORAGE BUCKETS (buat juga lewat Dashboard > Storage bila perlu)
--   products  : foto produk (publik)
--   qris      : gambar QRIS statis (publik)
--   payments  : bukti pembayaran (publik-read agar admin mudah lihat)
-- =========================================================
insert into storage.buckets (id, name, public) values
  ('products', 'products', true),
  ('qris', 'qris', true),
  ('payments', 'payments', true)
on conflict (id) do nothing;

-- Izin upload/baca untuk bucket
create policy "public read product img"  on storage.objects for select using (bucket_id = 'products');
create policy "admin write product img"  on storage.objects for insert with check (bucket_id = 'products' and auth.role() = 'authenticated');
create policy "admin update product img" on storage.objects for update using (bucket_id = 'products' and auth.role() = 'authenticated');
create policy "admin del product img"    on storage.objects for delete using (bucket_id = 'products' and auth.role() = 'authenticated');

create policy "public read qris"  on storage.objects for select using (bucket_id = 'qris');
create policy "admin write qris"  on storage.objects for insert with check (bucket_id = 'qris' and auth.role() = 'authenticated');
create policy "admin update qris" on storage.objects for update using (bucket_id = 'qris' and auth.role() = 'authenticated');

-- Bukti bayar: pelanggan (anon) boleh upload, publik boleh baca
create policy "public read payments"  on storage.objects for select using (bucket_id = 'payments');
create policy "public write payments" on storage.objects for insert with check (bucket_id = 'payments');

-- =========================================================
-- DATA CONTOH (opsional — hapus bila tidak perlu)
-- =========================================================
insert into categories (nama, urutan) values
  ('Makanan', 1), ('Minuman', 2), ('Snack', 3)
on conflict do nothing;
