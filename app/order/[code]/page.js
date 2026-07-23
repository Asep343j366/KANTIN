"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";
import Receipt from "@/components/Receipt";

export default function OrderStatus() {
  const { code } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);

  async function loadOrder() {
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
    loadOrder();
    // Realtime: begitu webhook Louvin menandai order lunas, layar ikut berubah
    const ch = supabase
      .channel(`order-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `kode_pesanan=eq.${code}` },
        (payload) => setOrder(payload.new)
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [code]);

  if (loading) return <div className="container-app pt-10 text-center text-ink-soft">Memuat...</div>;
  if (!order) return (
    <main className="container-app pt-16 text-center">
      <p className="text-ink-soft">Pesanan <b>{code}</b> tidak ditemukan.</p>
      <Link href="/order" className="btn-primary mt-4 inline-flex">Coba Lagi</Link>
    </main>
  );

  const paid = order.status === "selesai";
  const failed = order.status === "dibatalkan" || order.payment_status === "failed";

  return (
    <main className="container-app pb-10 pt-5">
      {paid && (
        <div className="card mb-4 border-l-4 border-success bg-green-50 p-4 text-center">
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#34D26A] to-[#16A34A] text-2xl font-black text-white">✓</div>
          <p className="font-bold text-green-700">Pembayaran berhasil! 🎉</p>
          <p className="text-sm text-green-700">Terima kasih, pesananmu sudah kami terima.</p>
        </div>
      )}
      {!paid && !failed && (
        <div className="card mb-4 border-l-4 border-amber-400 bg-amber-50 p-4 text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
          <p className="font-bold text-amber-700">Menunggu pembayaran…</p>
          <p className="text-sm text-amber-700">Status akan otomatis diperbarui setelah pembayaran QRIS terkonfirmasi.</p>
        </div>
      )}
      {failed && (
        <div className="card mb-4 border-l-4 border-danger bg-red-50 p-4 text-center">
          <p className="font-bold text-red-700">Pembayaran gagal / kedaluwarsa</p>
          <p className="text-sm text-red-700">Silakan pesan ulang dari menu.</p>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-soft">Kode Pesanan</p>
            <p className="text-lg font-extrabold tracking-wide">{order.kode_pesanan}</p>
          </div>
          <span className={`badge ${paid ? "bg-green-100 text-green-700" : failed ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            {paid ? "Selesai" : failed ? "Gagal" : "Menunggu Pembayaran"}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">{fmtDateTime(order.created_at)}</p>
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

      {paid && (
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
