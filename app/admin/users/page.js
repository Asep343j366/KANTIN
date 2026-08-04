"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fmtDateTime } from "@/lib/format";
import Button from "@/components/Button";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [meId, setMeId] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [resetFor, setResetFor] = useState(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function load() {
    setLoading(true);
    const t = await token();
    const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const j = await res.json();
    if (res.ok) { setUsers(j.users || []); setMeId(j.meId); }
    else setErr(j.error || "Gagal memuat user.");
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addUser(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setSaving(true);
    const t = await token();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal menambah user.");
    setMsg("Admin baru berhasil dibuat.");
    setEmail(""); setPassword("");
    load();
  }

  async function delUser(id) {
    if (!confirm("Hapus admin ini?")) return;
    const t = await token();
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ id }),
    });
    const j = await res.json();
    if (!res.ok) return setErr(j.error || "Gagal menghapus.");
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold">Kelola User Admin</h1>

      <ChangeMyPassword />

      <div className="card mb-4 p-4">
        <h2 className="mb-3 font-bold">Tambah Admin Baru</h2>
        <form onSubmit={addUser} className="space-y-3">
          <input className="input" type="email" placeholder="Email admin" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="text" placeholder="Password (min. 6 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {err && <p className="text-sm text-danger">{err}</p>}
          {msg && <p className="text-sm text-success">{msg}</p>}
          <Button type="submit" loading={saving} className="btn-block">Buat Admin</Button>
        </form>
        <p className="mt-2 text-xs text-ink-soft">Admin baru bisa langsung login di halaman /admin dengan email & password ini.</p>
      </div>

      <h2 className="mb-2 font-bold">Daftar Admin</h2>
      {loading ? <p className="text-ink-soft">Memuat...</p> : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{u.email} {u.role === "owner" && <span className="text-[10px] text-primary">(owner)</span>}</p>
                  <p className="text-xs text-ink-soft">Dibuat {fmtDateTime(u.created_at)}{u.id === meId ? " · (Anda)" : ""}</p>
                </div>
                {u.id !== meId && (
                  <div className="flex items-center gap-3">
                    <button onClick={() => setResetFor(resetFor === u.id ? null : u.id)} className="text-sm font-semibold text-primary">Reset PW</button>
                    <button onClick={() => delUser(u.id)} className="text-sm font-semibold text-danger">Hapus</button>
                  </div>
                )}
              </div>
              {resetFor === u.id && <ResetMemberPassword id={u.id} onDone={() => setResetFor(null)} />}
            </div>
          ))}
          {!users.length && <p className="text-ink-soft">Belum ada user.</p>}
        </div>
      )}
    </div>
  );
}

// Ganti password sendiri — TANPA email (supabase.auth.updateUser), aman di free tier.
function ChangeMyPassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function save(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    if (pw.length < 6) return setErr("Password minimal 6 karakter.");
    if (pw !== pw2) return setErr("Konfirmasi password tidak cocok.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) return setErr("Gagal: " + error.message);
    setMsg("Password berhasil diganti.");
    setPw(""); setPw2("");
  }

  return (
    <div className="card mb-4 p-4">
      <h2 className="mb-3 font-bold">Ganti Password Saya</h2>
      <form onSubmit={save} className="space-y-3">
        <input className="input" type="password" placeholder="Password baru (min. 6 karakter)" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <input className="input" type="password" placeholder="Ulangi password baru" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        {err && <p className="text-sm text-danger">{err}</p>}
        {msg && <p className="text-sm text-success">{msg}</p>}
        <Button type="submit" loading={saving} className="btn-block">Simpan Password Baru</Button>
      </form>
    </div>
  );
}

// Owner reset password anggota store (manual, tanpa email) — PATCH /api/admin/users.
function ResetMemberPassword({ id, onDone }) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function save() {
    setErr(""); setMsg("");
    if (pw.length < 6) return setErr("Password minimal 6 karakter.");
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token}` },
      body: JSON.stringify({ id, password: pw }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal reset password.");
    setMsg("Password anggota berhasil diganti.");
    setPw("");
    setTimeout(() => onDone?.(), 1200);
  }

  return (
    <div className="mt-3 rounded-xl bg-surface p-3">
      <p className="mb-2 text-xs font-semibold">Set password baru untuk anggota ini:</p>
      <div className="flex gap-2">
        <input className="input flex-1" type="text" placeholder="Password baru (min. 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button onClick={save} loading={saving} className="shrink-0">Simpan</Button>
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
    </div>
  );
}
