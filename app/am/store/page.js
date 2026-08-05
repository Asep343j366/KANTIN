"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyAm, getAmStores, loadStoreData } from "@/lib/am";
import { computeDashboard, computeReport } from "@/lib/reports";
import { rupiah, fmtDateTime } from "@/lib/format";
import { Kpi, BarRank, TrendBars } from "@/components/AmCharts";

function defaultDates() {
  const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29);
  const loc = (d) => d.toLocaleDateString("en-CA");
  return { start: loc(start), end: loc(end) };
}

export default function StoreDashboardPage() {
  const [stores, setStores] = useState(null);
  const [sid, setSid] = useState("");
  const [raw, setRaw] = useState(null);
  const [journal, setJournal] = useState([]);
  const [loading, setLoading] = useState(false);
  const dd = defaultDates();
  const [start, setStart] = useState(dd.start);
  const [end, setEnd] = useState(dd.end);

  // daftar store
  useEffect(() => {
    (async () => {
      const am = await getMyAm();
      const list = await getAmStores(am?.sites || []);
      setStores(list);
      if (list.length) setSid(list[0].id);
    })();
  }, []);

  // muat data saat store dipilih
  useEffect(() => {
    if (!sid) return;
    (async () => {
      setLoading(true);
      const d = await loadStoreData(sid);
      const { data: jr } = await supabase
        .from("journal").select("*").eq("store_id", sid).order("created_at", { ascending: false });
      setRaw(d);
      setJournal(jr || []);
      setLoading(false);
    })();
  }, [sid]);

  const dash = useMemo(() => raw ? computeDashboard(raw.orders, raw.items, raw.products, 5) : null, [raw]);
  const report = useMemo(() => raw ? computeReport(raw.orders, raw.items, raw.products, { start, end }) : null, [raw, start, end]);

  const store = stores?.find((s) => s.id === sid);

  if (!stores) return <p className="text-ink-soft">Memuat...</p>;
  if (!stores.length) return (
    <div className="card p-6 text-center">
      <h2 className="text-lg font-extrabold">Belum ada store terdaftar</h2>
      <p className="mt-1 text-sm text-ink-soft">Store under area Anda belum dibuat di sistem.</p>
    </div>
  );

  return (
    <div>
      {/* Dropdown pilih store */}
      <div className="card mb-4 p-4">
        <label className="mb-1 block text-xs font-semibold">Pilih Store</label>
        <select value={sid} onChange={(e) => setSid(e.target.value)} className="input">
          {stores.map((s) => <option key={s.id} value={s.id}>{s.kode_site} — {s.nama}</option>)}
        </select>
        {store && <p className="mt-2 text-xs text-ink-soft">Status: <b>{store.status}</b>{store.is_trial ? " · trial" : ""}</p>}
      </div>

      {loading || !dash || !report ? (
        <p className="text-ink-soft">Memuat data store...</p>
      ) : (
        <>
          {/* KPI harian/bulanan */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi c="#22C55E" label="Omzet Hari Ini" value={rupiah(dash.omzetHariIni)} sub={`${dash.transaksiHariIni} transaksi`} />
            <Kpi c="#1B6FEB" label="Omzet Bulan Ini" value={rupiah(dash.omzetBulanIni)} sub={`${dash.transaksiBulanIni} transaksi`} />
            <Kpi c="#14B8A6" label="Laba Hari Ini" value={rupiah(dash.labaHariIni)} sub="omzet − HPP" />
            <Kpi c="#6366F1" label="Laba Bulan Ini" value={rupiah(dash.labaBulanIni)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi c="#EC4899" label="Avg. Basket" value={rupiah(dash.avgBasketSize)} />
            <Kpi c="#0EA5E9" label="Saldo Kas" value={rupiah(raw.kas.saldo)} />
            <Kpi c="#F59E0B" label="Total Produk" value={dash.totalProduk} />
            <Kpi c="#EF4444" label="Stok Menipis" value={dash.stokMenipis.length} sub="ambang ≤ 5" />
          </div>

          {/* Filter periode laporan */}
          <div className="card mt-4 p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div><label className="mb-1 block text-xs font-semibold">Tanggal Awal</label>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" /></div>
              <div><label className="mb-1 block text-xs font-semibold">Tanggal Akhir</label>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input" /></div>
            </div>
            <p className="mt-2 text-[11px] text-ink-soft">Bagian laporan di bawah mengikuti rentang tanggal ini.</p>
          </div>

          {/* KPI laporan periode */}
          <Section>Ringkasan Laporan Periode</Section>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi c="#22C55E" label="Total Penjualan" value={rupiah(report.kpi.totalPenjualan)} />
            <Kpi c="#1B6FEB" label="Total Qty" value={report.kpi.totalQty} />
            <Kpi c="#A855F7" label="Total Transaksi" value={report.kpi.totalTransaksi} />
            <Kpi c="#EC4899" label="SKU Terjual" value={report.kpi.skuCount} />
          </div>

          {/* Produk terlaris + trend */}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 font-bold">🏆 Top Fast Moving</h3>
              <BarRank items={report.fastMoving.map((r) => ({ key: r.ID, label: r.NAMA, value: r.qty }))} fmt={(v) => v} unit=" pcs" />
            </div>
            <div className="card p-4">
              <h3 className="mb-3 font-bold">💰 Top Sales Contributor</h3>
              <BarRank items={report.contributors.map((r) => ({ key: r.ID, label: r.NAMA, value: r.total }))} fmt={rupiah} />
            </div>
          </div>

          <div className="card mt-4 p-4">
            <h3 className="mb-3 font-bold">📈 Trend Penjualan Harian</h3>
            <TrendBars trend={report.trend} />
          </div>

          {/* Stok menipis + slow/dead */}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 font-bold">⚠️ Stok Menipis</h3>
              {dash.stokMenipis.length ? (
                <div className="space-y-2">
                  {dash.stokMenipis.slice(0, 10).map((p, i) => (
                    <div key={i} className="flex justify-between border-b border-gray-100 pb-2 text-sm last:border-0">
                      <span>{p.nama}</span><b className="text-danger">Sisa {p.stok}</b>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-ink-soft">Semua stok aman.</p>}
            </div>
            <div className="card p-4">
              <h3 className="mb-3 font-bold">🚨 Dead Stock ({report.deadStock.length})</h3>
              {report.deadStock.length ? (
                <MiniTable rows={report.deadStock.slice(0, 10)} cols={[
                  { h: "Nama", get: (r) => r.NAMA },
                  { h: "Stok", get: (r) => r.stok },
                  { h: "Hari", get: (r) => (r.days === Infinity ? "-" : r.days) },
                ]} />
              ) : <p className="text-sm text-ink-soft">Tidak ada dead stock (&gt;30 hari).</p>}
            </div>
          </div>

          {/* Stock monitoring */}
          <Section>📦 Stock Monitoring (estimasi habis)</Section>
          <div className="card p-4">
            <MiniTable rows={report.stockMonitoring.slice(0, 12)} cols={[
              { h: "Nama", get: (r) => r.NAMA },
              { h: "Stok", get: (r) => r.stok },
              { h: "Qty Terjual", get: (r) => r.qty },
              { h: "Avg/Hari", get: (r) => r.avgSalesPerHari.toFixed(2) },
              { h: "Estimasi Habis", get: (r) => r.estimasiHari === null ? "-" : <span className={r.estimasiHari <= 7 ? "font-bold text-danger" : ""}>{Math.round(r.estimasiHari)} hari</span> },
            ]} />
          </div>

          {/* AI insight */}
          <Section>🤖 Insight</Section>
          <div className="card border border-purple-100 bg-purple-50 p-4">
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {report.insights.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
            </ul>
          </div>

          {/* Jurnal Kas read-only */}
          <Section>💵 Jurnal Kas (read-only)</Section>
          <div className="grid grid-cols-3 gap-3">
            <Kpi c="#1B6FEB" label="Saldo Kas" value={rupiah(raw.kas.saldo)} />
            <Kpi c="#22C55E" label="Uang Masuk" value={rupiah(raw.kas.masuk)} />
            <Kpi c="#EF4444" label="Uang Keluar" value={rupiah(raw.kas.keluar)} />
          </div>
          <div className="card mt-3 table-scroll p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="py-2 pr-2 font-semibold">Tanggal</th>
                  <th className="py-2 pr-2 font-semibold">Jenis</th>
                  <th className="py-2 pr-2 font-semibold">Kategori</th>
                  <th className="py-2 pr-2 font-semibold">Keterangan</th>
                  <th className="py-2 pr-2 font-semibold">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {journal.length ? journal.slice(0, 30).map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                    <td className="py-2 pr-2">
                      <span className={`badge ${r.jenis === "masuk" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{r.jenis === "masuk" ? "Masuk" : "Keluar"}</span>
                    </td>
                    <td className="py-2 pr-2">{r.kategori}</td>
                    <td className="py-2 pr-2">{r.keterangan}{r.nama_toko ? ` · ${r.nama_toko}` : ""}</td>
                    <td className={`py-2 pr-2 font-semibold ${r.jenis === "masuk" ? "text-success" : "text-danger"}`}>
                      {r.jenis === "masuk" ? "+" : "−"}{rupiah(r.jumlah)}
                    </td>
                  </tr>
                )) : <tr><td colSpan={5} className="py-8 text-center text-ink-soft">Belum ada catatan kas.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-soft">Menampilkan maksimal 30 catatan kas terbaru.</p>
        </>
      )}
    </div>
  );
}

function Section({ children }) {
  return <h2 className="mb-2 mt-5 text-sm font-extrabold text-[#0F4575]">{children}</h2>;
}
function MiniTable({ rows, cols }) {
  if (!rows.length) return <p className="text-sm text-ink-soft">Belum ada data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-ink-soft">{cols.map((c, i) => <th key={i} className="py-2 pr-2 font-semibold">{c.h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100">{cols.map((c, j) => <td key={j} className="py-2 pr-2">{c.get(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
