"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { addToCart } from "@/lib/cart";
import { rupiah } from "@/lib/format";

export default function ProductDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).single();
      setP(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="container-app pt-10 text-center text-ink-soft">Memuat...</div>;
  if (!p) return <div className="container-app pt-10 text-center text-ink-soft">Produk tidak ditemukan.</div>;

  const habis = !p.tersedia || p.stok <= 0;

  return (
    <main className="pb-28">
      <div className="relative aspect-square bg-surface">
        {p.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.foto_url} alt={p.nama} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-soft">
            Tidak ada foto
          </div>
        )}
        <Link href="/" className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
      </div>

      <div className="container-app -mt-6">
        <div className="card p-5">
          <h1 className="text-xl font-extrabold">{p.nama}</h1>
          <p className="mt-1 text-lg font-bold text-primary">{rupiah(p.harga)}</p>
          {p.deskripsi && <p className="mt-3 text-sm text-ink-soft">{p.deskripsi}</p>}

          <div className="mt-5">
            <label className="mb-1 block text-sm font-semibold">Catatan (opsional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: tidak pedas, tanpa es"
              className="input" />
          </div>

          <div className="mt-5 flex items-center gap-4">
            <span className="text-sm font-semibold">Jumlah</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid h-9 w-9 place-items-center rounded-full border border-gray-200">−</button>
              <span className="w-6 text-center font-bold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)}
                className="grid h-9 w-9 place-items-center rounded-full border border-gray-200">+</button>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white p-4">
        <div className="container-app flex items-center gap-3 px-0">
          <div className="flex-1">
            <p className="text-xs text-ink-soft">Total</p>
            <p className="text-lg font-extrabold text-primary">{rupiah(p.harga * qty)}</p>
          </div>
          <button
            disabled={habis}
            onClick={() => { addToCart(p, qty, note); router.push("/cart"); }}
            className="btn-primary flex-1 disabled:bg-gray-300"
          >
            {habis ? "Stok Habis" : "Tambah ke Keranjang"}
          </button>
        </div>
      </div>
    </main>
  );
}
