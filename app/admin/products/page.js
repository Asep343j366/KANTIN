"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah } from "@/lib/format";
import Button from "@/components/Button";

const empty = { nama: "", deskripsi: "", harga: "", hpp: "", category_id: "", stok: "", tersedia: true, foto_url: "" };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);

  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("urutan"),
    ]);
    setProducts(p || []);
    setCategories(c || []);
  }
  useEffect(() => { load(); }, []);

  async function del(id) {
    if (!confirm("Hapus produk ini?")) return;
    await supabase.from("products").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-extrabold">Produk ({products.length})</h1>
        <button onClick={() => setEditing(empty)} className="btn-primary">+ Tambah</button>
      </div>

      <div className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className="card flex items-center gap-3 p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface">
              {p.foto_url && /* eslint-disable-next-line @next/next/no-img-element */ (
                <img src={p.foto_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{p.nama}</p>
              <p className="text-sm text-ink-soft">
                {rupiah(p.harga)} · HPP {rupiah(p.hpp || 0)} · Laba {rupiah((p.harga || 0) - (p.hpp || 0))} · Stok {p.stok}
              </p>
            </div>
            <button onClick={() => setEditing(p)} className="btn-outline px-3 py-2 text-xs">Edit</button>
            <button onClick={() => del(p.id)} className="text-danger">✕</button>
          </div>
        ))}
      </div>

      {editing && (
        <ProductForm product={editing} categories={categories}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const [f, setF] = useState({ ...empty, ...product, harga: product.harga || "", hpp: product.hpp ?? "", stok: product.stok ?? "" });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setError(""); setSaving(true);
    try {
      let foto_url = f.foto_url;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `prod-${Date.now()}.${ext}`;
        const { error: e } = await supabase.storage.from("products").upload(path, file);
        if (e) throw e;
        foto_url = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        nama: f.nama.trim(),
        deskripsi: f.deskripsi?.trim() || null,
        harga: parseInt(f.harga) || 0,
        hpp: parseInt(f.hpp) || 0,
        stok: parseInt(f.stok) || 0,
        category_id: f.category_id || null,
        tersedia: !!f.tersedia,
        foto_url: foto_url || null,
      };
      if (!payload.nama) throw new Error("Nama wajib diisi");
      if (product.id) {
        const { error: e } = await supabase.from("products").update(payload).eq("id", product.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("products").insert(payload);
        if (e) throw e;
      }
      onSaved();
    } catch (e) {
      setError(e.message || String(e));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{product.id ? "Edit Produk" : "Tambah Produk"}</h2>
          <button onClick={onClose} className="text-ink-soft">✕</button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Nama produk" value={f.nama} onChange={(e) => set("nama", e.target.value)} />
          <textarea className="input" rows={2} placeholder="Deskripsi" value={f.deskripsi || ""} onChange={(e) => set("deskripsi", e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Harga Jual</label>
              <input className="input" type="number" placeholder="0" value={f.harga} onChange={(e) => set("harga", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">HPP (Modal)</label>
              <input className="input" type="number" placeholder="0" value={f.hpp} onChange={(e) => set("hpp", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Stok</label>
              <input className="input" type="number" placeholder="0" value={f.stok} onChange={(e) => set("stok", e.target.value)} />
            </div>
          </div>
          {(parseInt(f.harga) > 0) && (
            <p className="-mt-1 text-xs text-ink-soft">
              Laba per item: <b className="text-success">{rupiah((parseInt(f.harga) || 0) - (parseInt(f.hpp) || 0))}</b>
            </p>
          )}
          <select className="input" value={f.category_id || ""} onChange={(e) => set("category_id", e.target.value)}>
            <option value="">— Pilih kategori —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
          </select>
          <div>
            <label className="mb-1 block text-sm font-semibold">Foto produk</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {f.foto_url && !file && /* eslint-disable-next-line @next/next/no-img-element */ (
              <img src={f.foto_url} alt="" className="mt-2 h-24 rounded-lg object-cover" />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.tersedia} onChange={(e) => set("tersedia", e.target.checked)} />
            Tersedia untuk dipesan
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={save} loading={saving} className="btn-block">Simpan</Button>
        </div>
      </div>
    </div>
  );
}
