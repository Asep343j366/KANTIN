-- =========================================================
-- migration_v31: Koreksi TANGGAL catatan kas manual J366 yang diinput 12–13 Nov 2026
-- tetapi terjadi di September/Oktober (keterangan menyebut tanggal aslinya, atau
-- pasangan koreksi dari catatan 8 Sep). Hanya created_at yang diubah → JUMLAH &
-- SALDO AKHIR TIDAK BERUBAH (dicek di bagian bawah).
-- Keputusan user (13 Nov 2026): Supabase 461.700, refund 176.800 & 34.300,
-- belanja 208.000 (12 Nov) & 1.628.720 (6 Nov), sisa loker 180.000 → TETAP November.
-- Idempoten (menimpa ke tanggal yang sama).
-- =========================================================
set search_path = public;

update public.journal j
   set created_at = v.tgl::timestamptz
  from (values
    ('4b328552-2939-4fad-884f-100a446fe1a6'::uuid, '2026-09-06 12:00:00+07'), -- keluar 1.707.725 Belanja stock Indo Grosir 06 Sep
    ('b222abc1-4b76-4c39-88ae-3f76781ec7d0'::uuid, '2026-09-06 12:00:00+07'), -- masuk  208.920 Pengembalian trx Indogrosir 6 Sep
    ('c2a837e1-62b5-4d6b-969e-28547e3b68e7'::uuid, '2026-09-08 12:00:00+07'), -- masuk  758.500 Transfer salah input keluar jurnal Sept
    ('4dfb343a-2cc5-4490-9a8d-2d1471e4db51'::uuid, '2026-09-08 12:00:00+07'), -- keluar 758.500 Belanja bulanan (input ulang)
    ('6d41eb7a-128f-45e3-ad08-9514de8fae58'::uuid, '2026-09-08 12:00:00+07'), -- masuk  445.500 Pengembalian salah jurnal
    ('cb06e5af-dd10-49ae-9fdf-24cf2f26b304'::uuid, '2026-09-08 12:00:00+07'), -- keluar 445.500 Belanaj bulanan (input ulang)
    ('da47f39f-394a-4515-a134-0c183f2b4103'::uuid, '2026-09-14 12:00:00+07'), -- keluar 186.000 Branding Sempaja 14 Sep
    ('2c56dd7b-1e1b-4d4a-a6f8-6aff9cf18bba'::uuid, '2026-10-04 12:00:00+07'), -- keluar 1.344.975 Total belanja 4 Okt
    ('dec5ad6e-57ac-4f78-b88d-335e70c17601'::uuid, '2026-10-04 12:00:00+07'), -- masuk  231.150 Pengembalian Indogrosir Oktober
    ('1383bcf9-4544-4824-8396-e85a9e6a5e74'::uuid, '2026-10-31 23:00:00+07')  -- keluar 152.847 Balancing Juli–Oktober
  ) as v(id, tgl)
 where j.id = v.id;

-- Cek: saldo akhir per toko (masuk − keluar seluruh waktu) — harus SAMA dengan sebelum migrasi.
select s.kode_site,
       sum(case when j.jenis = 'masuk' then j.jumlah else -j.jumlah end) as saldo_akhir,
       count(*) as jumlah_catatan
  from public.journal j join public.stores s on s.id = j.store_id
 group by s.kode_site order by s.kode_site;
