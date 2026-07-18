"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getCart, updateQty, removeItem, cartTotal } from "@/lib/cart";
import { rupiah } from "@/lib/format";

export default function CartPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const upd = () => setItems(getCart());
    upd();
    window.addEventListener("cart:update", upd);
    return () => window.removeEventListener("cart:update", upd);
  }, []);

  const total = cartTotal(items);

  if (items.length === 0) {
    return (
      <main className="container-app pt-16 text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-primary-light text-primary">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3h2l2 13h11l2-9H6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
        </div>
        <h1 className="text-lg font-bold">Keranjang kosong</h1>
        <p className="mt-1 text-sm text-ink-soft">Yuk pilih menu favoritmu.</p>
        <Link href="/" className="btn-primary mt-6 inline-flex">Lihat Menu</Link>
      </main>
    );
  }

  return (
    <main className="container-app pb-32 pt-5">
      <h1 className="mb-4 text-xl font-extrabold">Keranjang</h1>
      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={idx} className="card flex gap-3 p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">
              {it.foto_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.foto_url} alt={it.nama} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className="text-sm font-semibold">{it.nama}</h3>
                <button onClick={() => removeItem(idx)} className="text-ink-soft">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              {it.note && <p className="text-xs text-ink-soft">Catatan: {it.note}</p>}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-primary">{rupiah(it.harga)}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(idx, it.qty - 1)} className="grid h-7 w-7 place-items-center rounded-full border border-gray-200">−</button>
                  <span className="w-5 text-center text-sm font-bold">{it.qty}</span>
                  <button onClick={() => updateQty(idx, it.qty + 1)} className="grid h-7 w-7 place-items-center rounded-full border border-gray-200">+</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-gray-100 bg-white p-4">
        <div className="container-app flex items-center gap-3 px-0">
          <div className="flex-1">
            <p className="text-xs text-ink-soft">Total ({items.reduce((s,i)=>s+i.qty,0)} item)</p>
            <p className="text-lg font-extrabold text-primary">{rupiah(total)}</p>
          </div>
          <Link href="/checkout" className="btn-primary flex-1">Checkout</Link>
        </div>
      </div>
    </main>
  );
}
