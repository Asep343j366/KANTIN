"use client";
// Lembar detail menu (bottom sheet). Naik dari bawah, tutup dengan geser ke
// bawah / ketuk area gelap / tombol kembali HP. Tanpa catatan (keputusan user).
import { useEffect, useRef, useState } from "react";
import { rupiah } from "@/lib/format";
import { addToCart } from "@/lib/cart";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { flyToCart, tintFor, Icon, RollingRupiah } from "@/components/store/fx";

export default function ProductSheet({ product, rank, demo, alternatives = [], onClose, onPick }) {
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(false);
  const [drag, setDrag] = useState(0);
  const [closing, setClosing] = useState(false);
  const startY = useRef(null);
  const ctaRef = useRef(null);

  useEffect(() => { setQty(1); setFav(isFavorite(product.id)); }, [product.id]);

  // Tombol kembali HP menutup lembar (bukan meninggalkan halaman).
  useEffect(() => {
    history.pushState({ zkSheet: true }, "");
    const onPop = () => close(true);
    window.addEventListener("popstate", onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("popstate", onPop); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close(fromPop = false) {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      if (!fromPop && history.state?.zkSheet) history.back();
      onClose();
    }, 220);
  }

  const habis = !product.tersedia || product.stok <= 0;
  const disabled = habis || demo;
  const sedikit = !habis && product.stok <= 5;
  const maxQty = Math.max(1, product.stok || 1);

  function add() {
    if (disabled) return;
    addToCart(product, qty);
    flyToCart(ctaRef.current);
    close();
  }

  const onStart = (e) => { startY.current = e.touches[0].clientY; };
  const onMove = (e) => {
    if (startY.current == null) return;
    setDrag(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onEnd = () => { if (drag > 110) close(); else setDrag(0); startY.current = null; };

  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={() => close()}
        className={`absolute inset-0 bg-[#0a1d42]/50 backdrop-blur-[2px] transition-opacity duration-200 ${closing ? "opacity-0" : "zk-fade"}`} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[90vh] w-full max-w-md flex-col rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(10,29,66,.3)] ${closing ? "" : "zk-sheet"}`}
        style={{ transform: closing ? "translateY(100%)" : `translateY(${drag}px)`, transition: closing || !drag ? "transform .22s ease-in" : "none" }}
      >
        <div onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} className="shrink-0 pb-2 pt-2.5">
          <div className="mx-auto h-1.5 w-11 rounded-full bg-[#d9dfec]" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className={`zk-zoom relative overflow-hidden rounded-3xl bg-gradient-to-br ${habis ? "from-[#eef0f5] to-[#dde2ec]" : tintFor(product.id)} aspect-[4/3]`}>
            {product.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.foto_url} alt={product.nama} className={`h-full w-full object-cover ${habis ? "opacity-50 grayscale" : ""}`} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#9aa3b8]">{Icon.photo(48)}</div>
            )}
            {rank && !habis && (
              <span className="zk-shine absolute left-3 top-3 flex items-center gap-1 rounded-xl bg-[#0f2a5c] px-2.5 py-1 text-xs font-bold text-[#ffb36b] shadow-lg">
                {Icon.flame(12)} Terlaris #{rank}
              </span>
            )}
            {habis && (
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
                <span className="rounded-xl bg-[#14213d] px-4 py-1.5 text-sm font-bold text-white shadow-lg">Habis hari ini</span>
              </span>
            )}
            <button onClick={() => setFav(toggleFavorite(product.id))} aria-label="Favorit"
              className="zk-press absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-[#94A3B8] shadow-lg">
              {Icon.heart(19, fav)}
            </button>
          </div>

          <div className="zk-up mt-4" style={{ animationDelay: ".05s" }}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-extrabold leading-tight text-[#14213d]">{product.nama}</h2>
              <span className={`shrink-0 text-xl font-extrabold ${habis ? "text-[#9aa3b8]" : "text-[#0f2a5c]"}`}>{rupiah(product.harga)}</span>
            </div>
            {product.deskripsi && <p className="mt-1.5 text-sm leading-relaxed text-[#6b7591]">{product.deskripsi}</p>}
            {sedikit && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#fff3e0] px-2 py-1 text-xs font-bold text-[#a35a0a]">
                Sisa {product.stok} — jangan sampai kehabisan
              </p>
            )}
          </div>

          {habis && alternatives.length > 0 && (
            <div className="zk-up mt-5" style={{ animationDelay: ".1s" }}>
              <p className="mb-2 text-sm font-bold text-[#14213d]">Coba yang ini</p>
              <div className="grid grid-cols-2 gap-3">
                {alternatives.slice(0, 2).map((a) => (
                  <button key={a.id} onClick={() => onPick?.(a)} className="zk-card zk-press p-2 text-left">
                    <div className={`aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br ${tintFor(a.id)}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {a.foto_url && <img src={a.foto_url} alt={a.nama} className="h-full w-full object-cover" />}
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-xs font-bold text-[#14213d]">{a.nama}</p>
                    <p className="text-xs font-extrabold text-[#0f2a5c]">{rupiah(a.harga)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bar aksi bawah */}
        <div className="shrink-0 border-t border-[#eef1f7] bg-white px-4 pb-5 pt-3">
          {habis ? (
            <div className="rounded-2xl bg-[#e6e9f1] py-3.5 text-center text-sm font-bold text-[#6b7591]">Stok habis</div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-2xl bg-[#f2f4f9] p-1">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="zk-press grid h-10 w-10 place-items-center rounded-xl bg-white text-[#0f2a5c] shadow-sm" aria-label="Kurangi">{Icon.minus()}</button>
                <span key={qty} className="zk-pop w-7 text-center text-base font-extrabold text-[#14213d]">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="zk-press grid h-10 w-10 place-items-center rounded-xl bg-white text-[#0f2a5c] shadow-sm" aria-label="Tambah">{Icon.plus()}</button>
              </div>
              <button ref={ctaRef} onClick={add} disabled={demo}
                className="zk-cta zk-press flex-1 rounded-2xl py-3.5 text-sm font-extrabold disabled:opacity-50">
                Tambah · <RollingRupiah value={product.harga * qty} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
