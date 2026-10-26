-- =========================================================
-- migration_v18: Enable Supabase Realtime untuk tabel orders
-- Agar perubahan status order (Casaku webhook & settle manual admin)
-- terkirim INSTAN ke halaman pembayaran (/s/<slug>/checkout step 2),
-- halaman status (/order/[code]), dan Kantin TV (/s/<slug>/tv).
--
-- replica identity full WAJIB: agar filter realtime pada UPDATE bisa
-- memakai kolom non-PK (kode_pesanan, store_id). Tanpa ini, event UPDATE
-- yang difilter per kode/store tidak terkirim.
-- Idempoten — aman dijalankan ulang.
-- =========================================================
set search_path = public;

-- 1) Masukkan orders ke publication realtime (bila belum).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- 2) Replica identity full agar payload UPDATE membawa kolom filter.
alter table public.orders replica identity full;
