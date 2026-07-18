"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/Button";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError("Login gagal: " + error.message);
    router.replace("/admin");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mx-auto mb-3 grid h-20 w-20 place-items-center overflow-hidden rounded-2xl shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512.png" alt="Logo" className="h-full w-full object-contain" />
        </div>
        <h1 className="text-center text-xl font-extrabold text-primary">Admin Kantin</h1>
        <p className="mt-1 text-center text-sm text-ink-soft">Big Mall Samarinda — kelola pesanan & produk.</p>
        <form onSubmit={login} className="mt-5 space-y-3">
          <input className="input" type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={loading} className="btn-block">Masuk</Button>
        </form>
      </div>
    </div>
  );
}
