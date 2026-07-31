"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import Button from "@/components/Button";

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export default function SubscriptionPage() {
  const [store, setStore] = useState(null);
  useEffect(() => { getMyStore().then(setStore); }, []);

  if (!store) return <p className="text-ink-soft">Memuat...</p>;

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">Langganan</h1>
      <StatusCard store={store} />
      {store.is_platform_admin ? <PlatformTokens /> : <RedeemBox onDone={() => getMyStore({ force: true }).then(setStore)} />}
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
          Aktif sampai: <b>{until ? fmtDateTime(until.toISOString()) : "belum berlangganan"}</b>
        </p>
      )}
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
      <div className="card overflow-x-auto p-4">
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
