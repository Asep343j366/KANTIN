"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyAm, getAmStores, siteLabel } from "@/lib/am";
import { rupiah, fmtDateTime } from "@/lib/format";
import { Kpi, BarRank, TrendBars } from "@/components/AmCharts";

// Default rentang = bulan berjalan (tgl 1 s.d. hari ini), tanggal lokal.
function defaultDates() {
  const now = new Date();
  const loc = (d) => d.toLocaleDateString("en-CA");
  return { start: loc(new Date(now.getFullYear(), now.getMonth(), 1)), end: loc(now) };
}

// Dashboard Store: SATU panggilan RPC per perubahan store/rentang (agregasi di DB).
export default function StoreDashboardPage() {
  const [stores, setStores] = useState(null);
  const [sid, setSid] = useState("");
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const dd = defaultDates();
  const [start, setStart] = useState(dd.start);
  const [end, setEnd] = useState(dd.end);

  useEffect(() => {
    (async () => {
      const am = await getMyAm();
      const list = await getAmStores(am?.sites || []);
      setStores(list);
      if (list.length) setSid(list[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!sid || !start || !end || end < start) return;
    let alive = true;
    (async () => {
      setLoading(true); setErr("");
      const { data, error } = await supabase.rpc("am_store_dashboard", { p_store: sid, p_start: start, p_end: end });
      if (!alive) return;
      if (error) setErr(/am_store_dashboard/.test(error.message) ? "Fungsi dashboard belum ada — jalankan supabase/migration_v28_nama_store_am_rpc.sql dulu." : error.message);
      setD(data || null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [sid, start, end]);

  const store = stores?.find((s) => s.id === sid);

  if (!stores) return <p className="text-ink-soft">Memuat...</p>;
  if (!stores.length) return (
    <div className="card p-6 text-center">
      <h2 className="text-lg font-extrabold">Belum ada store terdaftar</h2>
      <p className="mt-1 text-sm text-ink-soft">Store under area Anda belum dibuat di sistem.</p>
    </div>
  );

  const p = d?.periode || {};
  const kas = d?.kas || {};

  return (
    <div>
      {/* Pilih store + rentang tanggal (berlaku untuk SEMUA bagian di bawah) */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label className="mb-1 block text-xs font-semibold">Pilih Store</label>
            <select value={sid} onChange={(e) => setSid(e.target.value)} className="input">
              {stores.map((s) => <option key={s.id} value={s.id}>{siteLabel(s)}</option>)}
            </select>
          </div>
          <div><label className="mb-1 block text-xs font-semibold">Tanggal Awal</label>
            <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className="input" /></div>
          <div><label className="mb-1 block text-xs font-semibold">Tanggal Akhir</label>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="input" /></div>
        </div>
        {store && (
          <p className="mt-2 text-xs text-ink-soft">
            {store.nama_store && store.nama ? <>Nama kantin: <b>{store.nama}</b> · </> : null}
            Status: <b>{store.status}</b>{store.is_trial ? " · trial" : ""} · Ringkasan periode, grafik & Jurnal Kas mengikuti rentang tanggal ini.
          </p>
        )}
      </div>

      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{err}</p>}

      {!d ? (
        <p className="text-ink-soft">{loading ? "Memuat data store..." : ""}</p>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* KPI harian/bulanan */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi c="#22C55E" label="Omzet Hari Ini" value={rupiah(d.hari.omzet)} sub={`${d.hari.trx} transaksi`} />
            <Kpi c="#1B6FEB" label="Omzet Bulan Ini" value={rupiah(d.bulan.omzet)} sub={`${d.bulan.trx} transaksi`} />
            <Kpi c="#14B8A6" label="Laba Hari Ini" value={rupiah(d.hari.laba)} sub="omzet − HPP" />
            <Kpi c="#6366F1" label="Laba Bulan Ini" value={rupiah(d.bulan.laba)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi c="#EC4899" label="Avg. Basket (periode)" value={rupiah(p.avg_basket)} />
            <Kpi c="#0EA5E9" label="Saldo Kas" value={rupiah(d.saldo)} sub="sampai saat ini" />
            <Kpi c="#F59E0B" label="Total Produk" value={d.total_produk} />
          </div>

          {/* Ringkasan periode */}
          <Section>Ringkasan Laporan Periode</Section>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi c="#22C55E" label="Total Penjualan" value={rupiah(p.omzet)} />
            <Kpi c="#6366F1" label="Laba (omzet − HPP)" value={rupiah(p.laba)} />
            <Kpi c="#1B6FEB" label="Total Qty" value={p.qty} />
            <Kpi c="#A855F7" label="Total Transaksi" value={p.trx} />
            <Kpi c="#EC4899" label="SKU Terjual" value={p.sku} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 font-bold">🏆 Top Fast Moving</h3>
              <BarRank items={(d.top_qty || []).map((r) => ({ ...r, value: Number(r.value) }))} fmt={(v) => v} unit=" pcs" />
            </div>
            <div className="card p-4">
              <h3 className="mb-3 font-bold">💰 Top Sales Contributor</h3>
              <BarRank items={(d.top_total || []).map((r) => ({ ...r, value: Number(r.value) }))} fmt={rupiah} />
            </div>
          </div>

          <div className="card mt-4 p-4">
            <h3 className="mb-3 font-bold">📈 Trend Penjualan Harian</h3>
            <TrendBars trend={(d.trend || []).map((t) => ({ date: t.date, omzet: Number(t.omzet), qty: Number(t.qty) }))} />
          </div>

          {/* Jurnal Kas (mengikuti rentang tanggal) */}
          <Section>💵 Jurnal Kas (read-only) · periode</Section>
          {/* Saldo Awal + Uang Masuk − Pengeluaran = Sisa Saldo (akhir periode) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi c="#64748B" label="Saldo Awal" value={kas.saldo_awal == null ? "—" : rupiah(kas.saldo_awal)} sub={`sebelum ${start}`} />
            <Kpi c="#22C55E" label="+ Uang Masuk" value={rupiah(kas.masuk)} />
            <Kpi c="#EF4444" label="− Pengeluaran" value={rupiah(kas.keluar)} />
            <Kpi c="#1B6FEB" label="= Sisa Saldo" sub={`per ${end}`}
              value={kas.saldo_awal == null ? "—" : rupiah(Number(kas.saldo_awal) + Number(kas.masuk || 0) - Number(kas.keluar || 0))} />
            <Kpi c={Number(p.laba) >= 0 ? "#14B8A6" : "#EF4444"} label="Laba (Omzet − HPP)" value={rupiah(p.laba)} sub="penjualan periode ini" />
          </div>
          {kas.saldo_awal == null && (
            <p className="mt-2 text-xs text-ink-soft">Saldo awal muncul setelah migration_v32 dijalankan.</p>
          )}
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
                {(d.jurnal || []).length ? d.jurnal.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="whitespace-nowrap py-2 pr-2">{fmtDateTime(r.created_at)}</td>
                    <td className="py-2 pr-2">
                      <span className={`badge ${r.jenis === "masuk" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{r.jenis === "masuk" ? "Masuk" : "Keluar"}</span>
                    </td>
                    <td className="py-2 pr-2">{r.kategori}</td>
                    <td className="py-2 pr-2">{r.keterangan}</td>
                    <td className={`py-2 pr-2 font-semibold ${r.jenis === "masuk" ? "text-success" : "text-danger"}`}>
                      {r.jenis === "masuk" ? "+" : "−"}{rupiah(r.jumlah)}
                    </td>
                  </tr>
                )) : <tr><td colSpan={5} className="py-8 text-center text-ink-soft">Tidak ada catatan kas pada periode ini.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {kas.count > (d.jurnal || []).length ? `Menampilkan ${(d.jurnal || []).length} dari ${kas.count} catatan terbaru pada periode ini (total di kartu tetap dihitung penuh).` : `${kas.count || 0} catatan pada periode ini.`}
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ children }) {
  return <h2 className="mb-2 mt-5 text-sm font-extrabold text-[#0F4575]">{children}</h2>;
}
