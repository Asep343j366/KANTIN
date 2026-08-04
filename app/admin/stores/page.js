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

const empty = { kode_site: "", nama: "", owner_email: "", owner_password: "", trial_days: 0, is_demo: false };

export default function StoresPage() {
  const [allowed, setAllowed] = useState(null);
  const [stores, setStores] = useState([]);
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [resetFor, setResetFor] = useState(null);

  useEffect(() => {
    getMyStore().then((s) => {
      setAllowed(!!s?.is_platform_admin);
      if (s?.is_platform_admin) load();
    });
  }, []);

  async function load() {
    const t = await token();
    const res = await fetch("/api/admin/stores", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const j = await res.json();
    if (res.ok) setStores(j.stores || []);
  }

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function create() {
    setSaving(true); setMsg(""); setErr("");
    const t = await token();
    const res = await fetch("/api/admin/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(f),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal membuat store.");
    setMsg(`Store "${j.store.nama}" dibuat. Slug: /s/${j.store.slug}`);
    setF(empty);
    load();
  }

  async function action(store_id, act, days) {
    const t = await token();
    const res = await fetch("/api/admin/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ store_id, action: act, days }),
    });
    const j = await res.json();
    if (!res.ok) return setErr(j.error || "Gagal.");
    load();
  }

  if (allowed === null) return <p className="text-ink-soft">Memuat...</p>;
  if (!allowed) return <p className="text-ink-soft">Halaman ini hanya untuk admin platform.</p>;

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">Kelola Store</h1>
      <p className="mb-4 text-sm text-ink-soft">Tambah store baru & kelola langganan/suspend semua store.</p>

      <LandingSettings />


      {/* Form tambah */}
      <div className="card mb-4 space-y-3 p-4">
        <h2 className="font-bold">Tambah Store Baru</h2>
        <div className="grid grid-cols-2 gap-3">
          <F label="Kode Site"><input className="input" value={f.kode_site} onChange={(e) => set("kode_site", e.target.value)} placeholder="Cth: A812" /></F>
          <F label="Nama Store"><input className="input" value={f.nama} onChange={(e) => set("nama", e.target.value)} placeholder="Kantin ..." /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Email Owner"><input className="input" type="email" value={f.owner_email} onChange={(e) => set("owner_email", e.target.value)} /></F>
          <F label="Password Owner"><input className="input" value={f.owner_password} onChange={(e) => set("owner_password", e.target.value)} placeholder="min 6 karakter" /></F>
        </div>
        <F label="Trial (hari, 0 = langsung nonaktif)">
          <input className="input" type="number" min="0" value={f.trial_days} onChange={(e) => set("trial_days", parseInt(e.target.value) || 0)} />
        </F>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.is_demo} onChange={(e) => set("is_demo", e.target.checked)} />
          Jadikan toko demo (bisa dilihat publik, tanpa transaksi, selalu aktif)
        </label>
        {msg && <p className="text-sm text-success">{msg}</p>}
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button onClick={create} loading={saving} className="btn-block">Buat Store</Button>
      </div>

      {/* Daftar */}
      <h2 className="mb-2 font-bold">Semua Store ({stores.length})</h2>
      <div className="space-y-2">
        {stores.map((s) => {
          const until = s.langganan_until ? new Date(s.langganan_until) : null;
          const badge = s.status === "aktif" ? "bg-green-100 text-green-700"
            : s.status === "grace" ? "bg-amber-100 text-amber-700"
            : s.status === "suspended" ? "bg-gray-200 text-ink"
            : "bg-red-100 text-red-700";
          return (
            <div key={s.id} className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{s.nama} {s.is_platform_admin && <span className="text-[10px] text-primary">(platform)</span>} {s.is_demo && <span className="badge bg-amber-100 text-amber-700">demo</span>}</p>
                  <p className="text-xs text-ink-soft">Site {s.kode_site} · /s/{s.slug} · {s.owner_email || "—"}</p>
                  <p className="text-xs text-ink-soft">Aktif s/d: {until ? fmtDateTime(until.toISOString()) : "—"}</p>
                </div>
                <span className={`badge ${badge}`}>{s.status}</span>
              </div>
              {!s.is_platform_admin && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => action(s.id, "extend", 30)} className="rounded-lg bg-primary-light px-2 py-1 text-xs font-semibold text-primary">+30 hari</button>
                  <button onClick={() => action(s.id, "extend", 365)} className="rounded-lg bg-primary-light px-2 py-1 text-xs font-semibold text-primary">+1 tahun</button>
                  {s.status === "suspended"
                    ? <button onClick={() => action(s.id, "activate")} className="rounded-lg bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">Aktifkan</button>
                    : <button onClick={() => action(s.id, "suspend")} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold">Suspend</button>}
                  {s.is_demo
                    ? <button onClick={() => action(s.id, "demo_off")} className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Batal Demo</button>
                    : <button onClick={() => action(s.id, "demo_on")} className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold">Jadikan Demo</button>}
                  <button onClick={() => setResetFor(resetFor === s.id ? null : s.id)} className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold">Reset PW Owner</button>
                </div>
              )}
              {resetFor === s.id && <ResetOwnerPassword store_id={s.id} email={s.owner_email} onDone={() => setResetFor(null)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function F({ label, children }) {
  return <div><label className="mb-1 block text-xs font-semibold">{label}</label>{children}</div>;
}

// Platform-admin reset password OWNER sebuah store (manual, tanpa email).
function ResetOwnerPassword({ store_id, email, onDone }) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function save() {
    setErr(""); setMsg("");
    if (pw.length < 6) return setErr("Password minimal 6 karakter.");
    setSaving(true);
    const t = await token();
    const res = await fetch("/api/admin/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ store_id, action: "reset_owner_password", password: pw }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal reset password.");
    setMsg(`Password owner${email ? " (" + email + ")" : ""} berhasil diganti.`);
    setPw("");
    setTimeout(() => onDone?.(), 1500);
  }

  return (
    <div className="mt-2 rounded-xl bg-surface p-3">
      <p className="mb-2 text-xs font-semibold">Set password baru untuk owner {email || "store ini"}:</p>
      <div className="flex gap-2">
        <input className="input flex-1" type="text" placeholder="Password baru (min. 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button onClick={save} loading={saving} className="shrink-0">Simpan</Button>
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
    </div>
  );
}

// Pengaturan landing (nomor WA & harga) — hanya platform-admin.
function LandingSettings() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const t = await token();
      const res = await fetch("/api/admin/platform-settings", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
      const j = await res.json();
      if (res.ok) setS(j.settings || {});
    })();
  }, []);

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    const t = await token();
    const res = await fetch("/api/admin/platform-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(s),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal menyimpan.");
    setMsg("Pengaturan landing tersimpan.");
  }

  if (!s) return null;

  return (
    <div className="card mb-4 space-y-3 p-4">
      <h2 className="font-bold">Pengaturan Landing Page</h2>
      <p className="-mt-1 text-xs text-ink-soft">Nomor WhatsApp & info harga yang tampil di halaman depan (landing).</p>
      <F label="Nomor WhatsApp (format 62xxx)">
        <input className="input" value={s.wa_number || ""} onChange={(e) => set("wa_number", e.target.value)} placeholder="628123456789" />
      </F>
      <div className="grid grid-cols-2 gap-3">
        <F label="Harga (label)">
          <input className="input" value={s.harga_label || ""} onChange={(e) => set("harga_label", e.target.value)} placeholder="Rp50.000" />
        </F>
        <F label="Keterangan harga">
          <input className="input" value={s.harga_note || ""} onChange={(e) => set("harga_note", e.target.value)} placeholder="/4 bulan" />
        </F>
      </div>

      <div className="rounded-xl bg-surface p-3">
        <p className="mb-2 text-xs font-bold">Voucher Langganan Otomatis (QRIS)</p>
        <p className="-mt-1 mb-2 text-[11px] text-ink-soft">Nominal yang ditagih saat store membeli/perpanjang langganan lewat QRIS otomatis (masuk ke akun Casaku Anda).</p>
        <div className="grid grid-cols-2 gap-3">
          <F label="Harga tagih (angka, cth 200000)">
            <input className="input" type="number" min="0" value={s.langganan_harga || ""} onChange={(e) => set("langganan_harga", e.target.value)} placeholder="200000" />
          </F>
          <F label="Durasi voucher (hari)">
            <input className="input" type="number" min="1" value={s.langganan_durasi_hari ?? 120} onChange={(e) => set("langganan_durasi_hari", e.target.value)} placeholder="120" />
          </F>
        </div>
      </div>
      {msg && <p className="text-sm text-success">{msg}</p>}
      {err && <p className="text-sm text-danger">{err}</p>}
      <Button onClick={save} loading={saving} className="btn-block">Simpan Pengaturan Landing</Button>
    </div>
  );
}
