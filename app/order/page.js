"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderLookup() {
  const [kode, setKode] = useState("");
  const router = useRouter();
  return (
    <main className="container-app pt-8">
      <h1 className="text-xl font-extrabold">Lacak Pesanan</h1>
      <p className="mt-1 text-sm text-ink-soft">Masukkan kode pesanan untuk melihat status & struk.</p>
      <div className="card mt-5 p-4">
        <label className="mb-1 block text-sm font-semibold">Kode Pesanan</label>
        <input value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())}
          placeholder="KTN-XXXXXX-XXXX" className="input" />
        <button
          onClick={() => kode.trim() && router.push(`/order/${kode.trim()}`)}
          className="btn-primary mt-4 w-full">Lihat Pesanan</button>
      </div>
    </main>
  );
}
