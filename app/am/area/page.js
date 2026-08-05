"use client";
import { useEffect, useMemo, useState } from "react";
import { getMyAm, getAmStores, loadAreaData } from "@/lib/am";
import { computeDashboard } from "@/lib/reports";
import { rupiah } from "@/lib/format";
import { Kpi, BarRank, Donut, TrendBars } from "@/components/AmCharts";

// Tanggal lokal YYYY-MM-DD
function ymd(d) { return new Date(d).toLocaleDateString("en-CA"); }

function statusBadge(s) {
  const map = {
    aktif: "bg-green-100 text-green-700",
    grace: "bg-amber-100 text-amber-700",
    nonaktif: "bg-red-100 text-red-600",
    suspended: "bg-gray-200 text-gray-600",
  };
  return <span className={`badge ${map[s?.status] || "bg-gray-100 text-gray-600"}`}>{s?.status || "-"}{s?.is_trial ? " · trial" : ""}</span>;
}

export default function AreaDashboardPage() {
  const [rows, setRows] = useState(null);   // hasil per store
  const [missing, setMissing] = useState([]); // kode_site yg belum jadi store
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const am = await getMyAm();
      const sites = am?.sites || [];
      const stores = await getAmStores(sites);
      const registered = new Set(stores.map((s) => s.kode_site));
      setMissing(sites.filter((s) => !registered.has(s)));
      const data = await loadAreaData(stores);
      const th = 5;
      const enriched = data.map((d) => ({
        store: d.store,
        kas: d.kas,
        dash: computeDashboard(d.orders, d.items, d.products, th),
        orders: d.orders,
      }));
      setRows(enriched);
      setLoading(false);
    })();
  }, []);

  const agg = useMemo(() => {
    if (!rows) return null;
    const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
    // trend gabungan 30 hari terakhir
    const days = [];
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i); days.push(ymd(d)); }
    const tmap = {}; days.forEach((d) => (tmap[d] = 0));
    rows.forEach((r) => {
      r.orders.filter((o) => o.status === "selesai").forEach((o) => {
        const k = ymd(o.created_at); if (k in tmap) tmap[k] += o.total;
      });
    });
    const trend = days.map((d) => ({ date: d, omzet: tmap[d] }));

    // produk terlaris lintas area
    const terlaris = {};
    rows.forEach((r) => r.dash.produkTerlaris.forEach((p) => { terlaris[p.nama] = (terlaris[p.nama] || 0) + p.qty; }));
    const topProduk = Object.entries(terlaris).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);

    return {
      omzetHariIni: sum((r) => r.dash.omzetHariIni),
      omzetBulanIni: sum((r) => r.dash.omzetBulanIni),
      labaHariIni: sum((r) => r.dash.labaHariIni),
      labaBulanIni: sum((r) => r.dash.labaBulanIni),
      trxHariIni: sum((r) => r.dash.transaksiHariIni),
      trxBulanIni: sum((r) => r.dash.transaksiBulanIni),
      saldo: sum((r) => r.kas.saldo),
      masuk: sum((r) => r.kas.masuk),
      keluar: sum((r) => r.kas.keluar),
      totalProduk: sum((r) => r.dash.totalProduk),
      stokMenipis: sum((r) => r.dash.stokMenipis.length),
      trend, topProduk,
      leaderboard: rows.map((r) => ({ key: r.store.id, label: r.store.kode_site, value: r.dash.omzetBulanIni }))
        .sort((a, b) => b.value - a.value),
      kontribusi: rows.map((r) => ({ label: r.store.kode_site, value: r.dash.omzetBulanIni })),
    };
  }, [rows]);

  if (loading || !agg) return <p className="text-ink-soft">Memuat dashboard area...</p>;

  if (!rows.length) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-lg font-extrabold">Belum ada store terdaftar</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Store under area Anda belum dibuat di sistem. Data akan muncul otomatis setelah store dibuat.
        </p>
        {missing.length > 0 && <p className="mt-3 text-xs text-ink-soft">Menunggu: {missing.join(", ")}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold">Rangkuman Area</h1>
          <p className="text-xs text-ink-soft">{rows.length} store aktif dipantau{missing.length ? ` · ${missing.length} site belum terdaftar (${missing.join(", ")})` : ""}.</p>
        </div>
      </div>

      {/* KPI Agregat */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi c="#22C55E" label="Omzet Hari Ini" value={rupiah(agg.omzetHariIni)} sub={`${agg.trxHariIni} transaksi`} />
        <Kpi c="#1B6FEB" label="Omzet Bulan Ini" value={rupiah(agg.omzetBulanIni)} sub={`${agg.trxBulanIni} transaksi bln ini`} />
        <Kpi c="#14B8A6" label="Laba Hari Ini" value={rupiah(agg.labaHariIni)} sub="omzet − HPP" />
        <Kpi c="#6366F1" label="Laba Bulan Ini" value={rupiah(agg.labaBulanIni)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi c="#0EA5E9" label="Saldo Kas Area" value={rupiah(agg.saldo)} />
        <Kpi c="#22C55E" label="Total Uang Masuk" value={rupiah(agg.masuk)} />
        <Kpi c="#EF4444" label="Total Uang Keluar" value={rupiah(agg.keluar)} />
        <Kpi c="#F59E0B" label="Stok Menipis" value={agg.stokMenipis} sub={`${agg.totalProduk} produk total`} />
      </div>

      {/* Leaderboard + Donut */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 font-bold">🏆 Peringkat Omzet Store (bulan ini)</h3>
          <BarRank items={agg.leaderboard} fmt={rupiah} />
        </div>
        <div className="card p-4">
          <h3 className="mb-3 font-bold">🥧 Kontribusi Omzet per Store</h3>
          <Donut items={agg.kontribusi} />
        </div>
      </div>

      {/* Trend */}
      <div className="card mt-4 p-4">
        <h3 className="mb-3 font-bold">📈 Trend Omzet Area (30 hari)</h3>
        <TrendBars trend={agg.trend} />
      </div>

      {/* Produk terlaris lintas area */}
      <div className="card mt-4 p-4">
        <h3 className="mb-3 font-bold">🔥 Produk Terlaris Lintas Area</h3>
        <BarRank items={agg.topProduk} fmt={(v) => v} unit=" pcs" />
      </div>

      {/* Tabel ringkasan per store */}
      <h3 className="mb-2 mt-5 text-sm font-extrabold text-[#0F4575]">Ringkasan per Store</h3>
      <div className="card table-scroll p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-3 font-semibold">Site</th>
              <th className="py-2 pr-3 font-semibold">Nama</th>
              <th className="py-2 pr-3 font-semibold">Omzet Hari Ini</th>
              <th className="py-2 pr-3 font-semibold">Omzet Bln Ini</th>
              <th className="py-2 pr-3 font-semibold">Trx Bln</th>
              <th className="py-2 pr-3 font-semibold">Laba Bln</th>
              <th className="py-2 pr-3 font-semibold">Saldo Kas</th>
              <th className="py-2 pr-3 font-semibold">Stok Tipis</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice().sort((a, b) => b.dash.omzetBulanIni - a.dash.omzetBulanIni).map((r) => (
              <tr key={r.store.id} className="border-t border-gray-100">
                <td className="py-2 pr-3 font-bold">{r.store.kode_site}</td>
                <td className="py-2 pr-3">{r.store.nama}</td>
                <td className="py-2 pr-3">{rupiah(r.dash.omzetHariIni)}</td>
                <td className="py-2 pr-3">{rupiah(r.dash.omzetBulanIni)}</td>
                <td className="py-2 pr-3">{r.dash.transaksiBulanIni}</td>
                <td className="py-2 pr-3">{rupiah(r.dash.labaBulanIni)}</td>
                <td className="py-2 pr-3">{rupiah(r.kas.saldo)}</td>
                <td className="py-2 pr-3">
                  <span className={r.dash.stokMenipis.length ? "font-bold text-danger" : ""}>{r.dash.stokMenipis.length}</span>
                </td>
                <td className="py-2 pr-3">{statusBadge(r.store)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Mode read-only. Semua angka dari transaksi berstatus Selesai + Jurnal Kas tiap store.</p>
    </div>
  );
}
