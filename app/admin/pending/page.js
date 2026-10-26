"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
import { rupiah, fmtDateTime } from "@/lib/format";
import { confirmDialog } from "@/lib/confirmDialog";
import Button from "@/components/Button";

export default function PendingPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulk, setBulk] = useState(""); // teks progres saat aksi massal
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function load() {
    setLoading(true);
    const s = await getMyStore();
    if (!s?.store_id) { setOrders([]); setLoading(false); return; }
    const { data } = await supabase
      .from("orders")
      .select("id, kode_pesanan, nama_pelanggan, no_hp, total, amount_charged, payment_ref, payment_status, bukti_bayar_url, created_at")
      .eq("store_id", s.store_id)
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function settle(o) {
    setErr(""); setMsg("");
    if (!(await confirmDialog({
      title: "Tandai Lunas Manual",
      message: `Tandai LUNAS pesanan ${o.kode_pesanan} sebesar ${rupiah(o.amount_charged || o.total)}?\n\nLakukan HANYA jika pembayaran benar-benar sudah masuk.`,
      confirmLabel: "Ya, Tandai Lunas",
    }))) return;
    setSettlingId(o.id);
    const t = await token();
    const res = await fetch("/api/admin/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ order_id: o.id }),
    });
    const j = await res.json();
    setSettlingId(null);
    if (!res.ok) return setErr(j.error || "Gagal menandai lunas.");
    setMsg(`Pesanan ${o.kode_pesanan} berhasil ditandai lunas.`);
    load();
  }

  async function cancel(o) {
    setErr(""); setMsg("");
    if (!(await confirmDialog({
      title: "Batalkan Pesanan",
      message: `Batalkan pesanan ${o.kode_pesanan} (${o.nama_pelanggan})?\n\nGunakan untuk transaksi ganda atau yang sudah kamu catat manual di jurnal. Order akan hilang dari daftar ini.`,
      confirmLabel: "Ya, Batalkan",
      danger: true,
    }))) return;
    setCancelingId(o.id);
    const t = await token();
    const res = await fetch("/api/admin/order-cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ order_id: o.id }),
    });
    const j = await res.json();
    setCancelingId(null);
    if (!res.ok) return setErr(j.error || "Gagal membatalkan.");
    setMsg(`Pesanan ${o.kode_pesanan} dibatalkan.`);
    load();
  }

  // ---------- Aksi massal (banyak pesanan sekaligus) ----------
  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))));
  }
  const selectedOrders = orders.filter((o) => selected.has(o.id));
  const selectedTotal = selectedOrders.reduce((s, o) => s + Number(o.amount_charged || o.total || 0), 0);

  async function bulkRun(kind) {
    if (!selectedOrders.length || bulk) return;
    const isCancel = kind === "cancel";
    const ok = await confirmDialog({
      title: isCancel ? "Batalkan Terpilih" : "Tandai Lunas Terpilih",
      message: isCancel
        ? `Batalkan ${selectedOrders.length} pesanan terpilih?\n\nOrder akan hilang dari daftar ini. Gunakan untuk transaksi ganda / yang sudah dicatat manual.`
        : `Tandai LUNAS ${selectedOrders.length} pesanan terpilih (total ${rupiah(selectedTotal)})?\n\nLakukan HANYA untuk pesanan yang pembayarannya benar-benar sudah masuk.`,
      confirmLabel: isCancel ? "Ya, Batalkan Semua" : "Ya, Tandai Lunas Semua",
      danger: isCancel,
    });
    if (!ok) return;

    setErr(""); setMsg("");
    const t = await token();
    const url = isCancel ? "/api/admin/order-cancel" : "/api/admin/settle";
    const ids = selectedOrders.map((o) => o.id);
    let okc = 0, failc = 0;
    for (let i = 0; i < ids.length; i++) {
      setBulk(`Memproses ${i + 1}/${ids.length}…`);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ order_id: ids[i] }),
        });
        res.ok ? okc++ : failc++;
      } catch { failc++; }
    }
    setBulk("");
    setSelected(new Set());
    setMsg(`${isCancel ? "Dibatalkan" : "Ditandai lunas"}: ${okc} berhasil${failc ? `, ${failc} gagal` : ""}.`);
    load();
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">Menunggu Pembayaran</h1>
      <p className="mb-4 text-sm text-ink-soft">
        Pesanan yang belum terkonfirmasi lunas. Bila pembayaran sudah masuk tetapi gagal
        terbaca otomatis oleh Casaku, tandai lunas manual di sini.
      </p>

      {err && <p className="mb-3 text-sm text-danger">{err}</p>}
      {msg && <p className="mb-3 text-sm text-success">{msg}</p>}

      {loading ? (
        <p className="text-ink-soft">Memuat...</p>
      ) : orders.length ? (
        <>
          {/* Toolbar aksi massal */}
          <div className="card mb-3 flex flex-wrap items-center justify-between gap-3 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-primary"
                checked={selected.size === orders.length && orders.length > 0}
                ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < orders.length; }}
                onChange={toggleAll} />
              Pilih semua ({orders.length})
            </label>
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink-soft">{selected.size} dipilih · total <b className="text-primary">{rupiah(selectedTotal)}</b></span>
                <Button variant="primary" loading={!!bulk} onClick={() => bulkRun("settle")} className="btn-xs">
                  {bulk || `Tandai Lunas (${selected.size})`}
                </Button>
                <button onClick={() => bulkRun("cancel")} disabled={!!bulk}
                  className="text-sm font-semibold text-danger disabled:opacity-50">
                  Batalkan ({selected.size})
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className={`card flex flex-wrap items-center justify-between gap-3 p-3 ${selected.has(o.id) ? "ring-2 ring-primary/40" : ""}`}>
              <div className="flex min-w-0 items-center gap-3">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-primary"
                  checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                <div className="min-w-0">
                <p className="font-semibold">
                  {o.nama_pelanggan} <span className="text-xs font-normal text-ink-soft">· {o.kode_pesanan}</span>
                </p>
                <p className="text-xs text-ink-soft">{fmtDateTime(o.created_at)} · {o.no_hp}</p>
                <p className="text-xs text-ink-soft">Ref: {o.payment_ref || "—"}</p>
                {o.bukti_bayar_url && (
                  <a href={o.bukti_bayar_url} target="_blank" rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary underline">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
                    Lihat bukti pembayaran
                  </a>
                )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-bold text-primary">{rupiah(o.amount_charged || o.total)}</p>
                  {o.amount_charged && o.amount_charged !== o.total && (
                    <p className="text-[11px] text-ink-soft">total {rupiah(o.total)}</p>
                  )}
                </div>
                <Button
                  variant="primary"
                  loading={settlingId === o.id}
                  onClick={() => settle(o)}
                  className="btn-xs"
                >
                  Tandai Lunas
                </Button>
                <button
                  onClick={() => cancel(o)}
                  disabled={cancelingId === o.id}
                  className="text-sm font-semibold text-danger disabled:opacity-50"
                >
                  {cancelingId === o.id ? "..." : "Batalkan"}
                </button>
              </div>
            </div>
          ))}
          </div>
        </>
      ) : (
        <p className="text-ink-soft">Tidak ada pesanan yang menunggu pembayaran.</p>
      )}
    </div>
  );
}
