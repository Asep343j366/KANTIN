"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
import Button from "@/components/Button";
import { compressImage } from "@/lib/compressImage";

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
      setS(data || {});
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
        const { error } = await supabase.storage.from("qris").upload(path, up, { upsert: true });
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
        stok_menipis_threshold: parseInt(s.stok_menipis_threshold) || 5,
        qris_image_url: qris_image_url || null,
      };
      const { error } = await supabase.from("settings").upsert(payload, { onConflict: "store_id" });
      if (error) throw error;
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
        {msg && <p className="text-sm text-primary">{msg}</p>}
        <Button onClick={save} loading={saving} className="btn-block">Simpan Pengaturan</Button>
      </div>
    </div>
  );
}
