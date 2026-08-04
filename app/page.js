"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_WA = "6281234567890";
const waHref = (wa) =>
  `https://wa.me/${wa || DEFAULT_WA}?text=${encodeURIComponent("Halo, saya mau berlangganan iKantin untuk toko saya.")}`;

// Format harga dgn pemisah ribuan. Bila user isi angka ("50000" / "50.000") →
// "Rp50.000". Bila teks bebas → tampilkan apa adanya.
function formatHarga(label) {
  if (!label) return "Rp‑";
  const clean = String(label).replace(/[.\s]/g, "");
  if (/^\d+$/.test(clean)) return "Rp" + Number(clean).toLocaleString("id-ID");
  return label;
}

const FALLBACK_MENU = [
  { nama: "Nasi Goreng", harga: 15000 },
  { nama: "Es Teh", harga: 5000 },
  { nama: "Ayam Geprek", harga: 18000 },
  { nama: "Kopi Susu", harga: 10000 },
];

export default function Landing() {
  const [demoSlug, setDemoSlug] = useState(null);
  const [plat, setPlat] = useState(null);
  const [mock, setMock] = useState([]);

  useEffect(() => {
    (async () => {
      // "Lihat Demo" hanya ke toko demo (is_demo), BUKAN toko platform/J366.
      const { data: demo } = await supabase.from("stores").select("id, slug").eq("is_demo", true).limit(1).maybeSingle();
      setDemoSlug(demo?.slug || null);

      // Foto mockup: dari toko demo, fallback toko platform.
      let srcId = demo?.id;
      if (!srcId) {
        const { data: p } = await supabase.from("stores").select("id").eq("is_platform_admin", true).limit(1).maybeSingle();
        srcId = p?.id;
      }
      if (srcId) {
        const { data: prods } = await supabase.from("products")
          .select("nama, harga, foto_url").eq("store_id", srcId)
          .not("foto_url", "is", null).eq("tersedia", true)
          .order("created_at", { ascending: false }).limit(4);
        setMock(prods || []);
      }

      const { data: ps } = await supabase.from("platform_settings").select("wa_number, harga_label, harga_note").eq("id", 1).maybeSingle();
      setPlat(ps || null);
    })();
  }, []);

  const waLink = waHref(plat?.wa_number);
  const hargaLabel = formatHarga(plat?.harga_label);
  const hargaNote = plat?.harga_note || "Hubungi kami untuk harga & aktivasi.";
  const mockItems = (mock.length ? mock : FALLBACK_MENU).slice(0, 4);

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-primary-light">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-512.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-extrabold tracking-tight">iKantin</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-soft">Digital Borneo</span>
            </div>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-ink-soft md:flex">
            <a href="#fitur" className="transition hover:text-ink">Fitur</a>
            <a href="#cara" className="transition hover:text-ink">Cara Kerja</a>
            <a href="#harga" className="transition hover:text-ink">Harga</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="btn-outline btn-xs">Masuk</Link>
            <Link href="/register" className="btn-primary btn-xs">Daftar</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* blobs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-[#34D26A]/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="badge bg-primary-light text-primary">✨ Kasir digital untuk kantin & warung</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
              Jualan online, bayar{" "}
              <span className="bg-gradient-to-r from-[#2E86FF] to-[#16A34A] bg-clip-text text-transparent">QRIS otomatis</span>,
              tanpa ribet.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Pelanggan pesan dari HP, bayar QRIS, dan pesananmu langsung tercatat.
              Kelola produk, stok, laporan penjualan, dan keuangan — semua dalam satu aplikasi.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/register" className="btn-primary px-5 py-2.5 text-sm">Coba Gratis 7 Hari</Link>
              {demoSlug && (
                <Link href={`/s/${demoSlug}`} className="btn-outline px-5 py-2.5 text-sm">Lihat Demo Toko →</Link>
              )}
            </div>
            <div className="mt-6 flex items-center gap-5 text-xs font-semibold text-ink-soft">
              <span className="flex items-center gap-1.5"><Dot /> Tanpa mesin EDC</span>
              <span className="flex items-center gap-1.5"><Dot /> 0% biaya transaksi</span>
              <span className="flex items-center gap-1.5"><Dot /> Siap PWA</span>
            </div>
          </div>

          {/* Phone mockup — dua HP proporsi asli (belakang: QRIS, depan: toko) */}
          <PhoneMockups items={mockItems} />
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-gray-100 bg-surface/60">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-4 px-5 py-8 text-center">
          <Stat big="0%" small="Biaya transaksi QRIS" />
          <Stat big="< 10 dtk" small="Verifikasi pembayaran" />
          <Stat big="24/7" small="Toko online buka terus" />
        </div>
      </section>

      {/* FITUR — bento */}
      <section id="fitur" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-xl text-center">
          <span className="badge bg-primary-light text-primary">Fitur Lengkap</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Semua yang toko butuhkan</h2>
          <p className="mt-2 text-[15px] text-ink-soft">Dari terima pesanan sampai laporan keuangan — satu aplikasi.</p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Feature className="md:col-span-2 bg-gradient-to-br from-primary to-[#1657C0] text-white" iconBg="bg-white/15"
            icon="M2 7h20v10H2zM2 11h20M6 15h4" title="QRIS Otomatis Terverifikasi"
            desc="Nominal unik per transaksi, pembayaran masuk langsung tercatat otomatis. Tak perlu cek mutasi manual — tapi mode manual juga tersedia." light />
          <Feature icon="M3 9l1.5-5h15L21 9M4 9h16v11H4zM9 13h6" title="Multi-Toko"
            desc="Satu platform untuk banyak toko, masing-masing admin & pembayaran sendiri." />
          <Feature icon="M4 20V10M10 20V4M16 20v-7M22 20H2" title="Laporan Penjualan"
            desc="Omzet, laba, produk terlaris, dead stock, export Excel & PDF." />
          <Feature icon="M3 8l9-5 9 5-9 5zM3 8v8l9 5 9-5V8" title="Inventory & Stok"
            desc="Stok berkurang otomatis tiap penjualan, riwayat pergerakan stok tercatat." />
          <Feature icon="M5 3h11l3 3v15H5zM9 12h6M9 16h6" title="Jurnal Kas"
            desc="Catat uang masuk & keluar plus foto nota — pembukuan sederhana & rapi." />
        </div>
      </section>

      {/* CARA KERJA */}
      <section id="cara" className="bg-surface/60 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-xl text-center">
            <span className="badge bg-primary-light text-primary">Cara Kerja</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Mulai jualan dalam 3 langkah</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Step n="1" title="Daftarkan toko" desc="Isi nama toko & email — akun admin dan alamat unik langsung jadi. Gratis coba 7 hari." />
            <Step n="2" title="Isi produk & QRIS" desc="Tambahkan menu, foto, harga, dan atur cara pembayaran QRIS-mu." />
            <Step n="3" title="Bagikan link" desc="Sebar link toko / QR ke pelanggan. Mereka pesan & bayar sendiri dari HP." />
          </div>
        </div>
      </section>

      {/* HARGA */}
      <section id="harga" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-xl text-center">
          <span className="badge bg-primary-light text-primary">Harga</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Berlangganan, simpel</h2>
          <p className="mt-2 text-[15px] text-ink-soft">Tanpa biaya transaksi. Bayar per periode, aktifkan lewat kode.</p>
        </div>

        <div className="mx-auto mt-10 max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-white p-8 shadow-pop">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
            <span className="badge bg-[#EAF7EE] text-[#16A34A]">Paling Populer</span>
            <div className="mt-4 flex items-end gap-1">
              <span className="text-4xl font-extrabold">{hargaLabel}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{hargaNote}</p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Toko online sendiri (link unik)", "QRIS otomatis / manual", "Produk & stok tak terbatas", "Laporan & jurnal lengkap", "Multi admin per toko"].map((t) => (
                <li key={t} className="flex items-center gap-2.5"><Check /> {t}</li>
              ))}
            </ul>
            <Link href="/register" className="btn-primary btn-block mt-7 py-2.5 text-center text-sm">Daftar & Coba Gratis</Link>
            <a href={waLink} target="_blank" rel="noreferrer" className="mt-2 block text-center text-xs font-semibold text-primary">atau tanya via WhatsApp</a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F4575] to-[#0A2E4F] px-8 py-14 text-center text-white">
          <div className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-primary/30 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#34D26A]/30 blur-3xl" />
          <h2 className="relative text-3xl font-extrabold tracking-tight">Siap digitalkan tokomu?</h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm text-white/80">
            Bergabung dan mulai terima pesanan online dengan pembayaran QRIS otomatis hari ini.
          </p>
          <Link href="/register" className="relative mt-7 inline-flex rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-primary shadow-card transition hover:brightness-95">
            Mulai Sekarang
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-ink-soft md:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-lg bg-primary-light">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-512.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-ink">iKantin</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-soft">Digital Borneo</span>
            </div>
          </div>
          <p>© {new Date().getFullYear()} iKantin — Digital Borneo. Semua hak dilindungi.</p>
          <Link href="/admin" className="font-semibold text-primary">Masuk Admin</Link>
        </div>
      </footer>
    </div>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#22C55E]" />;
}

// Bingkai HP realistis (rasio ~9:19.5) dengan notch. children = isi layar.
function PhoneFrame({ children, className = "", width = 250 }) {
  return (
    <div className={`rounded-[2.6rem] border-[7px] border-[#0F172A] bg-[#0F172A] shadow-pop ${className}`} style={{ width }}>
      <div className="relative aspect-[9/19] overflow-hidden rounded-[2.1rem] bg-surface">
        {/* notch */}
        <div className="absolute left-1/2 top-0 z-20 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-[#0F172A]" />
        {children}
      </div>
    </div>
  );
}

// Dua HP berdampingan: belakang (setengah, layar QRIS) + depan (full, layar toko).
function PhoneMockups({ items }) {
  const grid = Array.from({ length: 6 }, (_, i) => items[i % items.length] || {});
  return (
    <div className="relative mx-auto flex w-full max-w-[440px] items-center justify-center py-4">
      {/* glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 translate-y-8 scale-90 rounded-full bg-gradient-to-br from-[#2E86FF] to-[#16A34A] opacity-20 blur-3xl" />

      {/* HP belakang — layar QRIS/pembayaran, setengah tampil */}
      <div className="absolute right-0 top-2 hidden rotate-[8deg] sm:block">
        <PhoneFrame width={200} className="opacity-95">
          <div className="flex h-full flex-col bg-white">
            <div className="bg-gradient-to-br from-[#0F4575] to-[#0A2E4F] px-4 pb-4 pt-7 text-white">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-white/60">Pembayaran</p>
              <p className="text-[11px] font-extrabold">QRIS Otomatis</p>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 25 }).map((_, i) => (
                  <span key={i} className={`h-3 w-3 rounded-[2px] ${(i * 7) % 3 === 0 ? "bg-[#0F172A]" : "bg-transparent"}`} />
                ))}
              </div>
              <p className="text-[13px] font-extrabold text-primary">Rp23.000</p>
              <div className="flex items-center gap-1.5 text-[8px] font-semibold text-ink-soft">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Menunggu pembayaran…
              </div>
            </div>
            <div className="mx-3 mb-4 rounded-lg bg-[#EAF7EE] py-2 text-center text-[9px] font-bold text-[#16A34A]">✓ Terverifikasi otomatis</div>
          </div>
        </PhoneFrame>
      </div>

      {/* HP depan — layar toko, full */}
      <div className="relative z-10 -rotate-2 sm:mr-24">
        <PhoneFrame width={252}>
          <div className="flex h-full flex-col">
            {/* status bar */}
            <div className="flex items-center justify-between bg-gradient-to-br from-[#0F4575] to-[#0A2E4F] px-4 pt-1.5 text-[8px] text-white/70">
              <span>9:41</span>
              <span className="flex items-center gap-1"><span>●●●</span><span>▮</span></span>
            </div>
            {/* header toko */}
            <div className="bg-gradient-to-br from-[#0F4575] to-[#0A2E4F] px-4 pb-4 pt-2 text-white">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-white/60">Kantin Digital</p>
              <p className="text-[13px] font-extrabold leading-tight">Kantin Kejujuran Informa Bigmall</p>
              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-white/70"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>
                <span className="text-[8px] text-white/70">Cari menu…</span>
              </div>
            </div>
            {/* grid produk */}
            <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-hidden bg-surface p-2.5">
              {grid.map((it, i) => (
                <div key={i} className="rounded-xl bg-white p-1.5 shadow-card">
                  {it.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.foto_url} alt={it.nama} className="h-16 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="h-16 rounded-lg bg-gradient-to-br from-primary-light to-[#EAF7EE]" />
                  )}
                  <p className="mt-1 truncate text-[9px] font-bold">{it.nama || "Menu"}</p>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-primary">Rp{Number(it.harga || 0).toLocaleString("id-ID")}</span>
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold leading-none text-white">+</span>
                  </div>
                </div>
              ))}
            </div>
            {/* bottom checkout */}
            <div className="bg-surface px-2.5 pb-2.5">
              <div className="flex items-center justify-between rounded-xl bg-primary px-3 py-2.5 text-white shadow-card">
                <span className="text-[9px] font-semibold">Total 2 item · Rp23.000</span>
                <span className="text-[11px] font-extrabold">Checkout →</span>
              </div>
            </div>
            {/* home indicator */}
            <div className="flex justify-center bg-surface pb-2"><span className="h-1 w-16 rounded-full bg-ink/20" /></div>
          </div>
        </PhoneFrame>
      </div>
    </div>
  );
}

function Stat({ big, small }) {
  return (
    <div>
      <p className="text-2xl font-extrabold text-primary md:text-3xl">{big}</p>
      <p className="mt-1 text-xs font-semibold text-ink-soft">{small}</p>
    </div>
  );
}

function Feature({ icon, title, desc, className = "", iconBg = "bg-primary-light", light }) {
  return (
    <div className={`group rounded-3xl border border-gray-100 p-6 shadow-card transition hover:shadow-pop ${className || "bg-white"}`}>
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${iconBg} ${light ? "text-white" : "text-primary"}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      </div>
      <h3 className="mt-4 text-base font-extrabold">{title}</h3>
      <p className={`mt-1.5 text-sm leading-relaxed ${light ? "text-white/80" : "text-ink-soft"}`}>{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <div className="card p-6">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#2E86FF] to-[#1657C0] text-lg font-extrabold text-white shadow-card">{n}</div>
      <h3 className="mt-4 text-base font-extrabold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{desc}</p>
    </div>
  );
}

function Check() {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#EAF7EE] text-[#16A34A]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </span>
  );
}
