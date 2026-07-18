"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { rupiah } from "@/lib/format";
import { addToCart, getQtyById, decById } from "@/lib/cart";
import { isFavorite, toggleFavorite } from "@/lib/favorites";

export default function ProductCard({ product }) {
  const habis = !product.tersedia || product.stok <= 0;
  const [qty, setQty] = useState(0);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    const updCart = () => setQty(getQtyById(product.id));
    const updFav = () => setFav(isFavorite(product.id));
    updCart(); updFav();
    window.addEventListener("cart:update", updCart);
    window.addEventListener("fav:update", updFav);
    return () => {
      window.removeEventListener("cart:update", updCart);
      window.removeEventListener("fav:update", updFav);
    };
  }, [product.id]);

  return (
    <div className="card relative overflow-hidden">
      <Link href={`/product/${product.id}`} className="block">
        <div className="relative aspect-square bg-surface">
          {product.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.foto_url} alt={product.nama}
              className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-soft">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3h18v18H3zM3 15l5-5 4 4 3-3 6 6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          {habis && (
            <span className="badge absolute left-2 top-2 bg-red-100 text-red-600">Habis</span>
          )}
        </div>
      </Link>

      {/* Tombol favorit */}
      <button
        onClick={(e) => { e.preventDefault(); setFav(toggleFavorite(product.id)); }}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-card"
        aria-label="Favorit"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill={fav ? "#EF4444" : "none"}
          stroke={fav ? "#EF4444" : "#94A3B8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
        </svg>
      </button>

      <div className="p-3">
        <Link href={`/product/${product.id}`}>
          <h3 className="line-clamp-1 text-sm font-semibold">{product.nama}</h3>
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-bold text-primary">{rupiah(product.harga)}</span>

          {qty > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full bg-surface p-0.5">
              <button
                onClick={() => decById(product.id)}
                className="grid h-6 w-6 place-items-center rounded-full bg-white text-primary shadow-card"
                aria-label="Kurangi">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14"/></svg>
              </button>
              <span className="w-4 text-center text-xs font-bold">{qty}</span>
              <button
                disabled={habis}
                onClick={() => addToCart(product, 1)}
                className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#2E86FF] to-[#1657C0] text-white shadow-card disabled:opacity-40"
                aria-label="Tambah">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          ) : (
            <button
              disabled={habis}
              onClick={() => addToCart(product, 1)}
              className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#2E86FF] to-[#1657C0] text-white shadow-card disabled:from-gray-300 disabled:to-gray-300"
              aria-label="Tambah ke keranjang"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
