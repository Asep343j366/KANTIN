# PRD — Aplikasi PWA Kantin Digital

**Dokumen:** Product Requirements Document (PRD)
**Produk:** Kantin PWA — Pemesanan & Pembayaran Online
**Versi:** 1.1 (Draft)
**Tanggal:** 18 Juli 2026
**Pemilik Produk:** ASEP
**Referensi fitur:** setoko.co/ekantininformabm (model storefront kantin)
**Referensi desain:** majoo.id (gaya fresh, clean, modern)

---

## 1. Ringkasan Eksekutif

Kantin PWA adalah aplikasi web progresif (Progressive Web App) yang memungkinkan pelanggan memesan makanan & minuman dari kantin secara online, membayar menggunakan **QRIS statis** (dengan mengunggah foto/screenshot bukti pembayaran), lalu **mengambil pesanan langsung di kantin (pickup)**.

Aplikasi ini menggantikan alur pemesanan manual (antre / chat WhatsApp) dengan katalog digital yang rapi, keranjang belanja, dan sistem verifikasi pembayaran oleh admin — tanpa perlu integrasi API payment gateway, sehingga biaya operasional rendah dan cepat diluncurkan.

**Nilai utama:**
- Pelanggan pesan tanpa antre, tanpa perlu buat akun (guest checkout).
- Pembayaran cukup scan QRIS statis + unggah bukti transfer.
- Admin kantin mengelola produk dan memverifikasi pembayaran dari satu dashboard.
- Bisa di-*install* ke home screen HP layaknya aplikasi native (PWA).

---

## 2. Latar Belakang & Masalah

Kantin saat ini melayani pesanan secara manual (antre di kasir atau via WhatsApp), yang menimbulkan masalah:

- Antrean panjang pada jam sibuk (istirahat/makan siang).
- Kesalahan pencatatan pesanan.
- Sulit melacak status pembayaran dan rekap penjualan.
- Tidak ada katalog produk yang jelas beserta harga dan ketersediaan stok.

Situs referensi (Setoko) menyediakan katalog produk online namun mengandalkan pemesanan lewat WhatsApp tanpa keranjang & checkout terstruktur. Produk ini meningkatkan pengalaman tersebut dengan alur pesan-bayar-ambil yang lengkap di dalam satu aplikasi.

---

## 3. Tujuan & Metrik Keberhasilan

**Tujuan produk:**
1. Mengurangi waktu antre pemesanan.
2. Menyediakan katalog digital yang selalu ter-update (stok & harga).
3. Menyederhanakan pembayaran tanpa payment gateway berbiaya.
4. Memberi admin rekap penjualan otomatis.

**Metrik keberhasilan (KPI):**
- ≥ 60% pesanan dilakukan lewat aplikasi dalam 3 bulan.
- Rata-rata waktu checkout < 90 detik.
- Rasio pembayaran terverifikasi < 5 menit sejak upload bukti.
- Tingkat pesanan gagal/batal < 5%.
- Skor kepuasan pengguna (CSAT) ≥ 4/5.

---

## 4. Persona & Peran Pengguna

| Peran | Deskripsi | Kebutuhan utama |
|-------|-----------|-----------------|
| **Pelanggan (Guest)** | Siswa/karyawan/umum yang memesan. Tidak perlu akun. | Lihat menu, pesan cepat, bayar mudah, tahu kapan pesanan siap diambil. |
| **Admin Kantin** | Satu pengelola kantin. | Kelola produk & stok, verifikasi bukti bayar, kelola status pesanan, lihat rekap. |

*Catatan: Arsitektur disiapkan agar mudah dikembangkan ke multi-penjual di masa depan, namun MVP hanya 1 admin.*

---

## 5. Ruang Lingkup

### 5.1 Termasuk dalam MVP (In Scope)
- Katalog produk dengan kategori, foto, harga, deskripsi, status stok.
- Pencarian & filter produk.
- Keranjang belanja (cart).
- Checkout guest (nama + no. HP, tanpa akun).
- Pembayaran QRIS statis + unggah bukti pembayaran.
- Nomor antrean / kode pesanan untuk pickup.
- **Struk digital** (e-receipt) yang bisa dilihat, disimpan, dan dibagikan.
- Dashboard admin: kelola produk, verifikasi pembayaran, kelola status pesanan.
- Notifikasi status pesanan (di halaman & opsional WhatsApp manual).
- Kapabilitas PWA (installable, offline shell, ikon home screen).

### 5.2 Tidak Termasuk (Out of Scope MVP)
- Integrasi API QRIS dinamis / payment gateway otomatis.
- Pengantaran (delivery) — hanya pickup.
- Multi-penjual / multi-tenant.
- Program loyalti, poin, voucher (dipertimbangkan fase berikutnya).
- Aplikasi native iOS/Android di app store.

---

## 6. Alur Pengguna (User Flows)

### 6.1 Alur Pelanggan
1. Buka aplikasi (web / ikon PWA di home screen).
2. Lihat katalog → cari/filter produk berdasarkan kategori.
3. Buka detail produk → pilih jumlah / catatan (mis. "tidak pedas") → **Tambah ke Keranjang**.
4. Buka keranjang → tinjau item & total → **Checkout**.
5. Isi data pickup: nama, nomor HP, catatan (opsional).
6. Halaman pembayaran menampilkan **QRIS statis** kantin + nominal yang harus dibayar.
7. Pelanggan scan QRIS dengan m-banking/e-wallet, lakukan pembayaran.
8. Pelanggan **unggah foto/screenshot bukti pembayaran**.
9. Sistem membuat pesanan berstatus **"Menunggu Verifikasi"** dan menampilkan **kode pesanan**.
10. Setelah admin verifikasi → status berubah menjadi **"Diproses" → "Siap Diambil"**. Sistem menerbitkan **struk digital**.
11. Pelanggan membuka/mengunduh struk digital dan menunjukkan kode pesanan di kantin untuk mengambil pesanan.

### 6.2 Alur Admin
1. Login ke dashboard admin.
2. Kelola produk (tambah/edit/hapus, atur stok & status tersedia/habis).
3. Terima notifikasi pesanan masuk.
4. Buka detail pesanan → lihat bukti pembayaran yang diunggah.
5. **Verifikasi** (Setujui / Tolak) pembayaran.
6. Ubah status pesanan: Diproses → Siap Diambil → Selesai.
7. Lihat rekap penjualan harian.

---

## 7. Kebutuhan Fungsional

### 7.1 Katalog & Produk
- FR-1: Menampilkan daftar produk dengan foto, nama, harga, kategori, status stok.
- FR-2: Mengelompokkan produk per kategori (mis. Makanan, Minuman, Snack).
- FR-3: Pencarian produk berdasarkan nama.
- FR-4: Halaman detail produk (deskripsi, foto, harga, tombol tambah ke keranjang, field catatan).
- FR-5: Produk habis stok ditandai dan tidak bisa dipesan.

### 7.2 Keranjang & Checkout
- FR-6: Tambah/ubah jumlah/hapus item di keranjang.
- FR-7: Keranjang bertahan selama sesi (localStorage) meski refresh.
- FR-8: Ringkasan total harga otomatis.
- FR-9: Checkout guest: input nama & nomor HP (validasi format HP), catatan opsional.

### 7.3 Pembayaran QRIS Statis
- FR-10: Menampilkan gambar QRIS statis kantin (dikelola admin) + nominal total.
- FR-11: Pelanggan wajib mengunggah 1 file bukti pembayaran (JPG/PNG, maks. 5 MB).
- FR-12: Validasi file (tipe & ukuran) sebelum submit.
- FR-13: Pesanan tercatat dengan status awal "Menunggu Verifikasi".
- FR-14: Menampilkan kode pesanan unik setelah submit.

### 7.4 Manajemen Pesanan (Admin)
- FR-15: Daftar pesanan masuk dengan filter berdasarkan status.
- FR-16: Melihat bukti pembayaran (perbesar gambar).
- FR-17: Aksi verifikasi: Setujui / Tolak (dengan alasan).
- FR-18: Ubah status: Menunggu Verifikasi → Diproses → Siap Diambil → Selesai / Dibatalkan.
- FR-19: Rekap penjualan (jumlah pesanan & total pendapatan per hari).

### 7.5 Manajemen Produk (Admin)
- FR-20: CRUD produk (nama, harga, foto, kategori, deskripsi, stok).
- FR-21: Unggah foto produk ke storage.
- FR-22: Atur ketersediaan (tersedia/habis).
- FR-23: Kelola gambar QRIS statis kantin & info kantin.

### 7.6 Struk Digital (E-Receipt)
- FR-24: Setelah pembayaran terverifikasi, sistem menerbitkan struk digital berisi: nama & logo kantin, kode pesanan, tanggal/waktu, nama pelanggan, rincian item (nama, jumlah, harga), total, metode pembayaran (QRIS), dan status "LUNAS".
- FR-25: Struk dapat dilihat di halaman status pesanan, diunduh sebagai PDF/gambar, dan dibagikan (mis. via WhatsApp/share sheet).
- FR-26: Struk dapat diakses ulang kapan saja lewat kode pesanan.

### 7.7 Notifikasi & Status
- FR-27: Pelanggan bisa memantau status pesanan lewat halaman status (via kode pesanan).
- FR-28: (Opsional) Tautan cepat WhatsApp ke admin untuk konfirmasi.

### 7.8 PWA
- FR-29: Manifest + service worker agar dapat di-install ke home screen.
- FR-30: Offline shell (halaman utama tetap tampil saat koneksi buruk).
- FR-31: Ikon aplikasi, splash screen, tema warna.

---

## 8. Kebutuhan Non-Fungsional

- **Performa:** Halaman utama tampil < 3 detik pada koneksi 4G. Lighthouse PWA score ≥ 90.
- **Responsif:** Mobile-first, optimal di HP; tetap rapi di desktop.
- **Keamanan:** Dashboard admin dilindungi autentikasi. File upload divalidasi & disimpan aman. Proteksi dasar terhadap spam order.
- **Ketersediaan:** Uptime ≥ 99%.
- **Skalabilitas:** Arsitektur siap dikembangkan ke multi-tenant.
- **Aksesibilitas:** Kontras warna & ukuran teks memadai.
- **Bahasa:** Antarmuka Bahasa Indonesia.

---

## 9. Panduan Desain & UI (Referensi: majoo.id)

Arah visual: **fresh, clean, modern, dan terpercaya** — mengikuti gaya majoo yang lapang dan minim clutter, dioptimalkan untuk mobile-first.

**Prinsip desain**
- Banyak *whitespace*, tata letak lega, mudah dipindai (scannable).
- Berbasis *card* dengan sudut membulat (rounded) dan bayangan lembut (soft shadow).
- Hierarki jelas: judul tebal, teks pendukung netral, satu CTA utama yang menonjol per layar.
- Konsisten, ikon garis (line icon) rapi, foto produk berkualitas.

**Palet warna (usulan awal, dapat disesuaikan)**
- Primer: Biru cerah (mis. `#1B6FEB` / biru majoo-esque) untuk tombol utama, header, aksen.
- Latar: Putih `#FFFFFF` dan abu sangat muda `#F5F7FA` untuk seksi/kartu.
- Teks: Abu gelap `#1E2A3A` (utama), abu `#64748B` (sekunder).
- Status: Hijau `#22C55E` (sukses/lunas), Kuning `#F59E0B` (menunggu), Merah `#EF4444` (ditolak/batal).

**Tipografi**
- Sans-serif modern (mis. Inter / Plus Jakarta Sans — cocok untuk konteks Indonesia).
- Skala ukuran jelas antara judul, subjudul, dan body.

**Komponen kunci**
- Kartu produk: foto, nama, harga menonjol, badge stok, tombol "+" tambah cepat.
- Tombol: primer terisi penuh (filled) warna primer; sekunder outline/teks.
- Bottom navigation (mobile) untuk akses cepat: Katalog, Keranjang, Status Pesanan.
- Struk digital: layout bersih ala nota, logo di atas, garis pemisah tipis, badge "LUNAS".
- *Micro-interaction* halus (transisi tambah keranjang, toast konfirmasi).

**Aksesibilitas**: kontras warna memadai (WCAG AA), target sentuh ≥ 44px.

---

## 10. Arsitektur & Teknologi

**Stack yang dipilih: Next.js + Supabase**

| Lapisan | Teknologi | Fungsi |
|---------|-----------|--------|
| Frontend | Next.js (App Router) + React | UI, routing, rendering PWA |
| Styling | Tailwind CSS | Desain responsif cepat |
| PWA | next-pwa / service worker + manifest | Installable & offline shell |
| Backend/DB | Supabase (PostgreSQL) | Database pesanan, produk, dsb. |
| Auth | Supabase Auth | Login admin |
| Storage | Supabase Storage | Foto produk, QRIS, bukti bayar |
| Realtime | Supabase Realtime | Update status pesanan real-time di dashboard |
| Hosting | Vercel | Deploy frontend + serverless |

**Alasan:** Cepat dibangun, gratis/murah di skala awal, auth + database + storage terintegrasi, PWA-ready, dan mudah di-scale.

---

## 11. Model Data (Ringkas)

**products**
- id, nama, deskripsi, harga, kategori_id, foto_url, stok, tersedia (bool), created_at

**categories**
- id, nama, urutan

**orders**
- id, kode_pesanan, nama_pelanggan, no_hp, catatan, total, status, bukti_bayar_url, alasan_tolak, created_at, updated_at

**order_items**
- id, order_id, product_id, nama_produk, harga, jumlah, catatan

**settings**
- id, nama_kantin, qris_image_url, no_wa_admin, jam_operasional

**admin (Supabase Auth)**
- user admin tunggal

**Status pesanan (enum):** `menunggu_verifikasi` → `diproses` → `siap_diambil` → `selesai` | `dibatalkan`

---

## 12. Halaman / Layar

**Sisi Pelanggan**
1. Beranda / Katalog (daftar produk + kategori + pencarian)
2. Detail Produk
3. Keranjang
4. Checkout (data pickup)
5. Pembayaran (QRIS + upload bukti)
6. Konfirmasi & Kode Pesanan
7. Status Pesanan (lacak via kode)
8. Struk Digital / E-Receipt (lihat, unduh PDF/gambar, bagikan)

**Sisi Admin**
9. Login
10. Dashboard (ringkasan & pesanan masuk)
11. Detail Pesanan & Verifikasi
12. Kelola Produk
13. Kelola Kategori
14. Pengaturan Kantin (QRIS, info, jam)
15. Rekap Penjualan

---

## 13. Rencana Rilis (Roadmap)

**Fase 0 — Persiapan (Minggu 1)**
Setup repo, Supabase, skema database, desain UI dasar.

**Fase 1 — MVP (Minggu 2–5)**
Katalog, keranjang, checkout guest, pembayaran QRIS + upload bukti, dashboard admin (produk & verifikasi), status pesanan, struk digital, konfigurasi PWA. → **Rilis internal & uji coba.**

**Fase 2 — Penyempurnaan (Minggu 6–7)**
Rekap penjualan, notifikasi WhatsApp, optimasi performa & Lighthouse, perbaikan dari feedback.

**Fase 3 — Pengembangan Lanjut (opsional)**
Multi-penjual, voucher/promo, opsi delivery/antar meja, laporan lanjutan, akun pelanggan.

---

## 14. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Bukti bayar palsu/salah | Kerugian | Verifikasi manual admin sebelum diproses; simpan riwayat. |
| Beban verifikasi manual saat ramai | Antre verifikasi | Notifikasi real-time; UI verifikasi cepat 1-klik. |
| Salah nominal saat transfer QRIS statis | Selisih uang | Tampilkan nominal jelas; admin cek nominal pada bukti. |
| Spam order | Data sampah | Rate limit, validasi no HP, auto-batal jika tak dibayar. |
| Stok tak sinkron | Overselling | Update stok saat pesanan disetujui; tandai habis. |

---

## 15. Keputusan yang Sudah Final
- **Struk digital: YA** — diterbitkan otomatis setelah pembayaran terverifikasi (lihat 7.6), dapat dilihat, diunduh (PDF/gambar), dan dibagikan.
- Batas waktu pembayaran otomatis: **tidak diperlukan** untuk MVP.
- Kode unik nominal QRIS: **tidak diperlukan** — pencocokan dilakukan manual oleh admin.
- Penonaktifan pesanan di luar jam operasional: **tidak diperlukan** untuk MVP.
- **Desain**: mengikuti arah visual majoo.id — fresh, clean, modern (lihat bagian 9).

---

*Dokumen ini adalah draft v1.1 dan akan disempurnakan seiring masukan serta hasil uji coba.*
