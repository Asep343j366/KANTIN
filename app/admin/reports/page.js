"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah } from "@/lib/format";
import { computeReport } from "@/lib/reports";

const PAGE_SIZE = 10;
const palette = ["#1B6FEB", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#14B8A6", "#EC4899", "#6366F1"];

function defaultDates() {
  const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function ReportsPage() {
  const [raw, setRaw] = useState(null);
  const dd = defaultDates();
  const [start, setStart] = useState(dd.start);
  const [end, setEnd] = useState(dd.end);
  const [namaId, setNamaId] = useState("ALL");
  const [kategori, setKategori] = useState("ALL");
  const [applied, setApplied] = useState({ start: dd.start, end: dd.end, namaId: "ALL", kategori: "ALL" });

  const [tableSearch, setTableSearch] = useState("");
  const [sortKey, setSortKey] = useState("qty");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      const [{ data: orders }, { data: items }, { data: products }, { data: cats }] = await Promise.all([
        supabase.from("orders").select("id,kode_pesanan,total,created_at,status"),
        supabase.from("order_items").select("order_id,product_id,nama_produk,harga,jumlah"),
        supabase.from("products").select("id,nama,harga,stok,tersedia,category_id"),
        supabase.from("categories").select("id,nama"),
      ]);
      const catMap = {}; (cats || []).forEach((c) => (catMap[c.id] = c.nama));
      const prods = (products || []).map((p) => ({ ...p, categoryNama: catMap[p.category_id] || "Lainnya" }));
      setRaw({ orders: orders || [], items: items || [], products: prods, cats: cats || [] });
    })();
  }, []);

  const data = useMemo(() => {
    if (!raw) return null;
    return computeReport(raw.orders, raw.items, raw.products, applied);
  }, [raw, applied]);

  if (!raw || !data) return <p className="text-ink-soft">Memuat laporan...</p>;

  const kategoriOptions = ["Makanan", "Minuman", "Snack", "Lainnya", ...raw.cats.map((c) => c.nama)]
    .filter((v, i, a) => a.indexOf(v) === i);

  function apply() { setApplied({ start, end, namaId, kategori }); setPage(1); }
  function reset() {
    const d = defaultDates();
    setStart(d.start); setEnd(d.end); setNamaId("ALL"); setKategori("ALL");
    setApplied({ start: d.start, end: d.end, namaId: "ALL", kategori: "ALL" }); setPage(1);
  }
  function sortBy(k) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "NAMA" ? "asc" : "desc"); }
  }

  // detail table filter + sort
  let rows = data.detailRows.filter((r) => r.NAMA.toLowerCase().includes(tableSearch.toLowerCase()));
  rows = rows.slice().sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === "NAMA" || sortKey === "lastSale") { va = va || ""; vb = vb || ""; return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va)); }
    va = va ?? 0; vb = vb ?? 0; return sortDir === "asc" ? va - vb : vb - va;
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = rows.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  function exportExcel() {
    const header = ["Nama Barang", "Kategori", "Qty Terjual", "Total Penjualan", "Harga Rata2", "Kontribusi %", "Last Sale", "Days Since Last Sale"];
    const lines = [header.join(",")];
    data.detailRows.forEach((r) => {
      lines.push([`"${r.NAMA}"`, r.KATEGORI, r.qty, r.total, Math.round(r.avgHarga), r.kontribusi.toFixed(1), r.lastSale || "-", r.daysSinceLastSale ?? "-"].join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `laporan-penjualan-${applied.start}_${applied.end}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">Laporan Penjualan</h1>
      <p className="mb-4 text-xs text-ink-soft">Seluruh angka dihitung dari transaksi nyata (status Selesai).</p>

      {/* Filter */}
      <div className="card mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Tanggal Awal"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" /></Field>
          <Field label="Tanggal Akhir"><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input" /></Field>
          <Field label="Nama Barang">
            <select value={namaId} onChange={(e) => setNamaId(e.target.value)} className="input">
              <option value="ALL">Semua Barang</option>
              {raw.products.slice().sort((a, b) => a.nama.localeCompare(b.nama)).map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </Field>
          <Field label="Kategori">
            <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="input">
              <option value="ALL">Semua Kategori</option>
              {kategoriOptions.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={apply} className="btn-primary px-4 py-2 text-sm">Cari</button>
          <button onClick={reset} className="btn-outline px-4 py-2 text-sm">Reset</button>
          <button onClick={exportExcel} className="btn-outline px-4 py-2 text-sm">Export Excel</button>
          <button onClick={() => window.print()} className="btn-outline px-4 py-2 text-sm">Cetak/PDF</button>
        </div>
      </div>

      {/* KPI */}
      <SectionTitle>Ringkasan KPI</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi c="#22C55E" label="Total Penjualan" value={rupiah(data.kpi.totalPenjualan)} />
        <Kpi c="#1B6FEB" label="Total Qty Terjual" value={data.kpi.totalQty} />
        <Kpi c="#A855F7" label="Total Transaksi" value={data.kpi.totalTransaksi} />
        <Kpi c="#EC4899" label="Jumlah SKU Terjual" value={data.kpi.skuCount} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi c="#F59E0B" label="Avg. Penjualan/Hari" value={rupiah(Math.round(data.kpi.avgPerHari))} />
        <Kpi c="#14B8A6" label="Avg. Qty/Transaksi" value={data.kpi.avgQtyPerTrx.toFixed(1)} />
        <Kpi c="#6366F1" label="Avg. Basket Size" value={rupiah(Math.round(data.kpi.avgBasket))} />
        <Kpi c="#EF4444" label="Produk Aktif Terjual" value={data.kpi.produkAktifTerjual} />
      </div>

      {/* Detail table */}
      <SectionTitle>Detail Penjualan Barang</SectionTitle>
      <div className="card mb-4 p-4">
        <input value={tableSearch} onChange={(e) => { setTableSearch(e.target.value); setPage(1); }}
          placeholder="Cari nama barang di tabel ini..." className="input mb-3" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft">
                <Th>Rank</Th>
                <Th sortable k="NAMA" cur={sortKey} dir={sortDir} onSort={sortBy}>Nama</Th>
                <Th sortable k="qty" cur={sortKey} dir={sortDir} onSort={sortBy}>Qty</Th>
                <Th sortable k="total" cur={sortKey} dir={sortDir} onSort={sortBy}>Total</Th>
                <Th sortable k="avgHarga" cur={sortKey} dir={sortDir} onSort={sortBy}>Harga Rata2</Th>
                <Th sortable k="kontribusi" cur={sortKey} dir={sortDir} onSort={sortBy}>Kontribusi</Th>
                <Th sortable k="lastSale" cur={sortKey} dir={sortDir} onSort={sortBy}>Last Sale</Th>
                <Th sortable k="daysSinceLastSale" cur={sortKey} dir={sortDir} onSort={sortBy}>Days Since</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? pageRows.map((r, i) => (
                <tr key={r.ID} className="border-t border-gray-100">
                  <td className="py-2 pr-2">{(curPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="py-2 pr-2">{r.NAMA}</td>
                  <td className="py-2 pr-2">{r.qty}</td>
                  <td className="py-2 pr-2">{rupiah(r.total)}</td>
                  <td className="py-2 pr-2">{rupiah(Math.round(r.avgHarga))}</td>
                  <td className="py-2 pr-2">{r.kontribusi.toFixed(1)}%</td>
                  <td className="py-2 pr-2">{r.lastSale || "-"}</td>
                  <td className="py-2 pr-2">{r.daysSinceLastSale ?? "-"}</td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="py-8 text-center text-ink-soft">Tidak ada data pada filter ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <button disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} className="rounded-lg bg-surface px-3 py-1 font-semibold disabled:opacity-40">← Prev</button>
          <span className="text-ink-soft">Hal {curPage}/{totalPages} ({rows.length} barang)</span>
          <button disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)} className="rounded-lg bg-surface px-3 py-1 font-semibold disabled:opacity-40">Next →</button>
        </div>
      </div>

      <SectionTitle>🏆 Top 10 Fast Moving Item</SectionTitle>
      <div className="card mb-3 p-4"><BarChart items={data.fastMoving} valueKey="qty" fmt={(v) => v + " pcs"} /></div>

      <SectionTitle>💰 Top 10 Sales Contributor</SectionTitle>
      <div className="card mb-3 p-4"><BarChart items={data.contributors} valueKey="total" fmt={(v) => rupiah(v)} /></div>

      <SectionTitle>🐌 Top 10 Slow Moving Item</SectionTitle>
      <div className="card mb-4 p-4">
        <MiniTable rows={data.slowMoving} cols={[
          { h: "Nama", get: (r) => r.NAMA },
          { h: "Qty", get: (r) => r.qty },
          { h: "Last Sale", get: (r) => r.lastSale || "Belum pernah" },
          { h: "Hari sejak terjual", get: (r) => (r.days === Infinity ? "-" : r.days) },
        ]} />
      </div>

      <SectionTitle>🚨 Dead Stock Monitoring</SectionTitle>
      <p className="mb-2 text-xs text-ink-soft">Kriteria dead stock: tidak terjual &gt; 30 hari — {data.deadStock.length} barang terdeteksi.</p>
      <div className="card mb-4 p-4">
        <MiniTable rows={data.deadStock} cols={[
          { h: "Nama", get: (r) => <span>{r.NAMA} <span className="ml-1 rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">DEAD</span></span> },
          { h: "Stok", get: (r) => r.stok },
          { h: "Last Sale", get: (r) => r.lastSale || "Belum pernah" },
          { h: "Hari", get: (r) => (r.days === Infinity ? "-" : r.days) },
        ]} />
      </div>

      <SectionTitle>📦 Stock Monitoring</SectionTitle>
      <p className="mb-2 text-xs text-ink-soft">Estimasi Hari Bertahan = Stok ÷ Rata-rata penjualan/hari.</p>
      <div className="card mb-4 p-4">
        <MiniTable rows={data.stockMonitoring} cols={[
          { h: "Nama", get: (r) => r.NAMA },
          { h: "Stok", get: (r) => r.stok },
          { h: "Qty Terjual", get: (r) => r.qty },
          { h: "Avg/Hari", get: (r) => r.avgSalesPerHari.toFixed(2) },
          { h: "Estimasi Habis", get: (r) => r.estimasiHari === null ? "-" : <span className={r.estimasiHari <= 7 ? "font-bold text-danger" : ""}>{Math.round(r.estimasiHari)} hari</span> },
        ]} />
      </div>

      <SectionTitle>📈 Trend Penjualan Harian</SectionTitle>
      <div className="card mb-4 p-4"><TrendChart trend={data.trend} /></div>

      <SectionTitle>🤖 AI Sales Insight</SectionTitle>
      <div className="card mb-6 border border-purple-100 bg-purple-50 p-4">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {data.insights.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="mb-1 block text-xs font-semibold">{label}</label>{children}</div>;
}
function SectionTitle({ children }) {
  return <h2 className="mb-2 mt-5 text-sm font-extrabold text-[#0F4575]">{children}</h2>;
}
function Kpi({ c, label, value }) {
  return (
    <div className="card relative overflow-hidden p-3">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: c }} />
      <p className="text-[11px] font-semibold text-ink-soft">{label}</p>
      <p className="mt-1 text-base font-extrabold">{value}</p>
    </div>
  );
}
function Th({ children, sortable, k, cur, dir, onSort }) {
  if (!sortable) return <th className="py-2 pr-2 font-semibold">{children}</th>;
  const active = cur === k;
  return (
    <th onClick={() => onSort(k)} className={`cursor-pointer select-none py-2 pr-2 font-semibold ${active ? "text-primary" : ""}`}>
      {children}<span className="ml-1 text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
    </th>
  );
}
function BarChart({ items, valueKey, fmt }) {
  if (!items.length) return <p className="text-sm text-ink-soft">Belum ada data.</p>;
  const max = Math.max(...items.map((i) => i[valueKey])) || 1;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.ID} className="flex items-center gap-3 text-xs">
          <span className="w-4 shrink-0 font-bold text-ink-soft">{i + 1}</span>
          <span className="w-24 shrink-0 truncate font-semibold">{it.NAMA}</span>
          <span className="h-4 flex-1 overflow-hidden rounded bg-surface">
            <span className="block h-full rounded" style={{ width: `${(it[valueKey] / max) * 100}%`, background: palette[i % palette.length] }} />
          </span>
          <span className="w-20 shrink-0 text-right font-bold">{fmt(it[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}
function MiniTable({ rows, cols }) {
  if (!rows.length) return <p className="text-sm text-ink-soft">Belum ada data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-soft">{cols.map((c, i) => <th key={i} className="py-2 pr-2 font-semibold">{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100">
              {cols.map((c, j) => <td key={j} className="py-2 pr-2">{c.get(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function TrendChart({ trend }) {
  if (!trend.length) return <p className="text-sm text-ink-soft">Belum ada data.</p>;
  const w = Math.max(320, trend.length * 12), h = 140, pad = 24;
  const max = Math.max(...trend.map((t) => t.omzet)) || 1;
  const pts = trend.map((t, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, trend.length - 1);
    const y = h - pad - (t.omzet / max) * (h - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = path + ` L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h}>
        <path d={area} fill="#1B6FEB22" />
        <path d={path} fill="none" stroke="#1B6FEB" strokeWidth="2" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2" fill="#1B6FEB" />)}
      </svg>
    </div>
  );
}
