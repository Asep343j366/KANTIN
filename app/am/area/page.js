"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah } from "@/lib/format";
import { Kpi, BarRank, Donut, TrendBars } from "@/components/AmCharts";

const thisMonth = () => new Date().toLocaleDateString("en-CA").slice(0, 7);
const monthLabel = (m) => {
  try { return new Date(m + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" }); } catch { return m; }
};

function statusBadge(s) {
  const map = {
    aktif: "bg-green-100 text-green-700",
    grace: "bg-amber-100 text-amber-700",
    nonaktif: "bg-red-100 text-red-600",
    suspended: "bg-gray-200 text-gray-600",
  };
  return <span className={`badge ${map[s?.status] || "bg-gray-100 text-gray-600"}`}>{s?.status || "-"}{s?.is_trial ? " · trial" : ""}</span>;
}

// Dashboard Area: SATU panggilan RPC (agregasi di database) → ringan.
export default function AreaDashboardPage() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr("");
      const { data: d, error } = await supabase.rpc("am_area_dashboard", { p_month: month });
      if (!alive) return;
      if (error) setErr(/am_area_dashboard/.test(error.message) ? "Fungsi dashboard belum ada — jalankan supabase/migration_v28_nama_store_am_rpc.sql dulu." : error.message);
      setData(d || null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [month]);

  const isCurrent = month === thisMonth();
  const rows = useMemo(() => (data?.stores || []).slice().sort((a, b) => b.omzet - a.omzet), [data]);
  const agg = useMemo(() => {
    const sum = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const nm = (r) => r.nama_store || r.nama;
    return {
      omzet: sum("omzet"), trx: sum("trx"), laba: sum("laba"),
      omzetHari: sum("omzet_hari"), trxHari: sum("trx_hari"), labaHari: sum("laba_hari"),
      saldo: sum("saldo"), masuk: sum("masuk"), keluar: sum("keluar"),
      leaderboard: rows.map((r) => ({ key: r.id, label: `${r.kode_site} · ${nm(r)}`, value: Number(r.omzet) })),
      kontribusi: rows.map((r) => ({ label: r.kode_site, value: Number(r.omzet) })),
    };
  }, [rows]);

  const Filter = (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold text-ink-soft">Bulan</label>
      <input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="input w-auto py-2" />
    </div>
  );

  if (err) return <div><div className="mb-4 flex justify-end">{Filter}</div><p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{err}</p></div>;
  if (loading && !data) return <p className="text-ink-soft">Memuat dashboard area...</p>;

  const missing = data?.missing || [];
  if (!rows.length) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-lg font-extrabold">Belum ada store terdaftar</h2>
        <p className="mt-1 text-sm text-ink-soft">Store under area Anda belum dibuat di sistem. Data akan muncul otomatis setelah store dibuat.</p>
        {missing.length > 0 && <p className="mt-3 text-xs text-ink-soft">Menunggu: {missing.join(", ")}</p>}
      </div>
    );
  }

  return (
    <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold">Rangkuman Area · {monthLabel(month)}</h1>
          <p className="text-xs text-ink-soft">{rows.length} store dipantau{missing.length ? ` · ${missing.length} site belum terdaftar (${missing.join(", ")})` : ""}.</p>
        </div>
        {Filter}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi c="#22C55E" label="Omzet Hari Ini" value={rupiah(agg.omzetHari)} sub={`${agg.trxHari} transaksi`} />
        <Kpi c="#1B6FEB" label={`Omzet ${isCurrent ? "Bulan Ini" : monthLabel(month)}`} value={rupiah(agg.omzet)} sub={`${agg.trx} transaksi`} />
        <Kpi c="#14B8A6" label="Laba Hari Ini" value={rupiah(agg.labaHari)} sub="omzet − HPP" />
        <Kpi c="#6366F1" label={`Laba ${isCurrent ? "Bulan Ini" : monthLabel(month)}`} value={rupiah(agg.laba)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi c="#0EA5E9" label="Saldo Kas Area" value={rupiah(agg.saldo)} sub="sampai saat ini" />
        <Kpi c="#22C55E" label="Uang Masuk (bulan)" value={rupiah(agg.masuk)} />
        <Kpi c="#EF4444" label="Uang Keluar (bulan)" value={rupiah(agg.keluar)} />
        <Kpi c="#F59E0B" label="Rata-rata / Transaksi" value={rupiah(agg.trx ? Math.round(agg.omzet / agg.trx) : 0)} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 font-bold">🏆 Peringkat Omzet Store</h3>
          <BarRank items={agg.leaderboard} fmt={rupiah} />
        </div>
        <div className="card p-4">
          <h3 className="mb-3 font-bold">🥧 Kontribusi Omzet per Store</h3>
          <Donut items={agg.kontribusi} />
        </div>
      </div>

      <div className="card mt-4 p-4">
        <h3 className="mb-3 font-bold">📈 Trend Omzet Area · {monthLabel(month)}</h3>
        <TrendBars trend={(data?.trend || []).map((t) => ({ date: t.date, omzet: Number(t.omzet) }))} />
      </div>

      <div className="card mt-4 p-4">
        <h3 className="mb-3 font-bold">🔥 Produk Terlaris Lintas Area</h3>
        <BarRank items={(data?.top || []).map((t, i) => ({ key: i, label: t.label, value: Number(t.value) }))} fmt={(v) => v} unit=" pcs" />
      </div>

      <h3 className="mb-2 mt-5 text-sm font-extrabold text-[#0F4575]">Ringkasan per Store · {monthLabel(month)}</h3>
      <div className="card table-scroll p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-3 font-semibold">Site</th>
              <th className="py-2 pr-3 font-semibold">Nama Store</th>
              <th className="py-2 pr-3 font-semibold">Omzet Hari Ini</th>
              <th className="py-2 pr-3 font-semibold">Omzet Bulan</th>
              <th className="py-2 pr-3 font-semibold">Trx Bulan</th>
              <th className="py-2 pr-3 font-semibold">Laba Bulan</th>
              <th className="py-2 pr-3 font-semibold">Saldo Kas</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="py-2 pr-3 font-bold">{r.kode_site}</td>
                <td className="py-2 pr-3">
                  {r.nama_store || r.nama}
                  {r.nama_store && r.nama && <span className="block text-[11px] text-ink-soft">Kantin: {r.nama}</span>}
                </td>
                <td className="py-2 pr-3">{rupiah(r.omzet_hari)}</td>
                <td className="py-2 pr-3">{rupiah(r.omzet)}</td>
                <td className="py-2 pr-3">{r.trx}</td>
                <td className="py-2 pr-3">{rupiah(r.laba)}</td>
                <td className="py-2 pr-3">{rupiah(r.saldo)}</td>
                <td className="py-2 pr-3">{statusBadge(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Mode read-only. Angka dari transaksi berstatus Selesai + Jurnal Kas tiap store (tanggal WIB).</p>
    </div>
  );
}
