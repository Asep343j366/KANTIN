"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";
import { compressImage } from "@/lib/compressImage";
import Button from "@/components/Button";

const KATEGORI = {
  keluar: ["Belanja Stok", "Operasional", "Lainnya"],
  masuk: ["Setoran Modal", "Penjualan", "Lainnya"],
};

export default function JournalPage() {
  const [rows, setRows] = useState([]);
  const [jenis, setJenis] = useState("keluar");
  const [kategori, setKategori] = useState("Belanja Stok");
  const [keterangan, setKeterangan] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [namaToko, setNamaToko] = useState("");
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [me, setMe] = useState("admin");
  const [detail, setDetail] = useState(null);

  async function load() {
    const { data } = await supabase.from("journal").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  }
  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.email || "admin"));
    const ch = supabase.channel("journal")
      .on("postgres_changes", { event: "*", schema: "public", table: "journal" }, load).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const totalMasuk = rows.filter((r) => r.jenis === "masuk").reduce((s, r) => s + r.jumlah, 0);
  const totalKeluar = rows.filter((r) => r.jenis === "keluar").reduce((s, r) => s + r.jumlah, 0);
  const saldo = totalMasuk - totalKeluar;

  function pickJenis(j) {
    setJenis(j);
    setKategori(KATEGORI[j][0]);
    setErr("");
  }

  function onFoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("File harus gambar.");
    setErr("");
    setFoto(f);
    setPreview(URL.createObjectURL(f));
  }

  function resetForm() {
    setKeterangan(""); setJumlah(""); setNamaToko(""); setFoto(null); setPreview(null);
  }

  async function save() {
    setErr("");
    const n = parseInt(jumlah);
    if (!keterangan.trim() || !n || n <= 0) return setErr("Keterangan dan jumlah wajib diisi dengan benar.");
    if (jenis === "keluar") {
      if (!namaToko.trim()) return setErr("Nama toko wajib diisi untuk Uang Keluar.");
      if (!foto) return setErr("Foto nota belanja wajib diunggah untuk Uang Keluar.");
    }
    setSaving(true);
    try {
      let foto_url = null;
      if (foto) {
        const up = await compressImage(foto);
        const path = `journal-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("payments").upload(path, up);
        if (upErr) throw upErr;
        foto_url = supabase.storage.from("payments").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("journal").insert({
        jenis, kategori, keterangan: keterangan.trim(), jumlah: n, dicatat_oleh: me,
        nama_toko: jenis === "keluar" ? namaToko.trim() : null,
        foto_url,
      });
      if (error) throw error;
      resetForm();
      load();
    } catch (e) {
      setErr("Gagal: " + (e.message || e));
    }
    setSaving(false);
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold">Jurnal Kas</h1>

      <div className="grid grid-cols-3 gap-3">
        <Kpi c="#1B6FEB" label="Saldo Kas" value={rupiah(saldo)} />
        <Kpi c="#22C55E" label="Uang Masuk" value={rupiah(totalMasuk)} />
        <Kpi c="#EF4444" label="Uang Keluar" value={rupiah(totalKeluar)} />
      </div>

      <div className="card mt-4 p-4">
        <h2 className="mb-3 font-bold">Catat Transaksi Kas</h2>
        <div className="mb-3 flex gap-2">
          <button onClick={() => pickJenis("keluar")}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold ${jenis === "keluar" ? "bg-gradient-to-br from-[#F87171] to-[#DC2626] text-white" : "border border-gray-200"}`}>Uang Keluar</button>
          <button onClick={() => pickJenis("masuk")}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold ${jenis === "masuk" ? "bg-gradient-to-br from-[#34D26A] to-[#16A34A] text-white" : "border border-gray-200"}`}>Uang Masuk</button>
        </div>

        <label className="mb-1 block text-sm font-semibold">Kategori</label>
        <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="input mb-3">
          {KATEGORI[jenis].map((k) => <option key={k}>{k}</option>)}
        </select>

        {jenis === "keluar" && (
          <>
            <label className="mb-1 block text-sm font-semibold">Nama Toko <span className="text-danger">*</span></label>
            <input value={namaToko} onChange={(e) => setNamaToko(e.target.value)} className="input mb-3"
              placeholder="Contoh: Toko Agen Sembako Jaya" />
          </>
        )}

        <label className="mb-1 block text-sm font-semibold">Keterangan</label>
        <input value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="input mb-3"
          placeholder="Contoh: Belanja stok minuman ke agen" />

        <label className="mb-1 block text-sm font-semibold">Jumlah (Rp)</label>
        <input value={jumlah} onChange={(e) => setJumlah(e.target.value)} type="number" min="0" className="input mb-3" placeholder="0" />

        <label className="mb-1 block text-sm font-semibold">
          {jenis === "keluar" ? <>Foto Nota Belanja <span className="text-danger">*</span></> : "Foto Bukti (opsional)"}
        </label>
        <label className="mb-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-4 text-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="nota" className="max-h-40 rounded-lg" />
          ) : (
            <span className="text-sm text-ink-soft">Ketuk untuk pilih foto (otomatis dikompres)</span>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={onFoto} />
        </label>

        {err && <p className="mb-2 text-sm text-danger">{err}</p>}
        <Button onClick={save} loading={saving} variant={jenis === "keluar" ? "danger" : "success"} className="btn-block">
          Simpan Catatan
        </Button>
      </div>

      <h2 className="mb-2 mt-5 font-bold">Riwayat Kas</h2>
      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-2 font-semibold">Tanggal</th>
              <th className="py-2 pr-2 font-semibold">Jenis</th>
              <th className="py-2 pr-2 font-semibold">Kategori</th>
              <th className="py-2 pr-2 font-semibold">Keterangan</th>
              <th className="py-2 pr-2 font-semibold">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((r) => (
              <tr key={r.id} onClick={() => setDetail(r)} className="cursor-pointer border-t border-gray-100 hover:bg-surface">
                <td className="py-2 pr-2 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                <td className="py-2 pr-2">
                  <span className={`badge ${r.jenis === "masuk" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {r.jenis === "masuk" ? "Masuk" : "Keluar"}
                  </span>
                </td>
                <td className="py-2 pr-2">{r.kategori}</td>
                <td className="py-2 pr-2">{r.keterangan}{r.nama_toko ? ` · ${r.nama_toko}` : ""}</td>
                <td className={`py-2 pr-2 font-semibold ${r.jenis === "masuk" ? "text-success" : "text-danger"}`}>
                  {r.jenis === "masuk" ? "+" : "−"}{rupiah(r.jumlah)}
                </td>
              </tr>
            )) : <tr><td colSpan={5} className="py-8 text-center text-ink-soft">Belum ada catatan kas.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Klik baris untuk melihat detail & foto. Catatan "Masuk — Penjualan" muncul otomatis tiap ada transaksi.</p>

      {detail && <JournalDetail entry={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function JournalDetail({ entry, onClose }) {
  const [foto, setFoto] = useState(entry.foto_url || null);
  const [loadingFoto, setLoadingFoto] = useState(!entry.foto_url && !!entry.order_id);

  useEffect(() => {
    // Entri "Masuk — Penjualan" otomatis: ambil bukti transaksi dari order terkait
    if (!entry.foto_url && entry.order_id) {
      supabase.from("orders").select("bukti_bayar_url").eq("id", entry.order_id).single()
        .then(({ data }) => { setFoto(data?.bukti_bayar_url || null); setLoadingFoto(false); });
    }
  }, [entry]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Detail Catatan Kas</h2>
          <button onClick={onClose} className="text-ink-soft">✕</button>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <Row l="Tanggal" r={fmtDateTime(entry.created_at)} />
          <Row l="Jenis" r={entry.jenis === "masuk" ? "Uang Masuk" : "Uang Keluar"} />
          <Row l="Kategori" r={entry.kategori} />
          {entry.nama_toko && <Row l="Nama Toko" r={entry.nama_toko} />}
          <Row l="Keterangan" r={entry.keterangan} />
          <Row l="Jumlah" r={<span className={entry.jenis === "masuk" ? "text-success font-bold" : "text-danger font-bold"}>{entry.jenis === "masuk" ? "+" : "−"}{rupiah(entry.jumlah)}</span>} />
          <Row l="Dicatat Oleh" r={entry.dicatat_oleh || "-"} />
        </div>

        <div className="mt-4">
          <p className="mb-1 text-sm font-semibold">
            {entry.jenis === "keluar" ? "Foto Nota Belanja" : "Foto Bukti Transaksi"}
          </p>
          {loadingFoto ? (
            <p className="text-sm text-ink-soft">Memuat foto...</p>
          ) : foto ? (
            <a href={foto} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="bukti" className="w-full rounded-xl border border-gray-100" />
            </a>
          ) : (
            <p className="text-sm text-ink-soft">Tidak ada foto.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ l, r }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-soft">{l}</span>
      <span className="text-right font-medium">{r}</span>
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
