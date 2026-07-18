"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";

export default function AdminTransaksi() {
  const [orders, setOrders] = useState([]);
  const [detail, setDetail] = useState(null);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState({ count: 0, total: 0 });

  async function load() {
    const { data } = await supabase.from("orders").select("*")
      .eq("status", "selesai").order("created_at", { ascending: false });
    setOrders(data || []);
    const today = new Date().toISOString().slice(0, 10);
    const done = (data || []).filter((o) => o.created_at.slice(0, 10) === today);
    setStats({ count: done.length, total: done.reduce((s, o) => s + o.total, 0) });
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-trx")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const list = orders.filter((o) =>
    o.kode_pesanan.toLowerCase().includes(q.toLowerCase()) ||
    o.nama_pelanggan.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-ink-soft">Transaksi Hari Ini</p>
          <p className="text-2xl font-extrabold">{stats.count}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-soft">Omzet Hari Ini</p>
          <p className="text-2xl font-extrabold text-primary">{rupiah(stats.total)}</p>
        </div>
      </div>

      <h1 className="mb-3 text-lg font-extrabold">Riwayat Transaksi</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Cari kode / nama pembeli..." className="input mb-4" />

      {list.length === 0 ? (
        <p className="py-10 text-center text-ink-soft">Belum ada transaksi.</p>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <button key={o.id} onClick={() => setDetail(o)} className="card block w-full p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="font-bold">{o.kode_pesanan}</span>
                <span className="font-semibold text-primary">{rupiah(o.total)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm text-ink-soft">
                <span>{o.nama_pelanggan} · {o.no_hp}</span>
                <span>{fmtDateTime(o.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

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
          <p>{fmtDateTime(order.created_at)}</p>
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
