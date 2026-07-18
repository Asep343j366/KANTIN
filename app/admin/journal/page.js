"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";
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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [me, setMe] = useState("admin");

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
  }

  async function save() {
    setErr("");
    const n = parseInt(jumlah);
    if (!keterangan.trim() || !n || n <= 0) return setErr("Keterangan dan jumlah wajib diisi dengan benar.");
    setSaving(true);
    const { error } = await supabase.from("journal").insert({
      jenis, kategori, keterangan: keterangan.trim(), jumlah: n, dicatat_oleh: me,
    });
    setSaving(false);
    if (error) return setErr("Gagal: " + error.message);
    setKeterangan(""); setJumlah("");
    load();
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
        <label className="mb-1 block text-sm font-semibold">Keterangan</label>
        <input value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="input mb-3"
          placeholder="Contoh: Belanja stok minuman ke agen" />
        <label className="mb-1 block text-sm font-semibold">Jumlah (Rp)</label>
        <input value={jumlah} onChange={(e) => setJumlah(e.target.value)} type="number" min="0" className="input mb-3" placeholder="0" />
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
              <tr key={r.id} className="border-t border-gray-100">
                <td className="py-2 pr-2 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                <td className="py-2 pr-2">
                  <span className={`badge ${r.jenis === "masuk" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {r.jenis === "masuk" ? "Masuk" : "Keluar"}
                  </span>
                </td>
                <td className="py-2 pr-2">{r.kategori}</td>
                <td className="py-2 pr-2">{r.keterangan}</td>
                <td className={`py-2 pr-2 font-semibold ${r.jenis === "masuk" ? "text-success" : "text-danger"}`}>
                  {r.jenis === "masuk" ? "+" : "−"}{rupiah(r.jumlah)}
                </td>
              </tr>
            )) : <tr><td colSpan={5} className="py-8 text-center text-ink-soft">Belum ada catatan kas.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Catatan "Masuk — Penjualan" muncul otomatis setiap ada transaksi selesai.</p>
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
