"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";
import Button from "@/components/Button";

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [moves, setMoves] = useState([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // {product, mode}
  const [me, setMe] = useState("admin");

  async function load() {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from("products").select("id,nama,harga,hpp,stok,tersedia").order("nama"),
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    setProducts(p || []); setMoves(m || []);
  }
  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.email || "admin"));
    const ch = supabase.channel("inv")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, load).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const filtered = products.filter((p) => p.nama.toLowerCase().includes(q.toLowerCase()));
  const totalSku = products.length;
  const nilaiStok = products.reduce((s, p) => s + p.stok * (p.hpp || 0), 0);
  const menipis = products.filter((p) => p.stok <= 5).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold">Inventory</h1>
        <Link href="/admin/products" className="btn-primary px-4 py-2 text-sm">+ Item Baru</Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi c="#1B6FEB" label="Total SKU" value={totalSku} />
        <Kpi c="#22C55E" label="Nilai Stok (HPP)" value={rupiah(nilaiStok)} />
        <Kpi c="#EF4444" label="Stok Menipis" value={menipis} />
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari barang..." className="input my-4" />

      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-2 font-semibold">Nama</th>
              <th className="py-2 pr-2 font-semibold">Stok</th>
              <th className="py-2 pr-2 font-semibold">HPP</th>
              <th className="py-2 pr-2 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="py-2 pr-2">{p.nama}</td>
                <td className="py-2 pr-2">
                  <span className={p.stok <= 5 ? "font-bold text-danger" : "font-semibold"}>{p.stok}</span>
                </td>
                <td className="py-2 pr-2">{rupiah(p.hpp || 0)}</td>
                <td className="py-2 pr-2">
                  <div className="flex gap-1">
                    <button onClick={() => setModal({ product: p, mode: "masuk" })} className="rounded-lg bg-primary-light px-2 py-1 text-xs font-semibold text-primary">+ Stok</button>
                    <button onClick={() => setModal({ product: p, mode: "sesuai" })} className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold">Sesuaikan</button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={4} className="py-8 text-center text-ink-soft">Tidak ada barang.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-5 font-bold">Riwayat Pergerakan Stok</h2>
      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-2 font-semibold">Tanggal</th>
              <th className="py-2 pr-2 font-semibold">Barang</th>
              <th className="py-2 pr-2 font-semibold">Tipe</th>
              <th className="py-2 pr-2 font-semibold">Jumlah</th>
              <th className="py-2 pr-2 font-semibold">Stok Akhir</th>
              <th className="py-2 pr-2 font-semibold">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {moves.length ? moves.map((m) => (
              <tr key={m.id} className="border-t border-gray-100">
                <td className="py-2 pr-2 whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                <td className="py-2 pr-2">{m.nama_produk}</td>
                <td className="py-2 pr-2">
                  <span className={`badge ${m.tipe === "masuk" ? "bg-green-100 text-green-700" : m.tipe === "keluar" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>{m.tipe}</span>
                </td>
                <td className="py-2 pr-2">{m.tipe === "keluar" ? "−" : m.tipe === "masuk" ? "+" : ""}{Math.abs(m.jumlah)}</td>
                <td className="py-2 pr-2">{m.stok_akhir ?? "-"}</td>
                <td className="py-2 pr-2">{m.catatan || "-"}</td>
              </tr>
            )) : <tr><td colSpan={6} className="py-8 text-center text-ink-soft">Belum ada pergerakan stok.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && <StockModal {...modal} me={me} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}

function StockModal({ product, mode, me, onClose, onDone }) {
  const [qty, setQty] = useState("");
  const [catatan, setCatatan] = useState("");
  const [biaya, setBiaya] = useState("");
  const [toJournal, setToJournal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    const n = parseInt(qty);
    if (isNaN(n)) return setErr("Isi jumlah / stok baru.");
    setSaving(true);
    try {
      let stokBaru, jumlah, tipe;
      if (mode === "masuk") {
        if (n <= 0) throw new Error("Jumlah harus lebih dari 0.");
        stokBaru = product.stok + n; jumlah = n; tipe = "masuk";
      } else {
        if (n < 0) throw new Error("Stok tidak boleh negatif.");
        stokBaru = n; jumlah = n - product.stok; tipe = "penyesuaian";
      }
      const { error: e1 } = await supabase.from("products").update({ stok: stokBaru }).eq("id", product.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("stock_movements").insert({
        product_id: product.id, nama_produk: product.nama, tipe, jumlah,
        stok_akhir: stokBaru, catatan: catatan.trim() || (mode === "masuk" ? "Stok masuk" : "Penyesuaian stok"), oleh: me,
      });
      if (e2) throw e2;
      if (mode === "masuk" && toJournal && parseInt(biaya) > 0) {
        await supabase.from("journal").insert({
          jenis: "keluar", kategori: "Belanja Stok",
          keterangan: `Belanja stok ${product.nama} (${n} pcs)`, jumlah: parseInt(biaya), dicatat_oleh: me,
        });
      }
      onDone();
    } catch (e) {
      setErr(e.message || String(e)); setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{mode === "masuk" ? "Stok Masuk" : "Penyesuaian Stok"}</h3>
          <button onClick={onClose} className="text-ink-soft">✕</button>
        </div>
        <p className="mb-3 text-sm text-ink-soft">{product.nama} · stok saat ini <b>{product.stok}</b></p>
        <label className="mb-1 block text-sm font-semibold">{mode === "masuk" ? "Jumlah Masuk" : "Stok Baru (hasil hitung fisik)"}</label>
        <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="input mb-3" placeholder="0" />
        {mode === "masuk" && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={toJournal} onChange={(e) => setToJournal(e.target.checked)} />
              Catat biaya belanja ke Jurnal Kas
            </label>
            {toJournal && (
              <input type="number" value={biaya} onChange={(e) => setBiaya(e.target.value)} className="input my-2" placeholder="Total biaya belanja (Rp)" />
            )}
          </>
        )}
        <label className="mb-1 mt-2 block text-sm font-semibold">Catatan</label>
        <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className="input mb-3" placeholder="Opsional" />
        {err && <p className="mb-2 text-sm text-danger">{err}</p>}
        <Button onClick={save} loading={saving} className="btn-block">Simpan</Button>
      </div>
    </div>
  );
}

function Kpi({ c, label, value }) {
  return (
    <div className="card relative overflow-hidden p-3">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: c }} />
      <p className="text-[11px] font-semibold text-ink-soft">{label}</p>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  );
}
