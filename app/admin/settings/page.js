"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore, clearStoreCache } from "@/lib/store";
import Button from "@/components/Button";
import { compressImage } from "@/lib/compressImage";
import { DEFAULT_LOGO } from "@/lib/storeLogo";
import { confirmDialog } from "@/lib/confirmDialog";

// Potong tengah jadi persegi & perkecil ke 512px PNG (transparansi tetap).
async function toSquarePng(file, size = 512) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - side) / 2, sy = (bmp.height - side) / 2;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
  return await new Promise((res) => c.toBlob(res, "image/png"));
}

// Logo / ikon kantin: tampil di header toko, struk, sidebar admin, dan ikon
// aplikasi saat pelanggan "Tambahkan ke Layar Utama". Disimpan terpisah dari
// pengaturan lain (aman bila migrasi v24 belum dijalankan).
function LogoSettings({ storeId, current, nama, onSaved }) {
  const [file, setFile] = useState(null);
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const shown = prev || current || DEFAULT_LOGO;

  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setMsg("");
    try {
      const png = await toSquarePng(f);
      setFile(png);
      setPrev(URL.createObjectURL(png));
    } catch { setMsg("Gambar tidak bisa dibaca. Coba file PNG/JPG lain."); }
  }

  async function persist(url) {
    const { error } = await supabase.from("settings").upsert({ store_id: storeId, logo_url: url }, { onConflict: "store_id" });
    if (error) {
      if (/logo_url/.test(error.message || "")) throw new Error("Kolom logo belum ada — jalankan supabase/migration_v24_store_logo.sql dulu.");
      throw error;
    }
    try { sessionStorage.removeItem(`zk_logo_${storeId}`); } catch {}
    window.dispatchEvent(new Event("logo:update"));
    onSaved(url);
  }

  async function save() {
    if (!file || !storeId) return;
    setBusy(true); setMsg("");
    try {
      const path = `logo-${storeId}-${Date.now()}.png`;
      const { error } = await supabase.storage.from("qris").upload(path, file, { upsert: true, cacheControl: "31536000", contentType: "image/png" });
      if (error) throw error;
      const url = supabase.storage.from("qris").getPublicUrl(path).data.publicUrl;
      await persist(url);
      setFile(null); setPrev(null);
      setMsg("Logo tersimpan. Pelanggan melihatnya saat membuka/memuat ulang toko.");
    } catch (e) { setMsg("Gagal: " + (e.message || e)); }
    setBusy(false);
  }

  async function reset() {
    if (!(await confirmDialog({ title: "Kembalikan logo bawaan?", message: "Logo kantin akan diganti kembali ke logo bawaan.", confirmLabel: "Kembalikan" }))) return;
    setBusy(true); setMsg("");
    try { await persist(null); setFile(null); setPrev(null); setMsg("Logo dikembalikan ke bawaan."); }
    catch (e) { setMsg("Gagal: " + (e.message || e)); }
    setBusy(false);
  }

  return (
    <div className="card mb-4 p-5">
      <h2 className="font-bold">Logo / Ikon Kantin</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        Tampil di header toko, struk, sidebar admin, dan ikon aplikasi di HP pelanggan. Gunakan gambar <b>persegi</b> (minimal 512×512 px, PNG).
        Gambar non-persegi otomatis dipotong di tengah.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-5">
        {/* Pratinjau: ikon aplikasi */}
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="Logo" className="h-20 w-20 rounded-[22px] bg-white object-cover shadow-[0_6px_18px_rgba(15,42,92,.18)]" />
          <p className="mt-1.5 text-[11px] text-ink-soft">Ikon aplikasi</p>
        </div>
        {/* Pratinjau: header toko */}
        <div className="w-56 overflow-hidden rounded-2xl text-white" style={{ background: "linear-gradient(150deg,#16397a,#0f2a5c 55%,#0a1d42)" }}>
          <div className="flex items-center gap-2 px-3 pt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="" className="h-7 w-7 rounded-lg bg-white object-cover" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">DKantin</span>
          </div>
          <p className="px-3 pb-3 pt-2 text-sm font-extrabold">{nama || "Nama Kantin"}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="btn-outline cursor-pointer">
          Pilih gambar
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
        </label>
        <Button onClick={save} loading={busy} disabled={!file}>Simpan logo</Button>
        {(current || prev) && <button onClick={reset} disabled={busy} className="btn-ghost text-danger">Kembalikan bawaan</button>}
      </div>
      {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
    </div>
  );
}

export default function AdminSettings() {
  const [s, setS] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const st = await getMyStore();
      if (!st?.store_id) { setS({}); return; }
      setStoreId(st.store_id);
      const { data } = await supabase.from("settings").select("*").eq("store_id", st.store_id).maybeSingle();
      const seeded = data || {};
      // Bila nama_kantin kosong, pakai nama dari stores agar tak menimpa dgn default saat simpan.
      if (!seeded.nama_kantin && st.store?.nama) seeded.nama_kantin = st.store.nama;
      setS(seeded);
      setPreview(data?.qris_image_url || null);
    })();
  }, []);

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      let qris_image_url = s.qris_image_url;
      if (file) {
        const up = await compressImage(file);
        const path = `qris-${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("qris").upload(path, up, { upsert: true, cacheControl: "31536000", contentType: "image/jpeg" });
        if (error) throw error;
        qris_image_url = supabase.storage.from("qris").getPublicUrl(path).data.publicUrl;
      }
      if (!storeId) throw new Error("Store tidak dikenali.");
      const payload = {
        store_id: storeId,
        nama_kantin: s.nama_kantin || "Kantin Digital",
        no_wa_admin: s.no_wa_admin || null,
        jam_operasional: s.jam_operasional || null,
        alamat: s.alamat || null,
        info_rekening: s.info_rekening || null,
        papan_kejujuran: s.papan_kejujuran || null,
        stok_menipis_threshold: parseInt(s.stok_menipis_threshold) || 5,
        qris_image_url: qris_image_url || null,
      };
      const { error } = await supabase.from("settings").upsert(payload, { onConflict: "store_id" });
      if (error) throw error;

      // Sinkronkan nama ke tabel stores (dipakai sidebar admin, storefront, &
      // Kantin TV) agar tidak beda dengan nama di Pengaturan.
      const namaBaru = payload.nama_kantin;
      const { error: errStore } = await supabase.from("stores").update({ nama: namaBaru }).eq("id", storeId);
      if (errStore) throw errStore;
      clearStoreCache(); // agar sidebar menampilkan nama terbaru

      setMsg("Tersimpan.");
    } catch (e) {
      setMsg("Gagal: " + (e.message || e));
    }
    setSaving(false);
  }

  if (!s) return <p className="text-ink-soft">Memuat...</p>;

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold">Pengaturan Kantin</h1>
      <LogoSettings storeId={storeId} current={s.logo_url} nama={s.nama_kantin} onSaved={(u) => set("logo_url", u)} />
      <div className="card space-y-3 p-5">
        <div>
          <label className="mb-1 block text-sm font-semibold">Nama Kantin</label>
          <input className="input" value={s.nama_kantin || ""} onChange={(e) => set("nama_kantin", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Alamat</label>
          <input className="input" value={s.alamat || ""} onChange={(e) => set("alamat", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">No. WhatsApp</label>
            <input className="input" value={s.no_wa_admin || ""} onChange={(e) => set("no_wa_admin", e.target.value)} placeholder="08xxxx" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Jam Operasional</label>
            <input className="input" value={s.jam_operasional || ""} onChange={(e) => set("jam_operasional", e.target.value)} placeholder="07:00 - 15:00" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Ambang Stok Menipis</label>
          <input className="input" type="number" min="1" value={s.stok_menipis_threshold ?? 5}
            onChange={(e) => set("stok_menipis_threshold", e.target.value)} placeholder="5" />
          <p className="mt-1 text-xs text-ink-soft">Produk dengan stok ≤ nilai ini akan muncul di "Stok Menipis" dashboard.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Gambar QRIS Statis</label>
          <p className="mb-1 text-xs text-ink-soft">Dipakai saat mode pembayaran <b>Manual</b> — ditampilkan ke pelanggan di halaman pembayaran.</p>
          <input type="file" accept="image/*" onChange={onFile} />
          {preview && /* eslint-disable-next-line @next/next/no-img-element */ (
            <img src={preview} alt="QRIS" className="mt-2 w-48 rounded-xl border border-gray-100" />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Info Rekening / Instruksi Bayar (Manual)</label>
          <textarea className="input" rows={2} value={s.info_rekening || ""} onChange={(e) => set("info_rekening", e.target.value)}
            placeholder="Contoh: BCA 1234567890 a.n. Budi — atau instruksi pembayaran lain" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">📺 Papan Kejujuran (Kantin TV)</label>
          <p className="mb-1 text-xs text-ink-soft">Kata-kata yang tampil bergantian di layar TV kantin. <b>Satu kalimat per baris.</b> Kosongkan untuk pakai kata-kata bawaan.</p>
          <textarea className="input" rows={4} value={s.papan_kejujuran || ""} onChange={(e) => set("papan_kejujuran", e.target.value)}
            placeholder={"Tidak ada yang mengawasi, kecuali hati nuranimu.\nBayar jujur = kantin ini tetap buka untuk temanmu besok.\nKejujuran kecil hari ini, kepercayaan besar selamanya."} />
        </div>
        {msg && <p className="text-sm text-primary">{msg}</p>}
        <Button onClick={save} loading={saving} className="btn-block">Simpan Pengaturan</Button>
      </div>
    </div>
  );
}
