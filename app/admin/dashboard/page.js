"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah } from "@/lib/format";
import { computeDashboard } from "@/lib/reports";

async function fetchAll() {
  const [{ data: orders }, { data: items }, { data: products }, { data: cats }, { data: settings }] =
    await Promise.all([
      supabase.from("orders").select("id,kode_pesanan,total,created_at,status"),
      supabase.from("order_items").select("order_id,product_id,nama_produk,harga,jumlah"),
      supabase.from("products").select("id,nama,harga,hpp,stok,tersedia,category_id"),
      supabase.from("categories").select("id,nama"),
      supabase.from("settings").select("*").eq("id", 1).single(),
    ]);
  const catMap = {}; (cats || []).forEach((c) => (catMap[c.id] = c.nama));
  const prods = (products || []).map((p) => ({ ...p, categoryNama: catMap[p.category_id] || "Lainnya" }));
  return { orders: orders || [], items: items || [], products: prods, settings };
}

export default function DashboardPage() {
  const [d, setD] = useState(null);
  const [threshold, setThreshold] = useState(5);

  async function load() {
    const { orders, items, products, settings } = await fetchAll();
    const th = settings?.stok_menipis_threshold || 5;
    setThreshold(th);
    setD(computeDashboard(orders, items, products, th));
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  if (!d) return <p className="text-ink-soft">Memuat dashboard...</p>;

  const palette = ["#1B6FEB", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#14B8A6"];

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi color="#22C55E" label="Omzet Hari Ini" value={rupiah(d.omzetHariIni)} />
        <Kpi color="#1B6FEB" label="Omzet Bulan Ini" value={rupiah(d.omzetBulanIni)} sub={`${d.transaksiBulanIni} transaksi bln ini`} />
        <Kpi color="#A855F7" label="Transaksi Hari Ini" value={d.transaksiHariIni} />
        <Kpi color="#EC4899" label="Avg. Basket Size" value={rupiah(d.avgBasketSize)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi color="#14B8A6" label="Keuntungan Hari Ini" value={rupiah(d.labaHariIni)} sub="omzet − HPP" />
        <Kpi color="#6366F1" label="Keuntungan Bulan Ini" value={rupiah(d.labaBulanIni)} />
        <Kpi color="#F59E0B" label="Total Produk" value={d.totalProduk} />
        <Kpi color="#EF4444" label="Stok Menipis" value={d.stokMenipis.length} sub={`ambang ≤ ${threshold}`} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 font-bold">Metode Pembayaran</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ background: palette[0] }} />
            QRIS — 100%
          </div>
          <p className="mt-2 text-xs text-ink-soft">Semua transaksi menggunakan pembayaran QRIS.</p>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 font-bold">Produk Terlaris</h3>
          {d.produkTerlaris.length ? (
            <div className="space-y-2">
              {d.produkTerlaris.map((p, i) => (
                <div key={i} className="flex justify-between border-b border-gray-100 pb-2 text-sm last:border-0">
                  <span>{i + 1}. {p.nama}</span>
                  <b>{p.qty} terjual</b>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-ink-soft">Belum ada penjualan.</p>}
        </div>
      </div>

      <div className="card mt-4 p-4">
        <h3 className="mb-3 font-bold">⚠️ Stok Menipis</h3>
        {d.stokMenipis.length ? (
          <div className="space-y-2">
            {d.stokMenipis.map((p, i) => (
              <div key={i} className="flex justify-between border-b border-gray-100 pb-2 text-sm last:border-0">
                <span>{p.nama}</span>
                <b className="text-danger">Sisa {p.stok}</b>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-ink-soft">Semua stok aman.</p>}
      </div>
    </div>
  );
}

function Kpi({ color, label, value, sub }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: color }} />
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-extrabold" style={{ color: "#1E2A3A" }}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-soft">{sub}</p>}
    </div>
  );
}
