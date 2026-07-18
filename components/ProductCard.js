"use client";
import Link from "next/link";
import { rupiah } from "@/lib/format";
import { addToCart } from "@/lib/cart";

export default function ProductCard({ product }) {
  const habis = !product.tersedia || product.stok <= 0;
  return (
    <div className="card overflow-hidden">
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
      <div className="p-3">
        <Link href={`/product/${product.id}`}>
          <h3 className="line-clamp-1 text-sm font-semibold">{product.nama}</h3>
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-bold text-primary">{rupiah(product.harga)}</span>
          <button
            disabled={habis}
            onClick={() => addToCart(product, 1)}
            className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white shadow-card disabled:bg-gray-300"
            aria-label="Tambah ke keranjang"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
