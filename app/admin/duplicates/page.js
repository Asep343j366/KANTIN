"use client";
// Cek Pesanan Ganda: pesanan LUNAS yang kembar (pembeli sama, total sama,
// dibuat ≤10 menit). Admin centang yang dobel → dibatalkan; stok & jurnal
// penjualannya dikembalikan otomatis (RPC void_duplicate_order, migrasi v35).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
import { fetchAllRows } from "@/lib/sbPaginate";
import { rupiah } from "@/lib/format";
import { confirmDialog } from "@/lib/confirmDialog";
import { findDuplicateChains, suggestKeep, DUP_WINDOW_MIN } from "@/lib/duplicateOrders";
import Button from "@/components/Button";

const fmtSec = (iso) => iso ? new Date(iso).toLocaleString("id-ID", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
}) : "—";

// Hanya BULAN BERJALAN: data bulan sebelumnya sudah di-balancing manual
// (keputusan user) — jangan diusik.
function monthStartIso() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
}
const monthLabel = () => new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

export default function DuplicatesPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true); setErr("");
    const s = await getMyStore();
    if (!s?.store_id) { setOrders([]); setLoading(false); return; }
    const since = monthStartIso();
    try {
      const rows = await fetchAllRows(() => supabase.from("orders")
        .select("id, kode_pesanan, nama_pelanggan, no_hp, total, amount_charged, payment_ref, bukti_bayar_url, created_at, paid_at, order_items(nama_produk, jumlah)")
        .eq("store_id", s.store_id).eq("status", "selesai").gte("created_at", since)
        .order("id", { ascending: true }));
      setOrders(rows || []);
    } catch (e) { setErr(e.message || String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const chains = useMemo(() => findDuplicateChains(orders), [orders]);
  const picked = chains.flat().filter((o) => selected.has(o.id));
  const pickedTotal = picked.reduce((s, o) => s + Number(o.total || 0), 0);

  function toggle(id) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function applySuggestion() {
    const n = new Set();
    for (const c of chains) { const keep = suggestKeep(c); c.forEach((o) => o.id !== keep && n.add(o.id)); }
    setSelected(n);
  }

  async function run() {
    if (!picked.length || busy) return;
    const ok = await confirmDialog({
      title: "Batalkan Pesanan Ganda",
      message: `Batalkan ${picked.length} pesanan terpilih (total ${rupiah(pickedTotal)})?\n\n• Stok menu dikembalikan\n• Entri jurnal penjualannya dihapus (saldo kas berkurang ${rupiah(pickedTotal)})\n• Omzet & laba ikut terkoreksi\n\nPastikan yang dicentang memang pesanan kembar, bukan pembelian sungguhan.`,
      confirmLabel: "Ya, Batalkan",
      danger: true,
    });
    if (!ok) return;
    setErr(""); setMsg("");
    let okc = 0, failc = 0, lastErr = "";
    for (let i = 0; i < picked.length; i++) {
      setBusy(`Memproses ${i + 1}/${picked.length}…`);
      const { error } = await supabase.rpc("void_duplicate_order", { p_order_id: picked[i].id });
      if (error) { failc++; lastErr = error.message; } else okc++;
    }
    setBusy("");
    setSelected(new Set());
    if (failc && /void_duplicate_order|function/i.test(lastErr) && !okc)
      setErr("Fitur belum aktif — jalankan migrasi v35 (migration_v35_void_pesanan_ganda.sql) di Supabase.");
    else if (failc) setErr(`${failc} gagal: ${lastErr}`);
    if (okc) setMsg(`${okc} pesanan ganda dibatalkan. Stok & jurnal sudah dikoreksi.`);
    load();
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold">Cek Pesanan Ganda</h1>
        <Link href="/admin/pending" className="text-sm font-semibold text-primary">← Menunggu</Link>
      </div>
      <p className="mb-4 text-sm text-ink-soft">
        Pesanan <b>lunas</b> yang kembar: pembeli sama, total sama, dibuat berselang ≤{DUP_WINDOW_MIN} menit.
        Biasanya terjadi karena tombol bayar tertekan dua kali atau pembeli checkout ulang. Centang yang
        dobel lalu batalkan — stok & jurnal kas dikembalikan otomatis.
      </p>

      {err && <p className="mb-3 text-sm text-danger">{err}</p>}
      {msg && <p className="mb-3 text-sm text-success">{msg}</p>}

      <div className="card mb-3 flex flex-wrap items-center justify-between gap-3 p-3">
        <span className="text-sm font-semibold">Periode: {monthLabel()}</span>
        {chains.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={applySuggestion} className="text-sm font-semibold text-primary">Centang saran otomatis</button>
            {selected.size > 0 && (
              <>
                <span className="text-sm text-ink-soft">{selected.size} dipilih · <b className="text-danger">{rupiah(pickedTotal)}</b></span>
                <button onClick={() => setSelected(new Set())} className="text-sm text-ink-soft">Kosongkan</button>
                <Button variant="danger" loading={!!busy} onClick={run} className="btn-xs">
                  {busy || `Batalkan (${selected.size})`}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-ink-soft">Memuat...</p>
      ) : !chains.length ? (
        <p className="text-ink-soft">Tidak ada pesanan ganda bulan ini. 👍</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-soft">
            {chains.length} kelompok ditemukan. Saran otomatis mempertahankan pesanan yang punya ref Casaku / bukti bayar
            (kalau tidak ada, yang paling awal). Periksa dulu — bisa saja pembeli memang membeli dua kali.
          </p>
          <div className="space-y-3">
            {chains.map((c) => {
              const keep = suggestKeep(c);
              return (
                <div key={c[0].id} className="card p-3">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold">{c[0].nama_pelanggan} <span className="text-xs font-normal text-ink-soft">· {c[0].no_hp || "tanpa HP"}</span></p>
                    <p className="text-xs text-ink-soft">{c.length} pesanan × {rupiah(c[0].total)}</p>
                  </div>
                  <div className="space-y-1.5">
                    {c.map((o) => (
                      <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2 text-sm ${selected.has(o.id) ? "border-danger/50 bg-danger/5" : "border-slate-200"}`}>
                        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                          checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {o.kode_pesanan}
                            {o.id === keep && <span className="ml-2 rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">SARAN DIPERTAHANKAN</span>}
                          </p>
                          <p className="text-xs text-ink-soft">Dibuat {fmtSec(o.created_at)} · Lunas {fmtSec(o.paid_at)}</p>
                          <p className="text-xs text-ink-soft">
                            {o.payment_ref ? `Ref Casaku: ${o.payment_ref}` : "Tanpa ref Casaku"}
                            {o.bukti_bayar_url && <> · <a href={o.bukti_bayar_url} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">bukti bayar</a></>}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs">
                            {(o.order_items || []).map((it) => `${it.jumlah}× ${it.nama_produk}`).join(", ") || "—"}
                          </p>
                        </div>
                        <span className="shrink-0 font-bold text-primary">{rupiah(o.amount_charged || o.total)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
