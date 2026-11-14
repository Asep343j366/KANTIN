"use client";
import { thumbUrl, thumbFallback } from "@/lib/thumb";
import { useEffect, useRef, useState } from "react";
import { rupiah } from "@/lib/format";
import { addToCart, getQtyById, decById } from "@/lib/cart";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { flyToCart, tintFor, Icon } from "@/components/store/fx";
import { discountedPrice, pctOff } from "@/lib/promo";

// Kartu menu premium. Ketuk kartu → onOpen(product) (lembar detail).
// variant "rail" = kartu ramping untuk baris Terlaris (geser ke samping).
export default function ProductCard({ product, demo, onOpen, rank, variant = "grid", style, promo }) {
  const habis = !product.tersedia || product.stok <= 0;
  const disabled = habis || demo;
  const [qty, setQty] = useState(0);
  const [fav, setFav] = useState(false);
  const [imgOk, setImgOk] = useState(false);
  const addRef = useRef(null);
  // Promo diskon aktif → harga efektif + label potongan.
  const harga = promo ? discountedPrice(product.harga, promo) : product.harga;
  const diskon = promo && harga < product.harga;
  const offLabel = diskon ? (promo.diskon_tipe === "nominal" ? `-${rupiah(product.harga - harga).replace("Rp", "Rp")}` : `-${pctOff(product.harga, harga)}%`) : "";

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

  function add(e) {
    e.stopPropagation();
    if (disabled) return;
    addToCart(product, 1, "", diskon ? { id: promo.id, harga } : null);
    flyToCart(addRef.current || e.currentTarget);
  }
  function dec(e) { e.stopPropagation(); decById(product.id); }

  const rail = variant === "rail";
  const sedikit = !habis && product.stok > 0 && product.stok <= 5;

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onOpen?.(product)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen?.(product); }}
      style={style}
      className={`zk-card zk-up zk-press relative cursor-pointer p-2 ${rail ? "w-[148px] shrink-0 snap-start" : ""}`}
    >
      <div className={`relative overflow-hidden rounded-[0.9rem] bg-gradient-to-br ${tintFor(product.id)} ${rail ? "h-[104px]" : "aspect-square"}`}>
        {product.foto_url ? (
          <>
            {!imgOk && <div className="zk-shimmer absolute inset-0" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl(product.foto_url)} onError={thumbFallback(product.foto_url)} alt={product.nama} loading="lazy" decoding="async"
              onLoad={() => setImgOk(true)} onError={() => setImgOk(true)}
              className={`h-full w-full object-cover transition-opacity duration-300 ${imgOk ? "opacity-100" : "opacity-0"}`} />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#9aa3b8]">{Icon.photo(30)}</div>
        )}

        {rank && (
          <span className={`absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-lg bg-[#0f2a5c] px-1.5 py-0.5 text-[11px] font-bold text-[#ffb36b] shadow ${rank === 1 ? "zk-shine" : ""}`}>
            {Icon.flame(11)}#{rank}
          </span>
        )}
        {diskon && !habis && (
          <span className={`absolute left-1.5 rounded-lg bg-gradient-to-br from-[#ff9447] to-[#e8561a] px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow ${rank ? "top-8" : "top-1.5"}`}>{offLabel}</span>
        )}
        {habis && (
          <span className="absolute inset-x-0 bottom-0 bg-[#14213d]/80 py-1 text-center text-[11px] font-bold text-white">Habis</span>
        )}
        {sedikit && !rank && !diskon && (
          <span className="absolute left-1.5 top-1.5 rounded-lg bg-white/95 px-1.5 py-0.5 text-[11px] font-bold text-[#a35a0a] shadow">Sisa {product.stok}</span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); setFav(toggleFavorite(product.id)); }}
          className="zk-press absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#94A3B8] shadow"
          aria-label="Favorit">
          {Icon.heart(15, fav)}
        </button>
      </div>

      <div className="px-1 pb-0.5 pt-2">
        <h3 className="line-clamp-1 text-[13px] font-bold text-[#14213d]">{product.nama}</h3>
        <div className="mt-1 flex items-center justify-between gap-1">
          {diskon ? (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[10px] text-[#9aa3b8] line-through">{rupiah(product.harga)}</span>
              <span className="text-[13px] font-extrabold text-[#e8561a]">{rupiah(harga)}</span>
            </span>
          ) : (
            <span className="text-[13px] font-extrabold text-[#0f2a5c]">{rupiah(product.harga)}</span>
          )}
          {qty > 0 ? (
            <div className="zk-fade flex items-center gap-1 rounded-[10px] bg-[#0f2a5c] p-0.5 text-white" onClick={(e) => e.stopPropagation()}>
              <button onClick={dec} className="zk-press grid h-6 w-6 place-items-center rounded-lg" aria-label="Kurangi">{Icon.minus(13)}</button>
              <span className="min-w-[14px] text-center text-xs font-bold">{qty}</span>
              <button ref={addRef} disabled={disabled} onClick={add} className="zk-press grid h-6 w-6 place-items-center rounded-lg bg-white/15 disabled:opacity-40" aria-label="Tambah">{Icon.plus(13)}</button>
            </div>
          ) : (
            <button ref={addRef} disabled={disabled} onClick={add}
              className="zk-cta zk-press grid h-8 w-8 place-items-center rounded-[10px] disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
              aria-label="Tambah ke keranjang">
              {Icon.plus(16)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
