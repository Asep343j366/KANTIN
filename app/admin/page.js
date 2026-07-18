"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";

export default function AdminTransaksi() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [detail, setDetail] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [itemId, setItemId] = useState("ALL");
  const [q, setQ] = useState("");

  async function load() {
    const [{ data: o }, { data: it }, { data: p }] = await Promise.all([
      supabase.from("orders").select("*").eq("status", "selesai").order("created_at", { ascending: false }),
      supabase.from("order_items").select("order_id,product_id,nama_produk,harga,jumlah"),
      supabase.from("products").select("id,nama"),
    ]);
    setOrders(o || []); setItems(it || []); setProducts(p || []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("admin-trx")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // order_id -> set of product_id (untuk filter item)
  const orderProducts = useMemo(() => {
    const m = {};
    items.forEach((it) => { (m[it.order_id] = m[it.order_id] || new Set()).add(it.product_id); });
    return m;
  }, [items]);

  const list = orders.filter((o) => {
    const d = o.created_at.slice(0, 10);
    if (start && d < start) return false;
    if (end && d > end) return false;
    if (itemId !== "ALL" && !(orderProducts[o.id]?.has(itemId))) return false;
    if (q && !(o.kode_pesanan.toLowerCase().includes(q.toLowerCase()) || o.nama_pelanggan.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const totalOmzet = list.reduce((s, o) => s + o.total, 0);

  function resetFilter() { setStart(""); setEnd(""); setItemId("ALL"); setQ(""); }

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold">Riwayat Transaksi</h1>

      <div className="card mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold">Tanggal Awal</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Tanggal Akhir</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Barang</label>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="input">
              <option value="ALL">Semua Barang</option>
              {products.slice().sort((a, b) => a.nama.localeCompare(b.nama)).map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Cari</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kode / pembeli" className="input" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={resetFilter} className="btn-outline px-4 py-2 text-sm">Reset Filter</button>
          <p className="text-sm text-ink-soft">{list.length} transaksi · <b className="text-primary">{rupiah(totalOmzet)}</b></p>
        </div>
      </div>

      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-2 font-semibold">Tanggal</th>
              <th className="py-2 pr-2 font-semibold">Pembeli</th>
              <th className="py-2 pr-2 font-semibold">Total</th>
              <th className="py-2 pr-2 font-semibold">Metode</th>
              <th className="py-2 pr-2 font-semibold">Status</th>
              <th className="py-2 pr-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {list.length ? list.map((o) => (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="py-2 pr-2 whitespace-nowrap">{fmtDateTime(o.created_at)}</td>
                <td className="py-2 pr-2">{o.nama_pelanggan}<br /><span className="text-xs text-ink-soft">{o.kode_pesanan}</span></td>
                <td className="py-2 pr-2 font-semibold">{rupiah(o.total)}</td>
                <td className="py-2 pr-2">QRIS</td>
                <td className="py-2 pr-2"><span className="badge bg-green-100 text-green-700">Selesai</span></td>
                <td className="py-2 pr-2">
                  <button onClick={() => setDetail(o)} className="text-primary font-semibold">Detail</button>
                </td>
              </tr>
            )) : <tr><td colSpan={6} className="py-8 text-center text-ink-soft">Tidak ada transaksi pada filter ini.</td></tr>}
          </tbody>
        </table>
      </div>

      {detail && <TrxDetail order={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function TrxDetail({ order, onClose }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    supabase.from("order_items").select("*").eq("order_id", order.id).then(({ data }) => setItems(data || []));
  }, [order.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{order.kode_pesanan}</h2>
          <button onClick={onClose} className="text-ink-soft">✕</button>
        </div>
        <div className="mt-1 text-sm text-ink-soft">
          <p>{order.nama_pelanggan} · {order.no_hp}</p>
          <p>{fmtDateTime(order.created_at)} · QRIS</p>
          {order.catatan && <p>Catatan: {order.catatan}</p>}
        </div>
        <div className="my-3 rounded-xl bg-surface p-3">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between py-0.5 text-sm">
              <span>{it.jumlah}× {it.nama_produk}{it.catatan ? ` (${it.catatan})` : ""}</span>
              <span className="font-semibold">{rupiah(it.harga * it.jumlah)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold">
            <span>Total</span><span className="text-primary">{rupiah(order.total)}</span>
          </div>
        </div>
        <p className="mb-1 text-sm font-semibold">Bukti Pembayaran</p>
        {order.bukti_bayar_url ? (
          <a href={order.bukti_bayar_url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={order.bukti_bayar_url} alt="bukti" className="w-full rounded-xl border border-gray-100" />
          </a>
        ) : <p className="text-sm text-ink-soft">Tidak ada bukti.</p>}
      </div>
    </div>
  );
}
