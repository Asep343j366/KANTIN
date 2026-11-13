"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
import { rupiah } from "@/lib/format";
import { confirmDialog } from "@/lib/confirmDialog";
import Button from "@/components/Button";
import PromoBanner from "@/components/store/PromoBanner";
import { TEMPLATES, AKSEN, todayStr, promoStatus, discountedPrice, bundleNormal, pctOff } from "@/lib/promo";

const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const blank = () => ({
  jenis: "diskon", nama: "", aktif: true, mulai: todayStr(), berakhir: addDays(7), kuota: "",
  diskon_tipe: "persen", diskon_nilai: 10, harga_paket: "", items: [],
  banner: { template: "navy", judul: "", sub: "", aksen: "", foto: true },
});

const STATUS = {
  aktif: ["Aktif", "bg-green-100 text-green-700"],
  terjadwal: ["Terjadwal", "bg-blue-100 text-blue-700"],
  berakhir: ["Berakhir", "bg-gray-100 text-ink-soft"],
  nonaktif: ["Nonaktif", "bg-gray-100 text-ink-soft"],
};

export default function PromoPage() {
  const [storeId, setStoreId] = useState(null);
  const [promos, setPromos] = useState(null);
  const [products, setProducts] = useState([]);
  const [usage, setUsage] = useState({});
  const [edit, setEdit] = useState(null); // objek form (baru / ubah)
  const [err, setErr] = useState("");

  async function load(sid = storeId) {
    if (!sid) return;
    const [{ data: pr, error }, { data: prods }] = await Promise.all([
      supabase.from("promos").select("*").eq("store_id", sid).order("created_at", { ascending: false }),
      supabase.from("products").select("id,nama,harga,foto_url,tersedia,stok").eq("store_id", sid).order("nama"),
    ]);
    if (error) { setErr(/promos/.test(error.message) ? "Tabel promo belum ada — jalankan supabase/migration_v27_promo.sql dulu." : error.message); setPromos([]); return; }
    setPromos(pr || []);
    setProducts(prods || []);
    const u = {};
    await Promise.all((pr || []).filter((p) => p.kuota > 0).map(async (p) => {
      const { data } = await supabase.rpc("promo_usage", { p_promo: p.id });
      u[p.id] = Number(data) || 0;
    }));
    setUsage(u);
  }

  useEffect(() => {
    getMyStore().then((s) => { if (s?.store_id) { setStoreId(s.store_id); load(s.store_id); } else setPromos([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prodMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  async function toggle(p) {
    const { error } = await supabase.from("promos").update({ aktif: !p.aktif, updated_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return setErr(error.message);
    load();
  }
  async function remove(p) {
    if (!(await confirmDialog({ title: "Hapus promo?", message: `Promo "${p.nama}" akan dihapus. Riwayat penjualan tetap tersimpan.`, confirmLabel: "Hapus", danger: true }))) return;
    const { error } = await supabase.from("promos").delete().eq("id", p.id);
    if (error) return setErr(error.message);
    load();
  }

  if (promos === null) return <p className="text-ink-soft">Memuat...</p>;

  if (edit) return (
    <PromoEditor initial={edit} products={products} prodMap={prodMap} storeId={storeId}
      onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
  );

  const today = todayStr();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold">Promo</h1>
          <p className="text-sm text-ink-soft">Diskon item & paket bundling, tampil sebagai banner geser di toko.</p>
        </div>
        <Button onClick={() => setEdit(blank())}>+ Buat promo</Button>
      </div>
      {err && <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{err}</p>}

      {promos.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-bold">Belum ada promo</p>
          <p className="mt-1 text-sm text-ink-soft">Buat diskon atau paket hemat — bannernya langsung tampil di toko pembeli.</p>
          <Button onClick={() => setEdit(blank())} className="mt-4">+ Buat promo pertama</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {promos.map((p) => {
            const st = promoStatus(p, today);
            const [lbl, cls] = STATUS[st];
            return (
              <div key={p.id} className="card p-3">
                <PromoBanner promo={p} prodMap={prodMap} sisa={p.kuota > 0 ? Math.max(0, p.kuota - (usage[p.id] || 0)) : null} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`badge ${cls}`}>{lbl}</span>
                  <span className="badge bg-primary-light text-primary">{p.jenis === "bundling" ? "Bundling" : "Diskon"}</span>
                  <span className="text-xs text-ink-soft">{p.mulai} → {p.berakhir}</span>
                  {p.kuota > 0 && <span className="text-xs text-ink-soft">· terpakai {usage[p.id] || 0}/{p.kuota}</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setEdit({ ...p, kuota: p.kuota ?? "", harga_paket: p.harga_paket ?? "", banner: { ...blank().banner, ...(p.banner || {}) } })}
                    className="btn-outline btn-xs">Ubah</button>
                  <button onClick={() => toggle(p)} className="btn-outline btn-xs">{p.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
                  <button onClick={() => remove(p)} className="btn-ghost btn-xs text-danger">Hapus</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromoEditor({ initial, products, prodMap, storeId, onCancel, onSaved }) {
  const [f, setF] = useState(initial);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setB = (k, v) => setF((p) => ({ ...p, banner: { ...p.banner, [k]: v } }));

  const chosen = new Set(f.items.map((i) => i.product_id));
  const list = products.filter((p) => p.nama.toLowerCase().includes(q.toLowerCase())).slice(0, 60);

  function toggleItem(p) {
    if (chosen.has(p.id)) set("items", f.items.filter((i) => i.product_id !== p.id));
    else set("items", [...f.items, { product_id: p.id, qty: 1 }]);
  }
  const setQty = (id, qty) => set("items", f.items.map((i) => (i.product_id === id ? { ...i, qty: Math.max(1, qty) } : i)));

  const normal = bundleNormal(f, prodMap);
  const paket = parseInt(f.harga_paket) || 0;

  async function save() {
    setErr("");
    const nama = (f.nama || "").trim();
    if (!nama) return setErr("Nama promo wajib diisi.");
    if (!f.items.length) return setErr(f.jenis === "bundling" ? "Pilih minimal 2 menu untuk paket." : "Pilih minimal 1 menu yang didiskon.");
    if (f.jenis === "bundling" && f.items.length < 2 && (f.items[0]?.qty || 1) < 2) return setErr("Paket bundling minimal 2 menu (atau 1 menu dengan jumlah ≥ 2).");
    if (f.berakhir < f.mulai) return setErr("Tanggal berakhir tidak boleh sebelum tanggal mulai.");
    if (f.jenis === "diskon") {
      const v = parseInt(f.diskon_nilai) || 0;
      if (v <= 0) return setErr("Nilai diskon harus lebih dari 0.");
      if (f.diskon_tipe === "persen" && v >= 100) return setErr("Diskon persen harus di bawah 100%.");
    } else {
      if (paket <= 0) return setErr("Harga paket wajib diisi.");
      if (normal && paket >= normal) return setErr(`Harga paket harus lebih murah dari harga normal (${rupiah(normal)}).`);
    }
    const payload = {
      store_id: storeId, jenis: f.jenis, nama, aktif: !!f.aktif, mulai: f.mulai, berakhir: f.berakhir,
      kuota: parseInt(f.kuota) > 0 ? parseInt(f.kuota) : null,
      diskon_tipe: f.jenis === "diskon" ? f.diskon_tipe : null,
      diskon_nilai: f.jenis === "diskon" ? parseInt(f.diskon_nilai) || 0 : null,
      harga_paket: f.jenis === "bundling" ? paket : null,
      items: f.items.map((i) => (f.jenis === "bundling" ? { product_id: i.product_id, qty: i.qty || 1 } : { product_id: i.product_id })),
      banner: f.banner, updated_at: new Date().toISOString(),
    };
    setSaving(true);
    const { error } = f.id
      ? await supabase.from("promos").update(payload).eq("id", f.id)
      : await supabase.from("promos").insert(payload);
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved();
  }

  const preview = { ...f, nama: f.nama || "Nama promo", harga_paket: paket, diskon_nilai: parseInt(f.diskon_nilai) || 0 };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onCancel} className="btn-outline btn-xs">← Kembali</button>
        <h1 className="text-lg font-extrabold">{f.id ? "Ubah promo" : "Buat promo"}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        {/* 1. Atur promo */}
        <div className="card space-y-3 p-4">
          <h2 className="font-bold">1 · Atur promo</h2>
          <div>
            <L>Jenis promo</L>
            <div className="flex gap-1 rounded-xl bg-surface p-1">
              {[["diskon", "Diskon item"], ["bundling", "Bundling (paket)"]].map(([k, l]) => (
                <button key={k} onClick={() => set("jenis", k)}
                  className={`flex-1 rounded-lg py-2 text-[13px] font-semibold ${f.jenis === k ? "bg-[#0f2a5c] text-white" : "text-ink-soft"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div><L>Nama promo</L><input className="input" value={f.nama} onChange={(e) => set("nama", e.target.value)} placeholder={f.jenis === "bundling" ? "Paket Hemat Siang" : "Diskon Snack Sore"} /></div>

          {f.jenis === "diskon" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <L>Tipe potongan</L>
                <select className="input" value={f.diskon_tipe} onChange={(e) => set("diskon_tipe", e.target.value)}>
                  <option value="persen">Persen (%)</option>
                  <option value="nominal">Nominal (Rp)</option>
                </select>
              </div>
              <div><L>{f.diskon_tipe === "persen" ? "Diskon (%)" : "Potongan (Rp)"}</L>
                <input className="input" type="number" min="1" value={f.diskon_nilai} onChange={(e) => set("diskon_nilai", e.target.value)} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><L>Harga paket (Rp)</L><input className="input" type="number" min="1" value={f.harga_paket} onChange={(e) => set("harga_paket", e.target.value)} placeholder="10000" /></div>
              <div><L>Harga normal</L>
                <div className="input bg-surface">{rupiah(normal)}{paket > 0 && normal > paket && <span className="ml-1 text-xs font-bold text-green-600">hemat {pctOff(normal, paket)}%</span>}</div></div>
            </div>
          )}

          <div>
            <L>{f.jenis === "bundling" ? "Isi paket" : "Menu yang didiskon"} ({f.items.length})</L>
            {f.items.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {f.items.map((it) => {
                  const p = prodMap[it.product_id];
                  if (!p) return null;
                  return (
                    <div key={it.product_id} className="flex items-center gap-2 rounded-xl bg-surface px-2.5 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate font-semibold">{p.nama}</span>
                      {f.jenis === "bundling" ? (
                        <span className="flex items-center gap-1">
                          <button onClick={() => setQty(p.id, (it.qty || 1) - 1)} className="h-6 w-6 rounded-md bg-white font-bold">−</button>
                          <b className="w-5 text-center">{it.qty || 1}</b>
                          <button onClick={() => setQty(p.id, (it.qty || 1) + 1)} className="h-6 w-6 rounded-md bg-white font-bold">+</button>
                        </span>
                      ) : (
                        <span className="text-xs"><s className="text-ink-soft">{rupiah(p.harga)}</s> <b className="text-[#e8561a]">{rupiah(discountedPrice(p.harga, preview))}</b></span>
                      )}
                      <button onClick={() => toggleItem(p)} className="text-ink-soft" aria-label="Hapus">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu untuk ditambahkan…" />
            <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-100">
              {list.map((p) => (
                <button key={p.id} onClick={() => toggleItem(p)}
                  className={`flex w-full items-center justify-between border-b border-gray-50 px-3 py-2 text-left text-sm last:border-0 ${chosen.has(p.id) ? "bg-primary-light" : "hover:bg-surface"}`}>
                  <span className="truncate">{chosen.has(p.id) ? "✓ " : "+ "}{p.nama}</span>
                  <span className="shrink-0 text-xs text-ink-soft">{rupiah(p.harga)}</span>
                </button>
              ))}
              {!list.length && <p className="p-3 text-center text-xs text-ink-soft">Menu tidak ditemukan.</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><L>Mulai</L><input className="input" type="date" value={f.mulai} onChange={(e) => set("mulai", e.target.value)} /></div>
            <div><L>Berakhir</L><input className="input" type="date" value={f.berakhir} onChange={(e) => set("berakhir", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><L>Kuota (opsional)</L><input className="input" type="number" min="0" value={f.kuota} onChange={(e) => set("kuota", e.target.value)} placeholder="Tanpa batas" />
              <p className="mt-1 text-[11px] text-ink-soft">{f.jenis === "bundling" ? "Jumlah paket" : "Jumlah unit"} maksimal terjual.</p></div>
            <label className="mt-6 flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={f.aktif} onChange={(e) => set("aktif", e.target.checked)} /> Aktif
            </label>
          </div>
        </div>

        {/* 2. Desain banner */}
        <div className="card space-y-3 p-4 lg:sticky lg:top-4 lg:self-start">
          <h2 className="font-bold">2 · Desain banner</h2>
          <div>
            <L>Template</L>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => setB("template", t.id)} title={t.nama}
                  className={`relative h-11 overflow-hidden rounded-lg ${f.banner.template === t.id ? "ring-2 ring-[#ff7a2a] ring-offset-2" : ""}`}
                  style={{ background: t.bg }}>
                  <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full" style={{ background: t.aksen }} />
                  <span className="absolute bottom-0.5 left-1 text-[10px] font-bold" style={{ color: t.text }}>{t.nama}</span>
                </button>
              ))}
            </div>
          </div>
          <div><L>Judul banner</L><input className="input" value={f.banner.judul} maxLength={32} onChange={(e) => setB("judul", e.target.value)} placeholder={f.nama || "Kosong = nama promo"} /></div>
          <div><L>Sub judul</L><input className="input" value={f.banner.sub} maxLength={48} onChange={(e) => setB("sub", e.target.value)} placeholder="Kosong = daftar menu otomatis" /></div>
          <div>
            <L>Warna aksen</L>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setB("aksen", "")} className={`h-8 rounded-full border px-3 text-xs font-semibold ${!f.banner.aksen ? "border-[#0f2a5c] text-[#0f2a5c]" : "border-gray-200 text-ink-soft"}`}>Bawaan</button>
              {AKSEN.map((c) => (
                <button key={c} onClick={() => setB("aksen", c)} aria-label={c}
                  className={`h-8 w-8 rounded-full border-2 border-white shadow ${f.banner.aksen === c ? "ring-2 ring-[#0f2a5c]" : "ring-1 ring-gray-200"}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.banner.foto !== false} onChange={(e) => setB("foto", e.target.checked)} /> Tampilkan foto produk otomatis</label>

          <div>
            <L>Pratinjau langsung</L>
            <div className="mx-auto max-w-sm"><PromoBanner promo={preview} prodMap={prodMap} sisa={parseInt(f.kuota) > 0 ? parseInt(f.kuota) : null} /></div>
          </div>
          {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={onCancel} className="btn-outline flex-1">Batal</button>
            <Button onClick={save} loading={saving} className="flex-[2]">{f.id ? "Simpan perubahan" : "Simpan & aktifkan"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function L({ children }) {
  return <label className="mb-1 block text-xs font-semibold">{children}</label>;
}
