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

const empty = { email: "", nama: "", password: "", sites: "" };

export default function AmPage() {
  const [allowed, setAllowed] = useState(null);
  const [ams, setAms] = useState([]);
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [editSites, setEditSites] = useState({}); // user_id -> string
  const [resetFor, setResetFor] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [delFor, setDelFor] = useState(null);

  useEffect(() => {
    getMyStore().then((s) => {
      setAllowed(!!s?.is_platform_admin);
      if (s?.is_platform_admin) load();
    });
  }, []);

  async function load() {
    const t = await token();
    const res = await fetch("/api/admin/am", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const j = await res.json();
    if (res.ok) setAms(j.ams || []);
  }

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function create() {
    setSaving(true); setMsg(""); setErr("");
    const t = await token();
    const res = await fetch("/api/admin/am", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(f),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal membuat AM.");
    setMsg(`AM "${j.am.email}" dibuat — memantau ${j.am.sites.length} site.`);
    setF(empty);
    load();
  }

  async function saveSites(user_id) {
    setErr(""); setMsg("");
    const t = await token();
    const res = await fetch("/api/admin/am", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ user_id, action: "update_sites", sites: editSites[user_id] }),
    });
    const j = await res.json();
    if (!res.ok) return setErr(j.error || "Gagal simpan site.");
    setEditSites((p) => { const c = { ...p }; delete c[user_id]; return c; });
    setMsg("Daftar site AM diperbarui.");
    load();
  }

  async function doReset() {
    setErr(""); setMsg("");
    const t = await token();
    const res = await fetch("/api/admin/am", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ user_id: resetFor.user_id, action: "reset_password", password: resetPw }),
    });
    const j = await res.json();
    if (!res.ok) return setErr(j.error || "Gagal reset password.");
    setResetFor(null); setResetPw("");
    setMsg("Password AM berhasil direset.");
  }

  async function doDelete() {
    setErr(""); setMsg("");
    const t = await token();
    const res = await fetch("/api/admin/am", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ user_id: delFor.user_id }),
    });
    const j = await res.json();
    if (!res.ok) return setErr(j.error || "Gagal hapus.");
    setDelFor(null);
    setMsg("AM dihapus.");
    load();
  }

  if (allowed === null) return <p className="text-ink-soft">Memuat...</p>;
  if (!allowed) return <p className="text-ink-soft">Halaman ini hanya untuk admin platform (J366).</p>;

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">Kelola Area Manager</h1>
      <p className="mb-4 text-xs text-ink-soft">Buat akun AM (read-only) yang memantau banyak store sekaligus. AM login di <b>/am/login</b>.</p>

      {msg && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{msg}</p>}
      {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{err}</p>}

      {/* Form tambah AM */}
      <div className="card mb-5 p-4">
        <h2 className="mb-3 font-bold">Tambah AM Baru</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold">Email</label>
            <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="am@gmail.com" /></div>
          <div><label className="mb-1 block text-xs font-semibold">Nama</label>
            <input className="input" value={f.nama} onChange={(e) => set("nama", e.target.value)} placeholder="Area Manager" /></div>
          <div><label className="mb-1 block text-xs font-semibold">Password (min 6)</label>
            <input className="input" type="text" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="password" /></div>
          <div><label className="mb-1 block text-xs font-semibold">Site (pisah koma)</label>
            <input className="input" value={f.sites} onChange={(e) => set("sites", e.target.value)} placeholder="J341, J359, J366" /></div>
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">Site boleh dimasukkan walau store-nya belum dibuat — otomatis aktif begitu store dibuat.</p>
        <div className="mt-3">
          <Button onClick={create} loading={saving}>Buat Akun AM</Button>
        </div>
      </div>

      {/* Daftar AM */}
      <h2 className="mb-2 font-bold">Daftar AM ({ams.length})</h2>
      <div className="space-y-3">
        {ams.length ? ams.map((a) => {
          const editing = editSites[a.user_id] !== undefined;
          return (
            <div key={a.user_id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">{a.nama}</p>
                  <p className="text-xs text-ink-soft">{a.email} · dibuat {fmtDateTime(a.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetFor(a)} className="btn-outline px-3 py-1.5 text-xs">Reset PW</button>
                  <button onClick={() => setDelFor(a)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-danger">Hapus</button>
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-ink-soft">Site dipantau ({a.sites.length})</p>
                {editing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input className="input flex-1" value={editSites[a.user_id]}
                      onChange={(e) => setEditSites((p) => ({ ...p, [a.user_id]: e.target.value }))} />
                    <button onClick={() => saveSites(a.user_id)} className="btn-primary px-3 py-1.5 text-xs">Simpan</button>
                    <button onClick={() => setEditSites((p) => { const c = { ...p }; delete c[a.user_id]; return c; })} className="btn-outline px-3 py-1.5 text-xs">Batal</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.sites.map((s) => <span key={s} className="rounded-md bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary">{s}</span>)}
                    <button onClick={() => setEditSites((p) => ({ ...p, [a.user_id]: a.sites.join(", ") }))} className="ml-1 text-[11px] font-semibold text-primary underline">Edit</button>
                  </div>
                )}
              </div>
            </div>
          );
        }) : <p className="card p-6 text-center text-sm text-ink-soft">Belum ada akun AM.</p>}
      </div>

      {/* Modal reset password */}
      {resetFor && (
        <Modal title={`Reset Password — ${resetFor.email}`} onClose={() => { setResetFor(null); setResetPw(""); }}>
          <label className="mb-1 block text-xs font-semibold">Password Baru (min 6)</label>
          <input className="input mb-3" type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="password baru" />
          <div className="flex gap-2">
            <Button onClick={doReset} className="flex-1">Reset</Button>
            <button onClick={() => { setResetFor(null); setResetPw(""); }} className="btn-outline flex-1 px-4 py-2">Batal</button>
          </div>
        </Modal>
      )}

      {/* Modal hapus */}
      {delFor && (
        <Modal title="Hapus AM?" onClose={() => setDelFor(null)}>
          <p className="mb-3 text-sm text-ink-soft">Akun <b>{delFor.email}</b> beserta aksesnya akan dihapus permanen. Data store tidak terpengaruh.</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={doDelete} className="flex-1">Ya, Hapus</Button>
            <button onClick={() => setDelFor(null)} className="btn-outline flex-1 px-4 py-2">Batal</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold">{title}</h2>
          <button onClick={onClose} className="text-ink-soft">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
