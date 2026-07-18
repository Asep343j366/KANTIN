-- Data contoh produk (jalankan setelah schema.sql).
-- Ganti foto_url dengan URL gambar Anda sendiri bila perlu.
with c as (
  select
    (select id from categories where nama='Makanan' limit 1) as makanan,
    (select id from categories where nama='Minuman' limit 1) as minuman,
    (select id from categories where nama='Snack'   limit 1) as snack
)
insert into products (nama, deskripsi, harga, category_id, stok, tersedia, foto_url)
select * from (
  select 'Nasi Goreng Spesial', 'Nasi goreng telur + ayam', 15000, (select makanan from c), 20, true, null union all
  select 'Mie Ayam Bakso',      'Mie ayam dengan bakso',    13000, (select makanan from c), 20, true, null union all
  select 'Ayam Geprek',         'Ayam geprek sambal',       16000, (select makanan from c), 15, true, null union all
  select 'Es Teh Manis',        'Teh manis dingin',          5000, (select minuman from c), 50, true, null union all
  select 'Es Jeruk',            'Jeruk peras segar',         7000, (select minuman from c), 40, true, null union all
  select 'Kopi Susu',           'Kopi susu gula aren',      12000, (select minuman from c), 30, true, null union all
  select 'Pisang Goreng',       'Pisang goreng crispy (3pcs)', 8000, (select snack from c), 25, true, null union all
  select 'Roti Bakar',          'Roti bakar coklat keju',   10000, (select snack from c), 20, true, null
) as t;
