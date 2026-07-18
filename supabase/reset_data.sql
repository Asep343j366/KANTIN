-- =========================================================
-- RESET DATA — Kosongkan seluruh data KECUALI akun user (auth)
-- Jalankan di Supabase > SQL Editor.
-- Akun login admin (auth.users) TIDAK tersentuh.
-- =========================================================

-- 1) Data transaksi, jurnal, & pergerakan stok
truncate table order_items, orders, journal, stock_movements restart identity cascade;

-- 2) Master data produk & kategori
--    (Hapus baris ini jika ingin MEMPERTAHANKAN daftar produk & kategori)
delete from products;
delete from categories;

-- 3) (Opsional) Reset pengaturan toko/QRIS ke kondisi awal.
--    Biarkan dikomentari jika ingin mempertahankan nama toko & gambar QRIS.
-- update settings set qris_image_url = null;

-- Selesai. Semua transaksi/laporan/stok kosong; akun user tetap ada.
