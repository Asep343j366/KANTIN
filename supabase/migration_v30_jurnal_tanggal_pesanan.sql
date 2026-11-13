-- =========================================================
-- migration_v30: Jurnal "Penjualan" mengikuti TANGGAL PESANAN.
--
-- Masalah: pesanan lama yang baru ditandai lunas belakangan (mis. "Tandai Lunas"
-- massal di menu Menunggu) tercatat di jurnal pada tanggal pelunasan → uang masuk
-- bulan itu membengkak & tidak sejalan dengan omzet (omzet memakai tanggal pesanan).
--
-- 1) mark_order_paid: bila pelunasan terjadi > 1 hari setelah pesanan dibuat,
--    entri jurnal "Penjualan" memakai tanggal PESANAN (bukan hari pelunasan).
--    Pelunasan normal (hari yang sama) tetap memakai waktu sekarang.
-- 2) KOREKSI DATA: entri jurnal "Penjualan" otomatis (dicatat_oleh='sistem')
--    yang tanggalnya > 1 hari setelah tanggal pesanan → dipindah ke tanggal pesanan.
--    Saldo kas TOTAL tidak berubah (hanya tanggal/bulan pencatatan yang pindah).
--    Catatan manual (belanja, setoran, dll.) TIDAK disentuh.
--
-- Perkiraan saat dibuat (13 Nov 2026): J366 463 catatan, J357 385, J31A 72,
-- J31B 14, J359 5. Idempoten (aman dijalankan ulang).
-- =========================================================
set search_path = public;

-- ---------- 1) Fungsi pelunasan ----------
create or replace function mark_order_paid(p_payment_ref text, p_amount int)
returns boolean as $$
declare
  v_order orders%rowtype;
begin
  update orders
     set payment_status = 'paid',
         status         = 'selesai',
         paid_at        = now(),
         amount_charged = coalesce(p_amount, amount_charged)
   where payment_ref = p_payment_ref
     and payment_status <> 'paid'
   returning * into v_order;

  if v_order.id is null then
    return false; -- tidak ada / sudah lunas → jangan proses ulang
  end if;

  -- Jurnal "Masuk — Penjualan" (idempoten: hanya bila belum ada utk order ini).
  -- Pelunasan terlambat (> 1 hari) → dicatat di tanggal pesanan.
  insert into journal(store_id, jenis, kategori, keterangan, jumlah, dicatat_oleh, order_id, created_at)
  select v_order.store_id, 'masuk', 'Penjualan',
         'Penjualan ' || v_order.kode_pesanan || ' (' || v_order.nama_pelanggan || ')',
         v_order.total, 'sistem', v_order.id,
         case when now() - v_order.created_at > interval '1 day' then v_order.created_at else now() end
  where not exists (select 1 from journal j where j.order_id = v_order.id);

  return true;
end;
$$ language plpgsql security definer;

-- ---------- 2) Koreksi data lama ----------
update journal j
   set created_at = o.created_at
  from orders o
 where j.order_id = o.id
   and j.kategori = 'Penjualan'
   and j.dicatat_oleh = 'sistem'
   and j.created_at - o.created_at > interval '1 day'
   -- Hanya J366? Aktifkan baris di bawah (hapus tanda --):
   -- and j.store_id = (select id from stores where kode_site = 'J366')
;
