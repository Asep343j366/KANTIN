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

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function load() {
    setLoading(true);
    const t = await token();
    const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${t}` } });
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
    <div className="max-w-lg">
      <h1 className="mb-4 text-lg font-extrabold">Kelola User Admin</h1>

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
            <div key={u.id} className="card flex items-center justify-between p-3">
              <div>
                <p className="font-semibold">{u.email}</p>
                <p className="text-xs text-ink-soft">Dibuat {fmtDateTime(u.created_at)}{u.id === meId ? " · (Anda)" : ""}</p>
              </div>
              {u.id !== meId && (
                <button onClick={() => delUser(u.id)} className="text-danger text-sm font-semibold">Hapus</button>
              )}
            </div>
          ))}
          {!users.length && <p className="text-ink-soft">Belum ada user.</p>}
        </div>
      )}
    </div>
  );
}
