"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import Button from "@/components/Button";

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}
const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
// Angka ("200000"/"200.000") → "Rp200.000"; teks bebas → apa adanya.
function formatHarga(label) {
  if (label == null || label === "") return "—";
  const clean = String(label).replace(/[.\s]/g, "");
  if (/^\d+$/.test(clean)) return "Rp" + Number(clean).toLocaleString("id-ID");
  return label;
}

export default function SubscriptionPage() {
  const [store, setStore] = useState(null);
  useEffect(() => { getMyStore().then(setStore); }, []);

  if (!store) return <p className="text-ink-soft">Memuat...</p>;

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">Langganan</h1>
      <StatusCard store={store} />
      {store.is_platform_admin ? (
        <>
          <WebAddressCard slug={store.store?.slug} />
          <PlatformPending />
          <PlatformTokens />
        </>
      ) : (
        <>
          <HargaCard store={store} />
          <WebAddressCard slug={store.store?.slug} />
          <SubOrdersCard />
          <RedeemBox onDone={() => getMyStore({ force: true }).then(setStore)} />
        </>
      )}
    </div>
  );
}

function StatusCard({ store }) {
  const s = store.store || {};
  const until = s.langganan_until ? new Date(s.langganan_until) : null;
  const badge =
    s.status === "aktif" ? "bg-green-100 text-green-700"
    : s.status === "grace" ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";
  return (
    <div className="card mb-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{s.nama}</p>
          <p className="text-xs text-ink-soft">Site {s.kode_site}</p>
        </div>
        <span className={`badge ${badge}`}>{s.status || "-"}</span>
      </div>
      {store.is_platform_admin ? (
        <p className="mt-2 text-xs text-ink-soft">Store platform — selalu aktif.</p>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">
          {s.is_trial && <span className="badge mr-2 bg-primary-light text-primary">Masa Trial</span>}
          Aktif sampai: <b>{until ? fmtDateTime(until.toISOString()) : "belum berlangganan"}</b>
        </p>
      )}
    </div>
  );
}

// ---------- Store: Harga layanan + tombol Langganan/Perpanjang ----------
function HargaCard({ store }) {
  const [plat, setPlat] = useState(null);
  useEffect(() => {
    supabase.from("platform_settings").select("harga_label, harga_note, langganan_harga, langganan_durasi_hari").eq("id", 1).maybeSingle()
      .then(({ data }) => setPlat(data || {}));
  }, []);

  const s = store.store || {};
  const aktif = s.status === "aktif" && !s.is_trial && s.langganan_until && new Date(s.langganan_until) > new Date();
  const label = plat?.harga_label?.trim() ? formatHarga(plat.harga_label) : (plat?.langganan_harga ? rupiah(plat.langganan_harga) : "—");
  const durasi = plat?.langganan_durasi_hari || 120;
  const bisaBayar = !!plat?.langganan_harga;

  return (
    <div className="card mb-4 overflow-hidden p-0">
      <div className="bg-gradient-to-br from-primary to-[#1657C0] p-4 text-white">
        <p className="text-xs font-semibold text-white/70">Paket Langganan</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-3xl font-extrabold">{label}</span>
          <span className="pb-1 text-xs text-white/80">/ {durasi} hari</span>
        </div>
        {plat?.harga_note && <p className="mt-1 text-xs text-white/80">{plat.harga_note}</p>}
      </div>
      <div className="p-4">
        <p className="mb-3 text-sm text-ink-soft">
          {aktif ? "Perpanjang langganan kapan saja — masa aktif ditambah dari sisa yang ada." : "Aktifkan langganan untuk membuka penuh semua fitur toko kamu."}
        </p>
        {bisaBayar ? (
          <Link href="/admin/subscription/checkout" className="btn-primary btn-block">
            {aktif ? "Perpanjang Sekarang" : "Langganan Sekarang"}
          </Link>
        ) : (
          <p className="rounded-lg bg-surface p-3 text-center text-xs text-ink-soft">Harga langganan belum diatur admin.</p>
        )}
      </div>
    </div>
  );
}

// ---------- Store: riwayat pembayaran langganan ----------
function SubOrdersCard() {
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    (async () => {
      const t = await token();
      const res = await fetch("/api/subscription/checkout", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
      const j = await res.json();
      if (res.ok) setOrders(j.orders || []);
    })();
  }, []);

  const [copied, setCopied] = useState("");
  async function copy(code) { try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(""), 1500); } catch {} }

  if (!orders.length) return null;
  const badgeCls = (st) => st === "paid" ? "bg-green-100 text-green-700" : st === "pending" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-ink-soft";
  const badgeTxt = (st) => st === "paid" ? "Lunas" : st === "pending" ? "Menunggu" : st;

  return (
    <div className="card mb-4 p-4">
      <h2 className="mb-2 font-bold">Riwayat Pembayaran Langganan</h2>
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl border border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{rupiah(o.amount)} · {o.durasi_hari} hari</p>
                <p className="text-[11px] text-ink-soft">{fmtDateTime(o.created_at)}</p>
              </div>
              <span className={`badge ${badgeCls(o.status)}`}>{badgeTxt(o.status)}</span>
            </div>
            {o.status === "paid" && o.token_code && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5">
                <code className="flex-1 text-xs font-bold text-primary">{o.token_code}</code>
                <button onClick={() => copy(o.token_code)} className="rounded bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">{copied === o.token_code ? "✓" : "Salin"}</button>
              </div>
            )}
            {o.status === "pending" && (
              <p className="mt-1 text-[11px] text-amber-700">Menunggu verifikasi. Jika sudah bayar & belum terbaca, admin akan memproses manual.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Platform-admin: antrian verifikasi manual langganan ----------
function PlatformPending() {
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const t = await token();
    const res = await fetch("/api/admin/subscription/pending", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const j = await res.json();
    if (res.ok) setOrders(j.orders || []);
  }
  useEffect(() => { load(); }, []);

  async function act(order_id, action) {
    setBusy(order_id); setErr("");
    const t = await token();
    const res = await fetch("/api/admin/subscription/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ order_id, action }),
    });
    const j = await res.json();
    setBusy("");
    if (!res.ok) return setErr(j.error || "Gagal.");
    load();
  }

  return (
    <div className="card mb-4 p-4">
      <h2 className="mb-1 font-bold">Verifikasi Langganan Manual</h2>
      <p className="-mt-0.5 mb-3 text-xs text-ink-soft">Pembayaran langganan yang belum terbaca otomatis oleh Casaku. Konfirmasi setelah dana masuk.</p>
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      {orders.length ? (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{o.stores?.nama || "—"} <span className="text-[11px] text-ink-soft">({o.stores?.kode_site || "-"})</span></p>
                  <p className="text-[11px] text-ink-soft">{rupiah(o.amount_charged || o.amount)} · {o.durasi_hari} hari · {fmtDateTime(o.created_at)}</p>
                  {o.payment_ref && <p className="text-[10px] text-ink-soft">Ref: {o.payment_ref}</p>}
                </div>
                <span className="badge bg-amber-100 text-amber-700">Menunggu</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button disabled={busy === o.id} onClick={() => act(o.id, "settle")} className="rounded-lg bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 disabled:opacity-50">Terbitkan & Tandai Lunas</button>
                <button disabled={busy === o.id} onClick={() => act(o.id, "cancel")} className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-50">Batalkan</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-3 text-center text-sm text-ink-soft">Tidak ada pembayaran menunggu.</p>
      )}
    </div>
  );
}

// ---------- Alamat website storefront (slug) ----------
function WebAddressCard({ slug }) {
  const [copied, setCopied] = useState(false);
  if (!slug) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/s/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="card mb-4 p-4">
      <h2 className="mb-1 font-bold">Alamat Website Kantin</h2>
      <p className="mb-3 text-xs text-ink-soft">Bagikan alamat ini ke pelanggan untuk buka toko online Anda.</p>
      <div className="flex gap-2">
        <a href={url} target="_blank" rel="noreferrer"
          className="input flex-1 truncate text-primary underline decoration-primary/40">{url}</a>
        <Button onClick={copy} className="shrink-0">{copied ? "Tersalin ✓" : "Salin"}</Button>
      </div>
    </div>
  );
}

// ---------- Store biasa: tukar kode ----------
function RedeemBox({ onDone }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function redeem() {
    setLoading(true); setMsg(""); setErr("");
    const t = await token();
    const res = await fetch("/api/admin/subscription/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ code }),
    });
    const j = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(j.error || "Gagal menukarkan kode.");
    setMsg("Berhasil! Masa langganan diperpanjang.");
    setCode("");
    onDone?.();
  }

  return (
    <div className="card p-4">
      <h2 className="mb-2 font-bold">Tukar Kode Langganan</h2>
      <p className="mb-3 text-xs text-ink-soft">Masukkan kode yang Anda dapat setelah membayar ke admin platform.</p>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="KTN-XXXX-XXXX" className="input" />
        <Button onClick={redeem} loading={loading} className="shrink-0">Tukar</Button>
      </div>
      {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
    </div>
  );
}

// ---------- Platform-admin (J366): generate & daftar token ----------
function PlatformTokens() {
  const [durasi, setDurasi] = useState(30);
  const [jumlah, setJumlah] = useState(1);
  const [tokens, setTokens] = useState([]);
  const [created, setCreated] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const t = await token();
    const res = await fetch("/api/admin/subscription/tokens", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const j = await res.json();
    if (res.ok) setTokens(j.tokens || []);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    setLoading(true); setErr(""); setCreated([]);
    const t = await token();
    const res = await fetch("/api/admin/subscription/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ durasi_hari: durasi, jumlah }),
    });
    const j = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(j.error || "Gagal membuat token.");
    setCreated(j.created || []);
    load();
  }

  return (
    <>
      <div className="card mb-4 p-4">
        <h2 className="mb-3 font-bold">Buat Kode Langganan</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold">Durasi (hari)</label>
            <select value={durasi} onChange={(e) => setDurasi(parseInt(e.target.value))} className="input">
              <option value={30}>30 hari</option>
              <option value={90}>90 hari</option>
              <option value={180}>180 hari</option>
              <option value={365}>365 hari</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Jumlah kode</label>
            <input type="number" min="1" max="50" value={jumlah} onChange={(e) => setJumlah(parseInt(e.target.value) || 1)} className="input" />
          </div>
        </div>
        <Button onClick={generate} loading={loading} className="btn-block mt-3">Generate</Button>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
        {created.length > 0 && (
          <div className="mt-3 rounded-xl bg-surface p-3">
            <p className="mb-1 text-xs font-semibold">Kode baru (salin & berikan ke store):</p>
            {created.map((c) => (
              <code key={c.code} className="block text-sm font-bold text-primary">{c.code} · {c.durasi_hari} hari</code>
            ))}
          </div>
        )}
      </div>

      <h2 className="mb-2 font-bold">Daftar Kode</h2>
      <div className="card table-scroll p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pr-2 font-semibold">Kode</th>
              <th className="py-2 pr-2 font-semibold">Durasi</th>
              <th className="py-2 pr-2 font-semibold">Status</th>
              <th className="py-2 pr-2 font-semibold">Dipakai</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length ? tokens.map((t) => (
              <tr key={t.code} className="border-t border-gray-100">
                <td className="py-2 pr-2 font-mono">{t.code}</td>
                <td className="py-2 pr-2">{t.durasi_hari} hari</td>
                <td className="py-2 pr-2">
                  <span className={`badge ${t.status === "aktif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-ink-soft"}`}>{t.status}</span>
                </td>
                <td className="py-2 pr-2 text-xs text-ink-soft">{t.redeemed_at ? fmtDateTime(t.redeemed_at) : "-"}</td>
              </tr>
            )) : <tr><td colSpan={4} className="py-6 text-center text-ink-soft">Belum ada kode.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
