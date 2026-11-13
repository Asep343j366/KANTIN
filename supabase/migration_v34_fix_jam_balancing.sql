-- =========================================================
-- migration_v34: Catatan "Balancing sistem dan dana periode Juli–Oktober" (J366)
-- dari v31 dipasang 31 Okt 23:00 WIB = 1 Nov 00:00 WITA → di perangkat ber-zona
-- WITA (Kaltim/Kalsel/Kaltara) terhitung NOVEMBER. Pindah ke 31 Okt 12:00 WIB
-- (tetap 31 Okt di WIB/WITA/WIT). Jumlah & saldo tidak berubah. Idempoten.
-- =========================================================
update public.journal
   set created_at = '2026-10-31 12:00:00+07'
 where id = '1383bcf9-4544-4824-8396-e85a9e6a5e74';
