"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";
import Button from "@/components/Button";

export default function PendingPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, kode_pesanan, nama_pelanggan, no_hp, total, amount_charged, payment_ref, payment_status, created_at")
      .neq("payment_status", "paid")
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
    if (!confirm(`Tandai LUNAS manual pesanan ${o.kode_pesanan} sebesar ${rupiah(o.amount_charged || o.total)}?\n\nLakukan HANYA jika pembayaran benar-benar sudah masuk.`)) return;
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
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {o.nama_pelanggan} <span className="text-xs font-normal text-ink-soft">· {o.kode_pesanan}</span>
                </p>
                <p className="text-xs text-ink-soft">{fmtDateTime(o.created_at)} · {o.no_hp}</p>
                <p className="text-xs text-ink-soft">Ref: {o.payment_ref || "—"}</p>
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
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink-soft">Tidak ada pesanan yang menunggu pembayaran.</p>
      )}
    </div>
  );
}
