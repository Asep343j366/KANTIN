"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "../StoreProvider";

// ===================== Kantin TV (e-KANTIN) =====================
// Dashboard publik per-kantin untuk layar TV. Gaya navy: header brand,
// KPI, Menu Favorit, Cara Belanja, QR (dari URL kantin /s/<slug>), dan
// Papan Kejujuran sebagai teks footer. Data live via Supabase realtime.
// URL: /s/<slug>/tv — tanpa login.

// Kata-kata Papan Kejujuran bawaan (baris pertama = sapaan utama).
const QUOTES = [
  "Ambil secukupnya, bayar sejujurnya.",
  "Tidak ada yang mengawasi, kecuali hati nuranimu.",
  "Kejujuran kecil hari ini, kepercayaan besar selamanya.",
  "Jujur itu gratis, tapi nilainya tak ternilai.",
  "Bayar jujur = kantin ini tetap buka untuk temanmu besok.",
];

const fmt = (n) => new Intl.NumberFormat("id-ID").format(Math.round(Number(n) || 0));
const ymd = (d) => new Date(d).toLocaleDateString("en-CA");
const todayStr = () => new Date().toLocaleDateString("en-CA");

function tzLabel() {
  const o = -new Date().getTimezoneOffset();
  if (o === 420) return "WIB";
  if (o === 480) return "WITA";
  if (o === 540) return "WIT";
  return "";
}
// Status BUKA/TUTUP dari "jam_operasional" (mis. "07:00 - 15:00"). Bila tak
// terbaca, anggap buka.
function isOpen(jam) {
  if (!jam) return true;
  const m = String(jam).match(/(\d{1,2})[.:](\d{2})\D+?(\d{1,2})[.:](\d{2})/);
  if (!m) return true;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const a = +m[1] * 60 + +m[2];
  const b = +m[3] * 60 + +m[4];
  return b >= a ? cur >= a && cur <= b : cur >= a || cur <= b; // lewat tengah malam
}

const PAGE = 6; // produk per halaman Menu Favorit

export default function KantinTV() {
  const store = useStore();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [qr, setQr] = useState(null);
  const [now, setNow] = useState(new Date());
  const [qi, setQi] = useState(0);
  const [qVisible, setQVisible] = useState(true);
  const [page, setPage] = useState(0);
  const loadingRef = useRef(false);

  async function load() {
    if (!store?.id || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const since = new Date();
      since.setHours(0, 0, 0, 0); // cukup hari ini untuk KPI gaya baru
      const [{ data: prod }, { data: ord }, { data: set }] = await Promise.all([
        supabase.from("products").select("id, nama, harga, foto_url, stok, tersedia").eq("store_id", store.id),
        supabase.from("orders").select("id, total, created_at, status")
          .eq("store_id", store.id).eq("status", "selesai")
          .gte("created_at", since.toISOString()),
        supabase.from("settings").select("papan_kejujuran, jam_operasional").eq("store_id", store.id).maybeSingle(),
      ]);
      setProducts(prod || []);
      setOrders(ord || []);
      setSettings(set || null);
    } finally {
      loadingRef.current = false;
    }
  }

  // Muat + realtime
  useEffect(() => {
    if (!store?.id) return;
    load();
    const ch = supabase
      .channel(`tv-${store.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, () => load())
      .subscribe();
    const poll = setInterval(load, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  // QR dari URL kantin (/s/<slug>)
  useEffect(() => {
    if (!store?.slug) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    QRCode.toDataURL(`${origin}/s/${store.slug}`, { width: 240, margin: 1, color: { dark: "#1B2E54", light: "#ffffff" } })
      .then(setQr).catch(() => {});
  }, [store?.slug]);

  // Tabler webfont + judul
  useEffect(() => {
    const ID = "ktv-tabler-icons";
    if (!document.getElementById(ID)) {
      const l = document.createElement("link");
      l.id = ID; l.rel = "stylesheet";
      l.href = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css";
      document.head.appendChild(l);
    }
    if (store?.nama) document.title = `${store.nama} · Kantin TV`;
  }, [store?.nama]);

  // Jam
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  // Rotasi kutipan 6 dtk
  useEffect(() => {
    const t = setInterval(() => {
      setQVisible(false);
      setTimeout(() => { setQi((i) => i + 1); setQVisible(true); }, 400);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const avail = useMemo(() => products.filter((p) => p.tersedia && p.stok > 0), [products]);
  const pageCount = Math.max(1, Math.ceil(avail.length / PAGE));
  // Pergantian halaman Menu Favorit tiap 10 dtk bila produk > 6
  useEffect(() => {
    if (pageCount <= 1) { setPage(0); return; }
    const t = setInterval(() => setPage((p) => (p + 1) % pageCount), 10000);
    return () => clearInterval(t);
  }, [pageCount]);
  const shown = avail.slice(page * PAGE, page * PAGE + PAGE);

  const m = useMemo(() => {
    const today = todayStr();
    const todays = orders.filter((o) => ymd(o.created_at) === today);
    return {
      omzetToday: todays.reduce((s, o) => s + Number(o.total || 0), 0),
      trxToday: todays.length,
      produkTersedia: avail.length,
    };
  }, [orders, avail]);

  const quotes = useMemo(() => {
    const custom = (settings?.papan_kejujuran || "").split("\n").map((q) => q.trim()).filter(Boolean);
    return custom.length ? custom : QUOTES;
  }, [settings]);
  const curQuote = quotes[qi % quotes.length];
  const open = isOpen(settings?.jam_operasional);
  const siteName = (store?.nama || "KANTIN").toUpperCase();

  return (
    <div style={S.screen}>
      {/* Ornamen daun di sudut bawah */}
      <Leaves style={{ left: -6, bottom: -10 }} />
      <Leaves style={{ right: -6, bottom: -10, transform: "scaleX(-1)" }} />

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={S.brand}><span style={{ color: "#F26F21" }}>i</span>Kantin</div>
          <div style={{ width: 2, height: 30, background: "rgba(255,255,255,.3)" }} />
          <div style={S.site}>{siteName}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {store?.is_demo && <div style={S.sim}>CONTOH TAMPILAN · DATA SIMULASI</div>}
          <div style={S.clockWrap}>
            <i className="ti ti-clock" style={{ color: "#9FB0CC" }} />
            <span>{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
            <span style={{ color: "#9FB0CC", fontSize: 14 }}>{tzLabel()}</span>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div style={S.kpiRow}>
        <Kpi icon="ti-shopping-cart" label="Penjualan Hari Ini" value={`Rp ${fmt(m.omzetToday)}`} />
        <Kpi icon="ti-receipt" label="Transaksi" value={fmt(m.trxToday)} />
        <Kpi icon="ti-box" label="Produk Tersedia" value={fmt(m.produkTersedia)} />
        <div style={S.kpiCard}>
          <i className="ti ti-building-store" style={{ fontSize: 28, color: open ? "#2E9E4F" : "#C0392B" }} />
          <div>
            <div style={S.kpiLabel}>Status Kantin</div>
            <div style={{ ...S.statusBadge, background: open ? "#2FA84F" : "#C0392B" }}>{open ? "BUKA" : "TUTUP"}</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        {/* Menu Favorit */}
        <div style={S.menuCard}>
          <div style={S.h2}>MENU FAVORIT<div style={S.accent} /></div>
          <div style={S.menuGrid}>
            {shown.length === 0 && <div style={{ color: "#8A93A5", gridColumn: "1/-1", alignSelf: "center", textAlign: "center" }}>Belum ada menu tersedia.</div>}
            {shown.map((p) => (
              <div key={p.id} style={S.prod}>
                <div style={{ ...S.prodImg, backgroundImage: p.foto_url ? `url(${p.foto_url})` : "none" }}>
                  {!p.foto_url && <i className="ti ti-tools-kitchen-2" style={{ fontSize: 34, color: "#1B2E54", opacity: 0.4 }} />}
                  <span style={S.tersedia}><i className="ti ti-circle-check" /> Tersedia</span>
                </div>
                <div style={S.prodFoot}>
                  <div style={S.prodName}>{p.nama}</div>
                  <div style={S.prodPrice}>Rp {fmt(p.harga)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kanan: Cara Belanja + QR */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div style={S.sideCard}>
            <div style={{ ...S.h2, fontSize: 18 }}>CARA BELANJA<div style={S.accent} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              <Step n="1" icon="ti-apps" text="Pilih produk" />
              <Step n="2" icon="ti-qrcode" text="Scan & catat belanja" />
              <Step n="3" icon="ti-wallet" text="Bayar sesuai nominal" />
            </div>
          </div>

          <div style={S.qrCard}>
            <div style={S.qrHead}>BAYAR &amp; CATAT DI SINI</div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 0 }}>
              <i className="ti ti-chevron-right" style={{ color: "#F26F21", fontSize: 22, transform: "scaleX(-1)" }} />
              <div style={S.qrBox}>
                {qr ? <img src={qr} alt="QR kantin" style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
                    : <div style={{ color: "#8A5A33", fontSize: 12 }}>QR…</div>}
              </div>
              <i className="ti ti-chevron-right" style={{ color: "#F26F21", fontSize: 22 }} />
            </div>
            <div style={{ fontSize: 12, color: "#8A5A33" }}>Scan dengan ponsel pribadi untuk mulai belanja</div>
          </div>
        </div>
      </div>

      {/* Footer — Papan Kejujuran */}
      <div style={S.footer}>
        <Spark />
        <i className="ti ti-heart-handshake" style={{ fontSize: 34, color: "#F26F21" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ ...S.footQuote, opacity: qVisible ? 1 : 0 }}>{curQuote}</div>
          <div style={S.footSub}>Kantin kita, tanggung jawab bersama.</div>
        </div>
        <i className="ti ti-users-group" style={{ fontSize: 34, color: "#9FB0CC" }} />
        <Spark flip />
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }) {
  return (
    <div style={S.kpiCard}>
      <i className={`ti ${icon}`} style={{ fontSize: 28, color: "#F26F21" }} />
      <div style={{ minWidth: 0 }}>
        <div style={S.kpiLabel}>{label}</div>
        <div style={S.kpiValue}>{value}</div>
      </div>
    </div>
  );
}

function Step({ n, icon, text }) {
  return (
    <div style={S.step}>
      <span style={S.stepNo}>{n}</span>
      <i className={`ti ${icon}`} style={{ fontSize: 19, color: "#5A6577" }} />
      <span style={{ fontSize: 14, fontWeight: 600 }}>{text}</span>
    </div>
  );
}

// Ornamen daun (sprig) di sudut bawah layar — mengisi area navy kosong.
function Leaves({ style }) {
  return (
    <svg width="300" height="150" viewBox="0 0 120 60" style={{ position: "absolute", opacity: 0.11, pointerEvents: "none", ...style }} aria-hidden="true">
      <g fill="none" stroke="#9FE1CB" strokeWidth="1.6" strokeLinecap="round">
        <path d="M8 60 C14 42 26 30 48 24" />
        <path d="M20 42 C16 36 18 30 24 28 C28 33 27 40 20 42 Z" fill="#9FE1CB" fillOpacity="0.5" stroke="none" />
        <path d="M30 34 C26 28 28 22 34 20 C38 25 37 32 30 34 Z" fill="#9FE1CB" fillOpacity="0.5" stroke="none" />
        <path d="M41 28 C37 22 39 16 45 14 C49 19 48 26 41 28 Z" fill="#9FE1CB" fillOpacity="0.5" stroke="none" />
        <path d="M4 60 C2 48 6 38 16 32" />
        <path d="M12 46 C8 42 9 36 15 35 C18 39 17 45 12 46 Z" fill="#9FE1CB" fillOpacity="0.35" stroke="none" />
      </g>
    </svg>
  );
}

// Percikan garis oranye di sisi ikon footer (seperti referensi).
function Spark({ flip }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: flip ? "scaleX(-1)" : "none", flex: "0 0 auto" }} aria-hidden="true">
      <g stroke="#F26F21" strokeWidth="2.6" strokeLinecap="round">
        <line x1="26" y1="8" x2="36" y2="4" />
        <line x1="24" y1="20" x2="37" y2="20" />
        <line x1="26" y1="32" x2="36" y2="36" />
      </g>
    </svg>
  );
}

// ===================== Styles =====================
const NAVY = "#1B2E54";
const ORANGE = "#F26F21";
const S = {
  screen: {
    position: "fixed", inset: 0, background: NAVY, color: "#fff",
    fontFamily: "var(--font-sans, 'Plus Jakarta Sans', system-ui, sans-serif)",
    display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px", overflow: "hidden",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto" },
  brand: { fontSize: 28, fontWeight: 800, letterSpacing: -0.5 },
  site: { fontSize: 22, fontWeight: 700, letterSpacing: 1 },
  sim: { fontSize: 10, letterSpacing: 1, color: "#9FB0CC" },
  clockWrap: { display: "flex", alignItems: "center", gap: 8, fontSize: 19, fontWeight: 700 },

  kpiRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, flex: "0 0 auto" },
  kpiCard: { background: "#fff", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 },
  kpiLabel: { fontSize: 11, color: "#5A6577", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  kpiValue: { fontSize: 22, fontWeight: 800, color: NAVY },
  statusBadge: { marginTop: 3, display: "inline-block", color: "#fff", fontSize: 14, fontWeight: 800, padding: "2px 16px", borderRadius: 7 },

  main: { display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: 12, flex: 1, minHeight: 0 },
  menuCard: { background: "#fff", borderRadius: 14, padding: "14px 16px", color: NAVY, display: "flex", flexDirection: "column", minHeight: 0 },
  h2: { fontSize: 20, fontWeight: 800 },
  accent: { width: 52, height: 4, background: ORANGE, borderRadius: 3, marginTop: 4 },
  menuGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "1fr 1fr", gap: 10, marginTop: 10, flex: 1, minHeight: 0 },
  prod: { border: "1px solid #EEF1F6", borderRadius: 11, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 },
  prodImg: { flex: 1, minHeight: 0, background: "#fff", backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" },
  tersedia: { position: "absolute", top: 7, right: 7, background: "#E3F6E9", color: "#2E9E4F", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 3 },
  prodFoot: { padding: "7px 10px", background: "#fff" },
  prodName: { fontSize: 14, fontWeight: 700, color: NAVY, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  prodPrice: { fontSize: 15, fontWeight: 800, color: ORANGE },

  sideCard: { background: "#fff", borderRadius: 14, padding: "12px 14px", color: NAVY, flex: "0 0 auto" },
  step: { display: "flex", alignItems: "center", gap: 10, background: "#F1F4F9", borderRadius: 9, padding: "8px 10px" },
  stepNo: { width: 24, height: 24, borderRadius: "50%", background: ORANGE, color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },

  qrCard: { background: "#FDEEE4", border: "1.5px solid #F7C9AC", borderRadius: 14, padding: 12, textAlign: "center", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
  qrHead: { background: ORANGE, color: "#fff", fontSize: 16, fontWeight: 800, padding: "7px", borderRadius: 9, letterSpacing: 0.5 },
  qrBox: { background: "#fff", padding: 8, borderRadius: 10, width: "40%", maxWidth: 180, aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center" },

  footer: { flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 18, paddingTop: 2, position: "relative", zIndex: 1 },
  footQuote: { fontSize: 22, fontWeight: 800, transition: "opacity .4s" },
  footSub: { fontSize: 13, color: "#9FB0CC", marginTop: 1 },
};
