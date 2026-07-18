"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime, STATUS } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import Receipt from "@/components/Receipt";

const STEPS = ["menunggu_verifikasi", "diproses", "siap_diambil", "selesai"];

export default function OrderStatus() {
  const { code } = useParams();
  const search = useSearchParams();
  const isNew = search.get("new") === "1";
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);

  async function load() {
    const { data: o } = await supabase.from("orders").select("*").eq("kode_pesanan", code).single();
    if (o) {
      const [{ data: its }, { data: set }] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", o.id),
        supabase.from("settings").select("*").eq("id", 1).single(),
      ]);
      setItems(its || []);
      setSettings(set || null);
    }
    setOrder(o || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("order-" + code)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (p) => {
        if (p.new?.kode_pesanan === code) setOrder(p.new);
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [code]);

  if (loading) return <div className="container-app pt-10 text-center text-ink-soft">Memuat...</div>;
  if (!order) return (
    <main className="container-app pt-16 text-center">
      <p className="text-ink-soft">Pesanan <b>{code}</b> tidak ditemukan.</p>
      <Link href="/order" className="btn-primary mt-4 inline-flex">Coba Lagi</Link>
    </main>
  );

  const stepIdx = STEPS.indexOf(order.status);
  const dibatalkan = order.status === "dibatalkan";

  return (
    <main className="container-app pb-10 pt-5">
      {isNew && (
        <div className="card mb-4 border-l-4 border-success bg-green-50 p-4">
          <p className="font-bold text-green-700">Pesanan berhasil dikirim! 🎉</p>
          <p className="text-sm text-green-700">Menunggu admin memverifikasi pembayaranmu.</p>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-soft">Kode Pesanan</p>
            <p className="text-lg font-extrabold tracking-wide">{order.kode_pesanan}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-xs text-ink-soft">{fmtDateTime(order.created_at)}</p>

        {dibatalkan ? (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            Pesanan dibatalkan.{order.alasan_tolak ? ` Alasan: ${order.alasan_tolak}` : ""}
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {i > 0 && <div className={`h-1 flex-1 ${i <= stepIdx ? "bg-primary" : "bg-gray-200"}`} />}
                  <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i <= stepIdx ? "bg-primary text-white" : "bg-gray-200 text-ink-soft"}`}>{i + 1}</div>
                  {i < STEPS.length - 1 && <div className={`h-1 flex-1 ${i < stepIdx ? "bg-primary" : "bg-gray-200"}`} />}
                </div>
                <span className="mt-1 text-center text-[10px] leading-tight text-ink-soft">{STATUS[s].label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mt-4 p-5">
        <h2 className="mb-3 font-bold">Detail Pesanan</h2>
        {items.map((it) => (
          <div key={it.id} className="flex justify-between py-1 text-sm">
            <span className="text-ink-soft">{it.jumlah}× {it.nama_produk}{it.catatan ? ` (${it.catatan})` : ""}</span>
            <span className="font-semibold">{rupiah(it.harga * it.jumlah)}</span>
          </div>
        ))}
        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-bold">
          <span>Total</span><span className="text-primary">{rupiah(order.total)}</span>
        </div>
        <div className="mt-2 text-sm text-ink-soft">
          <p>Nama: {order.nama_pelanggan}</p>
          <p>HP: {order.no_hp}</p>
          {order.catatan && <p>Catatan: {order.catatan}</p>}
        </div>
      </div>

      {order.status !== "menunggu_verifikasi" && order.status !== "dibatalkan" && (
        <button onClick={() => setShowReceipt(true)} className="btn-primary mt-4 w-full">
          Lihat Struk Digital
        </button>
      )}
      <Link href="/" className="btn-outline mt-3 w-full">Kembali ke Menu</Link>

      {showReceipt && (
        <Receipt order={order} items={items} settings={settings} onClose={() => setShowReceipt(false)} />
      )}
    </main>
  );
}
