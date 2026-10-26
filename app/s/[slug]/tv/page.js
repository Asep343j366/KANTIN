"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "../StoreProvider";

// ===================== Kantin TV =====================
// Dashboard "war room" publik per-kantin (slug). Tampil penuh di layar TV,
// data live dari Supabase (public-read), auto-refresh realtime saat ada
// pesanan baru. Tanpa login, tanpa migrasi DB.
// URL: /s/<slug>/tv

// Kutipan Papan Kejujuran (berotasi). Nanti bisa dibuat editable via admin.
const QUOTES = [
  "Tidak ada yang mengawasi, kecuali hati nuranimu. Dan itu cukup.",
  "Bayar jujur = kantin ini tetap buka untuk temanmu besok.",
  "Kejujuran kecil hari ini, kepercayaan besar selamanya.",
  "Jujur itu gratis, tapi nilainya tak ternilai.",
  "Ambil barangmu, bayar sesuai harga — sesederhana itu kepercayaan dijaga.",
];

const fmt = (n) => new Intl.NumberFormat("id-ID").format(Math.round(Number(n) || 0));
const ymd = (d) => new Date(d).toLocaleDateString("en-CA"); // YYYY-MM-DD lokal
const todayStr = () => new Date().toLocaleDateString("en-CA");
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
}

export default function KantinTV() {
  const store = useStore();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]); // item untuk order HARI INI (terlaris + qty)
  const [now, setNow] = useState(new Date());
  const [qi, setQi] = useState(0);
  const [qVisible, setQVisible] = useState(true);
  const loadingRef = useRef(false);

  async function load() {
    if (!store?.id || loadingRef.current) return;
    loadingRef.current = true;
    try {
      // Batasi order ke ~35 hari terakhir: cukup untuk hari ini, kemarin, bulan ini.
      const since = new Date();
      since.setDate(since.getDate() - 35);
      const [{ data: prod }, { data: ord }] = await Promise.all([
        supabase
          .from("products")
          .select("id, nama, harga, foto_url, stok, tersedia")
          .eq("store_id", store.id),
        supabase
          .from("orders")
          .select("id, nama_pelanggan, total, created_at, status")
          .eq("store_id", store.id)
          .eq("status", "selesai")
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false }),
      ]);
      const allOrders = ord || [];
      setProducts(prod || []);
      setOrders(allOrders);

      // Item untuk order hari ini saja (untuk terlaris + porsi terjual).
      const today = todayStr();
      const todayIds = allOrders.filter((o) => ymd(o.created_at) === today).map((o) => o.id);
      if (todayIds.length) {
        const { data: its } = await supabase
          .from("order_items")
          .select("order_id, nama_produk, jumlah")
          .in("order_id", todayIds);
        setItems(its || []);
      } else {
        setItems([]);
      }
    } finally {
      loadingRef.current = false;
    }
  }

  // Muat + realtime: tiap ada perubahan order di store ini, muat ulang.
  useEffect(() => {
    if (!store?.id) return;
    load();
    const ch = supabase
      .channel(`tv-${store.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` },
        () => load()
      )
      .subscribe();
    const poll = setInterval(load, 60000); // cadangan bila realtime terlewat
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  // Jam berjalan
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Muat Tabler icon webfont sekali (ikon header/KPI/etalase) + judul tab.
  useEffect(() => {
    const ID = "ktv-tabler-icons";
    if (!document.getElementById(ID)) {
      const l = document.createElement("link");
      l.id = ID;
      l.rel = "stylesheet";
      l.href = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css";
      document.head.appendChild(l);
    }
    if (store?.nama) document.title = `${store.nama} · Kantin TV`;
  }, [store?.nama]);

  // Rotasi kutipan tiap 8 detik (fade halus)
  useEffect(() => {
    const t = setInterval(() => {
      setQVisible(false);
      setTimeout(() => {
        setQi((i) => (i + 1) % QUOTES.length);
        setQVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const m = useMemo(() => {
    const today = todayStr();
    const yday = yesterdayStr();
    const month = today.slice(0, 7);
    const todays = orders.filter((o) => ymd(o.created_at) === today);
    const ydays = orders.filter((o) => ymd(o.created_at) === yday);
    const months = orders.filter((o) => ymd(o.created_at).slice(0, 7) === month);

    const omzetToday = todays.reduce((s, o) => s + Number(o.total || 0), 0);
    const omzetYday = ydays.reduce((s, o) => s + Number(o.total || 0), 0);
    const omzetMonth = months.reduce((s, o) => s + Number(o.total || 0), 0);
    const trxMonth = months.length;
    const avgTrx = trxMonth ? Math.round(omzetMonth / trxMonth) : 0;
    const vsYday = omzetYday > 0 ? ((omzetToday - omzetYday) / omzetYday) * 100 : null;

    const qtyToday = items.reduce((s, it) => s + Number(it.jumlah || 0), 0);

    // Terlaris hari ini
    const tMap = {};
    items.forEach((it) => {
      tMap[it.nama_produk] = (tMap[it.nama_produk] || 0) + Number(it.jumlah || 0);
    });
    const terlaris = Object.entries(tMap)
      .map(([nama, qty]) => ({ nama, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4);

    const etalase = products.filter((p) => p.tersedia && p.stok > 0);
    const menuTersedia = etalase.length;

    const feed = todays.slice(0, 6);

    return {
      omzetToday, trxToday: todays.length, qtyToday,
      omzetMonth, trxMonth, avgTrx, vsYday,
      menuTersedia, terlaris, etalase, feed,
    };
  }, [orders, items, products]);

  const maxQty = m.terlaris[0]?.qty || 1;
  // Marquee: gandakan daftar agar loop mulus; durasi menyesuaikan jumlah.
  const etalaseLoop = m.etalase.length ? m.etalase.concat(m.etalase) : [];
  const marqueeDur = Math.max(25, m.etalase.length * 4.5);

  return (
    <div style={S.screen}>
      <style>{`
        @keyframes ktvMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ktv-marquee { display:flex; gap:10px; width:max-content; height:100%;
          animation: ktvMarquee ${marqueeDur}s linear infinite; }
        .ktv-feedrow { animation: ktvFade .5s ease; }
        @keyframes ktvFade { from { opacity:0; transform: translateY(-6px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* ---------- Header ---------- */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={S.logo}><i className="ti ti-building-store" /></div>
          <div>
            <div style={S.hTitle}>{store?.nama || "Kantin"}</div>
            <div style={S.hSub}>Kantin TV · transparansi langsung</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={S.live}><span style={S.liveDot} />LIVE</span>
          <div style={{ textAlign: "right" }}>
            <div style={S.clock}>{now.toLocaleTimeString("id-ID", { hour12: false })}</div>
            <div style={S.hSub}>
              {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Baris atas: Omzet · Terlaris · Papan Kejujuran ---------- */}
      <div style={S.rowTop}>
        <div style={{ ...S.card, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={S.label}><i className="ti ti-coin" style={{ color: "#0F6E56" }} /> OMZET HARI INI</div>
          <div style={S.bigOmzet}>Rp {fmt(m.omzetToday)}</div>
          <div style={{ display: "flex", gap: 26 }}>
            <div><div style={S.statNum}>{fmt(m.trxToday)}</div><div style={S.statLbl}>transaksi</div></div>
            <div><div style={S.statNum}>{fmt(m.qtyToday)}</div><div style={S.statLbl}>porsi terjual</div></div>
          </div>
          <div style={m.vsYday == null ? S.vsFlat : m.vsYday >= 0 ? S.vsUp : S.vsDown}>
            <i className={`ti ${m.vsYday == null ? "ti-minus" : m.vsYday >= 0 ? "ti-trending-up" : "ti-trending-down"}`} />
            {m.vsYday == null ? " belum ada data kemarin"
              : <> vs kemarin <b>{m.vsYday >= 0 ? "+" : ""}{m.vsYday.toFixed(1)}%</b></>}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.label}><i className="ti ti-flame" style={{ color: "#E24B4A" }} /> TERLARIS HARI INI</div>
          <div style={{ marginTop: 10 }}>
            {m.terlaris.length === 0 && <div style={S.empty}>Belum ada penjualan hari ini.</div>}
            {m.terlaris.map((r, i) => (
              <div key={r.nama} style={S.rankRow}>
                <span style={S.rankNo}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={S.rankHead}>
                    <span>{r.nama}</span><span style={{ color: "#52607A" }}>{r.qty}</span>
                  </div>
                  <div style={S.barTrack}>
                    <div style={{ ...S.barFill, width: `${Math.round((r.qty / maxQty) * 100)}%`, background: i === 0 ? "#EF9F27" : "#1B6FEB" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={S.quoteCard}>
          <i className="ti ti-quote" style={{ fontSize: 26, color: "#BA7517" }} />
          <div style={{ ...S.quoteText, opacity: qVisible ? 1 : 0 }}>&ldquo;{QUOTES[qi]}&rdquo;</div>
          <div style={S.quoteTag}>PAPAN KEJUJURAN</div>
        </div>
      </div>

      {/* ---------- KPI ---------- */}
      <div style={S.rowKpi}>
        <Kpi icon="ti-calendar-dollar" bg="#E6F1FB" fg="#185FA5" label="Omzet bulan ini" value={`Rp ${fmt(m.omzetMonth)}`} />
        <Kpi icon="ti-receipt-2" bg="#FAECE7" fg="#993C1D" label="Transaksi bulan ini" value={fmt(m.trxMonth)} />
        <Kpi icon="ti-shopping-cart" bg="#EEEDFE" fg="#534AB7" label="Rata-rata / transaksi" value={`Rp ${fmt(m.avgTrx)}`} />
        <Kpi icon="ti-cheese" bg="#E1F5EE" fg="#0F6E56" label="Menu tersedia" value={fmt(m.menuTersedia)} />
      </div>

      {/* ---------- Baris bawah: Etalase (marquee foto) · Pesanan terbaru ---------- */}
      <div style={S.rowBottom}>
        <div style={{ ...S.card, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={S.label}><i className="ti ti-tags" /> ETALASE MENU</div>
          <div style={{ overflow: "hidden", flex: 1, minWidth: 0, marginTop: 10 }}>
            {etalaseLoop.length === 0 ? (
              <div style={S.empty}>Belum ada menu tersedia.</div>
            ) : (
              <div className="ktv-marquee">
                {etalaseLoop.map((p, i) => (
                  <div key={p.id + "-" + i} style={{ ...S.menuCard, backgroundImage: p.foto_url ? `url(${p.foto_url})` : "none", backgroundColor: p.foto_url ? "#1b2838" : "#334155" }}>
                    {!p.foto_url && <i className="ti ti-tools-kitchen-2" style={S.menuIcon} />}
                    <div style={S.menuScrim}>
                      <div style={S.menuName}>{p.nama}</div>
                      <div style={S.menuPrice}>Rp {fmt(p.harga)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ ...S.card, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={S.label}><i className="ti ti-receipt" /> PESANAN TERBARU</div>
          <div style={{ overflow: "hidden", flex: 1, marginTop: 8 }}>
            {m.feed.length === 0 && <div style={S.empty}>Belum ada pesanan hari ini.</div>}
            {m.feed.map((o) => (
              <div key={o.id} className="ktv-feedrow" style={S.feedRow}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <b style={{ fontWeight: 600 }}>{o.nama_pelanggan || "Pembeli"}</b>
                  <span style={{ color: "#76839B" }}> · Rp {fmt(o.total)}</span>
                </span>
                <span style={{ color: "#76839B", flex: "0 0 auto", marginLeft: 8 }}>
                  {new Date(o.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, bg, fg, label, value }) {
  return (
    <div style={S.kpiCard}>
      <div style={{ ...S.kpiIcon, background: bg }}><i className={`ti ${icon}`} style={{ fontSize: 22, color: fg }} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={S.kpiLabel}>{label}</div>
        <div style={S.kpiValue}>{value}</div>
      </div>
    </div>
  );
}

// ===================== Styles (tema putih) =====================
const CARD = { background: "#fff", border: "0.5px solid #E2E8F2", borderRadius: 12 };
const S = {
  screen: {
    position: "fixed", inset: 0, background: "#F3F6FB", color: "#0F1B30",
    fontFamily: "var(--font-sans, 'Plus Jakarta Sans', system-ui, sans-serif)",
    display: "flex", flexDirection: "column", gap: 12, padding: 14, overflow: "hidden",
  },
  header: { ...CARD, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", flex: "0 0 auto" },
  logo: { width: 38, height: 38, borderRadius: 10, background: "#1B6FEB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22 },
  hTitle: { fontSize: 19, fontWeight: 700, lineHeight: 1.1 },
  hSub: { fontSize: 12, color: "#76839B" },
  clock: { fontSize: 24, fontWeight: 700, letterSpacing: 1, lineHeight: 1 },
  live: { fontSize: 12, fontWeight: 700, color: "#A32D2D", background: "#F7C1C1", padding: "3px 11px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: "50%", background: "#E24B4A", display: "inline-block" },

  rowTop: { display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 12, flex: 1, minHeight: 0 },
  card: { ...CARD, padding: 14 },
  label: { fontSize: 12, color: "#76839B", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 },
  bigOmzet: { fontSize: 44, fontWeight: 800, color: "#0F6E56", lineHeight: 1 },
  statNum: { fontSize: 24, fontWeight: 700 },
  statLbl: { fontSize: 12, color: "#76839B" },
  vsUp: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0F6E56", background: "#E1F5EE", borderRadius: 8, padding: "6px 10px" },
  vsDown: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#A32D2D", background: "#FCEBEB", borderRadius: 8, padding: "6px 10px" },
  vsFlat: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#76839B", background: "#F1EFE8", borderRadius: 8, padding: "6px 10px" },

  rankRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 9 },
  rankNo: { width: 14, fontSize: 13, color: "#76839B" },
  rankHead: { display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 3 },
  barTrack: { height: 7, background: "#E2E8F2", borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },

  quoteCard: { background: "#EAF3FB", border: "0.5px solid #B5D4F4", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" },
  quoteText: { fontFamily: "var(--font-voice, Georgia, serif)", fontSize: 19, lineHeight: 1.4, color: "#0C447C", margin: "8px 0", transition: "opacity .4s", maxWidth: 420 },
  quoteTag: { fontSize: 10, color: "#378ADD", letterSpacing: 2, fontWeight: 600 },

  rowKpi: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, flex: "0 0 auto" },
  kpiCard: { ...CARD, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 },
  kpiIcon: { width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  kpiLabel: { fontSize: 12, color: "#76839B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  kpiValue: { fontSize: 20, fontWeight: 700 },

  rowBottom: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, flex: 1, minHeight: 0 },
  menuCard: { position: "relative", height: "100%", aspectRatio: "4 / 5", maxWidth: 260, borderRadius: 12, overflow: "hidden", flex: "0 0 auto", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "flex-end" },
  menuIcon: { position: "absolute", top: 10, right: 10, fontSize: 24, color: "rgba(255,255,255,.5)" },
  menuScrim: { width: "100%", background: "rgba(8,16,32,.66)", padding: "10px 12px", color: "#fff" },
  menuName: { fontSize: 16, fontWeight: 600, lineHeight: 1.2 },
  menuPrice: { fontSize: 15, color: "#9FE1CB", fontWeight: 600 },

  feedRow: { display: "flex", justifyContent: "space-between", fontSize: 14, padding: "7px 0", borderBottom: "0.5px solid #EEF2F8" },
  empty: { fontSize: 13, color: "#76839B", padding: "6px 0" },
};
