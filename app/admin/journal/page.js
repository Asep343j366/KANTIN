"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
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
  const [openMonth, setOpenMonth] = useState(null); // {bulan, saldoAwal, masuk, keluar, sisa}
  const [storeName, setStoreName] = useState("");

  async function load() {
    const s = await getMyStore();
    if (!s?.store_id) { setRows([]); return; }
    setStoreName(s.store?.nama || "");
    const { data } = await supabase.from("journal").select("*").eq("store_id", s.store_id).order("created_at", { ascending: false });
    setRows(data || []);
  }
  useEffect(() => {
    load();
    supabase.auth.getSession().then(({ data }) => setMe(data.session?.user?.email || "admin"));
    const ch = supabase.channel("journal")
      .on("postgres_changes", { event: "*", schema: "public", table: "journal" }, load).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const totalMasuk = rows.filter((r) => r.jenis === "masuk").reduce((s, r) => s + r.jumlah, 0);
  const totalKeluar = rows.filter((r) => r.jenis === "keluar").reduce((s, r) => s + r.jumlah, 0);
  const saldo = totalMasuk - totalKeluar;

  // Buku kas per bulan dengan SALDO BERJALAN: saldo awal (akumulasi bulan
  // sebelumnya) + pemasukan − pengeluaran = sisa saldo. Urut terbaru dulu.
  const monthly = (() => {
    const m = {};
    rows.forEach((r) => {
      const key = new Date(r.created_at).toLocaleDateString("en-CA").slice(0, 7); // YYYY-MM lokal
      if (!m[key]) m[key] = { masuk: 0, keluar: 0 };
      if (r.jenis === "masuk") m[key].masuk += r.jumlah; else m[key].keluar += r.jumlah;
    });
    const asc = Object.keys(m).sort(); // bulan terlama → terbaru
    let running = 0;
    const list = asc.map((bulan) => {
      const saldoAwal = running;
      const { masuk, keluar } = m[bulan];
      const sisa = saldoAwal + masuk - keluar;
      running = sisa;
      return { bulan, saldoAwal, masuk, keluar, sisa };
    });
    return list.reverse(); // tampilkan terbaru dulu
  })();

  // Semua transaksi 1 bulan (kronologis) + saldo berjalan mulai dari saldo awal.
  function monthTransactions(bulan, saldoAwal) {
    let bal = saldoAwal;
    return rows
      .filter((r) => new Date(r.created_at).toLocaleDateString("en-CA").slice(0, 7) === bulan)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((r) => {
        bal += r.jenis === "masuk" ? r.jumlah : -r.jumlah;
        return { ...r, saldoBerjalan: bal };
      });
  }

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
    const s = await getMyStore();
    if (!s?.store_id) { setErr("Store tidak dikenali. Muat ulang halaman."); return; }
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
      // store_id di-set EKSPLISIT (seperti halaman lain) agar tak bergantung pada
      // current_store_id() di DB yang sempat salah saat ada membership ganda.
      const { error } = await supabase.from("journal").insert({
        store_id: s.store_id,
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

      {/* Buku kas per bulan (saldo berjalan) */}
      <h2 className="mb-2 mt-5 font-bold">Buku Kas per Bulan</h2>
      <div className="card table-scroll p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-2 font-semibold">Bulan</th>
              <th className="py-2 pr-2 text-right font-semibold">Saldo Awal</th>
              <th className="py-2 pr-2 text-right font-semibold">Pemasukan</th>
              <th className="py-2 pr-2 text-right font-semibold">Pengeluaran</th>
              <th className="py-2 pr-2 text-right font-semibold">Sisa Saldo</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {monthly.length ? monthly.map((m) => (
              <tr key={m.bulan} onClick={() => setOpenMonth(m)}
                className="cursor-pointer border-t border-gray-100 hover:bg-surface">
                <td className="py-2 pr-2 font-semibold">{monthLabel(m.bulan)}</td>
                <td className="py-2 pr-2 text-right text-ink-soft">{rupiah(m.saldoAwal)}</td>
                <td className="py-2 pr-2 text-right text-success">+{rupiah(m.masuk)}</td>
                <td className="py-2 pr-2 text-right text-danger">−{rupiah(m.keluar)}</td>
                <td className={`py-2 pr-2 text-right font-bold ${m.sisa >= 0 ? "text-ink" : "text-danger"}`}>{rupiah(m.sisa)}</td>
                <td className="py-2 pr-2 text-right text-primary">›</td>
              </tr>
            )) : <tr><td colSpan={6} className="py-8 text-center text-ink-soft">Belum ada data kas.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Klik baris bulan untuk melihat seluruh transaksi & mengekspor ke PDF.</p>

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
      <div className="card table-scroll p-4">
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
      {openMonth && (
        <MonthStatement
          m={openMonth}
          storeName={storeName}
          txs={monthTransactions(openMonth.bulan, openMonth.saldoAwal)}
          onClose={() => setOpenMonth(null)}
        />
      )}
    </div>
  );
}

// Laporan buku kas 1 bulan: ringkasan saldo + daftar transaksi + export PDF.
function MonthStatement({ m, storeName, txs, onClose }) {
  function exportPdf() {
    const label = monthLabel(m.bulan);
    const barisTx = txs.map((t) => `
      <tr>
        <td>${fmtDateTime(t.created_at)}</td>
        <td>${t.jenis === "masuk" ? "Masuk" : "Keluar"}</td>
        <td>${escapeHtml(t.kategori || "")}</td>
        <td>${escapeHtml(t.keterangan || "")}${t.nama_toko ? " · " + escapeHtml(t.nama_toko) : ""}</td>
        <td class="r ${t.jenis === "masuk" ? "in" : ""}">${t.jenis === "masuk" ? rupiah(t.jumlah) : ""}</td>
        <td class="r ${t.jenis === "keluar" ? "out" : ""}">${t.jenis === "keluar" ? rupiah(t.jumlah) : ""}</td>
        <td class="r b">${rupiah(t.saldoBerjalan)}</td>
      </tr>`).join("");

    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
      <title>Buku Kas ${label}${storeName ? " - " + storeName : ""}</title>
      <style>
        *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
        body{margin:24px;color:#1E2A3A;font-size:12px}
        h1{font-size:18px;margin:0}
        .sub{color:#64748B;font-size:12px;margin:2px 0 16px}
        .sum{width:100%;border-collapse:collapse;margin-bottom:16px}
        .sum td{border:1px solid #E5E9F0;padding:8px}
        .sum .lbl{color:#64748B;font-size:11px}
        .sum .val{font-size:14px;font-weight:700}
        table.tx{width:100%;border-collapse:collapse}
        table.tx th,table.tx td{border:1px solid #E5E9F0;padding:6px 8px;text-align:left;vertical-align:top}
        table.tx th{background:#F1F4F8;font-size:11px}
        .r{text-align:right;white-space:nowrap}
        .b{font-weight:700}.in{color:#16A34A}.out{color:#DC2626}
        .foot{margin-top:18px;color:#94A3B8;font-size:10px}
        @media print{body{margin:12mm}}
      </style></head><body>
      <h1>Buku Kas — ${label}</h1>
      <div class="sub">${storeName ? escapeHtml(storeName) + " · " : ""}Dicetak ${fmtDateTime(new Date().toISOString())}</div>
      <table class="sum"><tr>
        <td><div class="lbl">Saldo Awal</div><div class="val">${rupiah(m.saldoAwal)}</div></td>
        <td><div class="lbl">Pemasukan</div><div class="val" style="color:#16A34A">+${rupiah(m.masuk)}</div></td>
        <td><div class="lbl">Pengeluaran</div><div class="val" style="color:#DC2626">−${rupiah(m.keluar)}</div></td>
        <td><div class="lbl">Sisa Saldo</div><div class="val">${rupiah(m.sisa)}</div></td>
      </tr></table>
      <table class="tx"><thead><tr>
        <th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Keterangan</th>
        <th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo</th>
      </tr></thead><tbody>
        ${barisTx || `<tr><td colspan="7" style="text-align:center;padding:20px;color:#94A3B8">Tidak ada transaksi.</td></tr>`}
      </tbody></table>
      <div class="foot">iKantin — Digital Borneo · Laporan dihasilkan otomatis.</div>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        {/* Header + ringkasan (sticky, tak ikut scroll) */}
        <div className="shrink-0 border-b border-gray-100 p-5 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Buku Kas — {monthLabel(m.bulan)}</h2>
            <button onClick={onClose} className="text-ink-soft">✕</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SumCell label="Saldo Awal" value={rupiah(m.saldoAwal)} />
            <SumCell label="Pemasukan" value={`+${rupiah(m.masuk)}`} cls="text-success" />
            <SumCell label="Pengeluaran" value={`−${rupiah(m.keluar)}`} cls="text-danger" />
            <SumCell label="Sisa Saldo" value={rupiah(m.sisa)} cls="text-ink" />
          </div>
        </div>

        {/* Hanya tabel yang bisa di-scroll */}
        <div className="min-h-0 flex-1 overflow-auto px-5 pb-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="sticky top-0 z-10 bg-white pb-2 pt-3 pr-2 font-semibold shadow-[inset_0_-1px_0_#E5E9F0]">Tanggal</th>
                <th className="sticky top-0 z-10 bg-white pb-2 pt-3 pr-2 font-semibold shadow-[inset_0_-1px_0_#E5E9F0]">Kategori</th>
                <th className="sticky top-0 z-10 bg-white pb-2 pt-3 pr-2 font-semibold shadow-[inset_0_-1px_0_#E5E9F0]">Keterangan</th>
                <th className="sticky top-0 z-10 bg-white pb-2 pt-3 pr-2 text-right font-semibold shadow-[inset_0_-1px_0_#E5E9F0]">Masuk</th>
                <th className="sticky top-0 z-10 bg-white pb-2 pt-3 pr-2 text-right font-semibold shadow-[inset_0_-1px_0_#E5E9F0]">Keluar</th>
                <th className="sticky top-0 z-10 bg-white pb-2 pt-3 pr-2 text-right font-semibold shadow-[inset_0_-1px_0_#E5E9F0]">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {txs.length ? txs.map((t) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="py-2 pr-2 whitespace-nowrap">{fmtDateTime(t.created_at)}</td>
                  <td className="py-2 pr-2">{t.kategori}</td>
                  <td className="py-2 pr-2">{t.keterangan}{t.nama_toko ? ` · ${t.nama_toko}` : ""}</td>
                  <td className="py-2 pr-2 text-right text-success">{t.jenis === "masuk" ? `+${rupiah(t.jumlah)}` : ""}</td>
                  <td className="py-2 pr-2 text-right text-danger">{t.jenis === "keluar" ? `−${rupiah(t.jumlah)}` : ""}</td>
                  <td className="py-2 pr-2 text-right font-semibold">{rupiah(t.saldoBerjalan)}</td>
                </tr>
              )) : <tr><td colSpan={6} className="py-8 text-center text-ink-soft">Tidak ada transaksi bulan ini.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Tombol sticky di bawah */}
        <div className="shrink-0 border-t border-gray-100 p-4">
          <div className="flex gap-2">
            <Button onClick={exportPdf} className="flex-1">Export PDF</Button>
            <button onClick={onClose} className="btn-outline flex-1 px-4 py-2">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SumCell({ label, value, cls = "text-ink" }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-[11px] font-semibold text-ink-soft">{label}</p>
      <p className={`mt-0.5 text-sm font-extrabold ${cls}`}>{value}</p>
    </div>
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

// "2026-08" -> "Agustus 2026"
function monthLabel(ym) {
  const [y, mo] = ym.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
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
