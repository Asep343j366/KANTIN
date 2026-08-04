"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ nama: "", owner_email: "", owner_password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setErr("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    const j = await res.json();
    if (!res.ok) { setLoading(false); return setErr(j.error || "Gagal mendaftar."); }

    // Langsung login otomatis → masuk panel admin.
    const { error } = await supabase.auth.signInWithPassword({
      email: f.owner_email.trim().toLowerCase(), password: f.owner_password,
    });
    setLoading(false);
    if (error) { setDone(j); return; } // fallback: minta login manual
    router.replace("/admin");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-512.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-3 text-xl font-extrabold text-primary">Daftar iKantin</h1>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Digital Borneo</p>
          <p className="mt-1 text-center text-sm text-ink-soft">Gratis coba 7 hari. Tanpa kartu kredit.</p>
        </div>

        {done ? (
          <div className="card p-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EAF7EE] text-[#16A34A]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h2 className="mt-3 font-extrabold">Pendaftaran berhasil!</h2>
            <p className="mt-1 text-sm text-ink-soft">Toko kamu sudah dibuat dengan trial 7 hari. Silakan masuk untuk mulai.</p>
            <Link href="/admin/login" className="btn-primary btn-block mt-4">Masuk Sekarang</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-3 p-6">
            <div>
              <label className="mb-1 block text-xs font-semibold">Nama Kantin / Toko</label>
              <input className="input" value={f.nama} onChange={(e) => set("nama", e.target.value)} placeholder="Cth: Kantin Bu Sari" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Email</label>
              <input className="input" type="email" value={f.owner_email} onChange={(e) => set("owner_email", e.target.value)} placeholder="email@contoh.com" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Password</label>
              <input className="input" type="password" value={f.owner_password} onChange={(e) => set("owner_password", e.target.value)} placeholder="min 6 karakter" required />
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <Button type="submit" loading={loading} className="btn-block">Buat Toko & Mulai Trial</Button>
            <p className="text-center text-xs text-ink-soft">
              Sudah punya akun? <Link href="/admin/login" className="font-semibold text-primary">Masuk</Link>
            </p>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-ink-soft">
          <Link href="/" className="hover:text-ink">← Kembali ke beranda</Link>
        </p>
      </div>
    </div>
  );
}
