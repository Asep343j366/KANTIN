"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getStoreBySlug } from "@/lib/store";

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

export default function StoreProvider({ children }) {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, store: null });

  useEffect(() => {
    let alive = true;
    getStoreBySlug(slug).then((store) => { if (alive) setState({ loading: false, store }); });
    return () => { alive = false; };
  }, [slug]);

  if (state.loading) {
    return <div className="grid min-h-screen place-items-center text-ink-soft">Memuat toko…</div>;
  }
  if (!state.store) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-bold">Toko tidak ditemukan</p>
          <p className="mt-1 text-sm text-ink-soft">Alamat toko salah atau sudah tidak aktif.</p>
        </div>
      </div>
    );
  }
  if (state.store.status === "nonaktif" || state.store.status === "suspended") {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-bold">{state.store.nama} sedang nonaktif</p>
          <p className="mt-1 text-sm text-ink-soft">Toko ini sementara tidak menerima pesanan.</p>
          <Link href="/" className="btn-outline mt-4 inline-flex">Kembali</Link>
        </div>
      </div>
    );
  }
  return <StoreCtx.Provider value={state.store}>{children}</StoreCtx.Provider>;
}
