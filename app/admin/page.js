"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

const FILTERS = [
  { key: "menunggu_verifikasi", label: "Perlu Verifikasi" },
  { key: "diproses", label: "Diproses" },
  { key: "siap_diambil", label: "Siap Diambil" },
  { key: "selesai", label: "Selesai" },
  { key: "dibatalkan", label: "Batal" },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("menunggu_verifikasi");
  const [detail, setDetail] = useState(null);
  const [stats, setStats] = useState({ count: 0, total: 0 });

  async function load() {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
    const today = new Date().toISOString().slice(0, 10);
    const done = (data || []).filter((o) => o.created_at.slice(0, 10) === today && o.status !== "dibatalkan");
    setStats({ count: done.length, total: done.reduce((s, o) => s + o.total, 0) });
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function setStatus(order, status, alasan = null) {
    await supabase.from("orders").update({ status, alasan_tolak: alasan }).eq("id", order.id);
    setDetail(null);
    load();
  }

  const list = orders.filter((o) => o.status === filter);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-ink-soft">Pesanan Hari Ini</p>
          <p className="text-2xl font-extrabold">{stats.count}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-soft">Pendapatan Hari Ini</p>
          <p className="text-2xl font-extrabold text-primary">{rupiah(stats.total)}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const n = orders.filter((o) => o.status === f.key).length;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold ${filter === f.key ? "bg-primary text-white" : "bg-white text-ink-soft"}`}>
              {f.label}{n > 0 && ` (${n})`}
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <p className="py-10 text-center text-ink-soft">Tidak ada pesanan.</p>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <button key={o.id} onClick={() => setDetail(o)} className="card block w-full p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="font-bold">{o.kode_pesanan}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-1 flex items-center justify-between text-sm text-ink-soft">
                <span>{o.nama_pelanggan} · {o.no_hp}</span>
                <span className="font-semibold text-primary">{rupiah(o.total)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{fmtDateTime(o.created_at)}</p>
            </button>
          ))}
        </div>
      )}

      {detail && <OrderDetail order={detail} onClose={() => setDetail(null)} onSet={setStatus} />}
    </div>
  );
}

function OrderDetail({ order, onClose, onSet }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    supabase.from("order_items").select("*").eq("order_id", order.id).then(({ data }) => setItems(data || []));
  }, [order.id]);

  function tolak() {
    const alasan = prompt("Alasan menolak pesanan ini?") || "Pembayaran tidak valid";
    onSet(order, "dibatalkan", alasan);
  }

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

        <div className="mt-4 space-y-2">
          {order.status === "menunggu_verifikasi" && (
            <div className="flex gap-2">
              <button onClick={tolak} className="btn-outline flex-1 text-danger">Tolak</button>
              <button onClick={() => onSet(order, "diproses")} className="btn-primary flex-1">Verifikasi & Proses</button>
            </div>
          )}
          {order.status === "diproses" && (
            <button onClick={() => onSet(order, "siap_diambil")} className="btn-primary w-full">Tandai Siap Diambil</button>
          )}
          {order.status === "siap_diambil" && (
            <button onClick={() => onSet(order, "selesai")} className="btn-primary w-full">Selesaikan Pesanan</button>
          )}
        </div>
      </div>
    </div>
  );
}
