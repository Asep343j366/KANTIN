"use client";
// Lembar detail paket bundling: isi paket, harga normal vs paket, tombol ambil.
import { useEffect, useRef, useState } from "react";
import { rupiah } from "@/lib/format";
import { addBundle } from "@/lib/cart";
import { bundleNormal, sisaKuota } from "@/lib/promo";
import PromoBanner from "@/components/store/PromoBanner";
import { flyToCart, tintFor, Icon, RollingRupiah } from "@/components/store/fx";
import { useSwipeClose } from "@/components/store/useSwipeClose";

export default function BundleSheet({ promo, prodMap, usage, demo, onClose }) {
  const [qty, setQty] = useState(1);
  const [closing, setClosing] = useState(false);
  const ctaRef = useRef(null);
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);
  const drag = useSwipeClose(sheetRef, scrollRef, () => close());

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
    setTimeout(() => { if (!fromPop && history.state?.zkSheet) history.back(); onClose(); }, 220);
  }

  const comps = (promo.items || []).map((it) => ({ it, p: prodMap[it.product_id] })).filter((x) => x.p);
  // Paket bisa diambil hanya bila semua isinya tersedia & stok cukup.
  const maxByStock = comps.length
    ? Math.min(...comps.map(({ it, p }) => (p.tersedia ? Math.floor((p.stok || 0) / (it.qty || 1)) : 0)))
    : 0;
  const sisa = sisaKuota(promo, usage);
  const maxQty = Math.max(0, Math.min(maxByStock, sisa ?? Infinity));
  const habis = maxQty <= 0 || comps.length !== (promo.items || []).length;
  const normal = bundleNormal(promo, prodMap);
  const paket = promo.harga_paket || 0;

  function take() {
    if (habis || demo) return;
    addBundle(promo, comps.map(({ it, p }) => ({ product_id: p.id, nama: p.nama, qty: it.qty || 1, harga_normal: p.harga })),
      comps[0]?.p.foto_url, Math.min(qty, maxQty));
    flyToCart(ctaRef.current);
    close();
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={() => close()} className={`absolute inset-0 bg-[#0a1d42]/50 backdrop-blur-[2px] transition-opacity duration-200 ${closing ? "opacity-0" : "zk-fade"}`} />
      <div ref={sheetRef} className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[90vh] w-full max-w-md flex-col rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(10,29,66,.3)] ${closing ? "" : "zk-sheet"}`}
        style={{ transform: closing ? "translateY(100%)" : `translateY(${drag}px)`, transition: closing || !drag ? "transform .22s ease-in" : "none" }}>
        <div className="shrink-0 pb-2 pt-2.5"><div className="mx-auto h-1.5 w-11 rounded-full bg-[#d9dfec]" /></div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          <PromoBanner promo={promo} prodMap={prodMap} sisa={sisa} />
          <p className="mb-2 mt-4 text-sm font-extrabold text-[#14213d]">Isi paket</p>
          <div className="space-y-2">
            {comps.map(({ it, p }) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-[#f8f9fc] p-2">
                <span className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${tintFor(p.id)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.foto_url && <img src={p.foto_url} alt="" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0 flex-1 text-sm text-[#14213d]"><b>{it.qty || 1}×</b> {p.nama}</span>
                <span className="text-xs text-[#9aa3b8] line-through">{rupiah(p.harga * (it.qty || 1))}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-dashed border-[#d9dfec] pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-[#6b7591]">Harga paket</span>
              <span>
                {normal > paket && <span className="mr-1.5 text-sm text-[#9aa3b8] line-through">{rupiah(normal)}</span>}
                <span className="text-xl font-extrabold text-[#0f2a5c]">{rupiah(paket)}</span>
              </span>
            </div>
            {normal > paket && <p className="text-right text-xs font-bold text-emerald-600">Hemat {rupiah(normal - paket)}</p>}
          </div>
        </div>
        <div className="shrink-0 border-t border-[#eef1f7] bg-white px-4 pb-5 pt-3">
          {habis ? (
            <div className="rounded-2xl bg-[#e6e9f1] py-3.5 text-center text-sm font-bold text-[#6b7591]">
              {sisa === 0 ? "Kuota paket habis" : "Paket sedang tidak tersedia"}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-2xl bg-[#f2f4f9] p-1">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="zk-press grid h-10 w-10 place-items-center rounded-xl bg-white text-[#0f2a5c] shadow-sm" aria-label="Kurangi">{Icon.minus()}</button>
                <span key={qty} className="zk-pop w-7 text-center text-base font-extrabold text-[#14213d]">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="zk-press grid h-10 w-10 place-items-center rounded-xl bg-white text-[#0f2a5c] shadow-sm" aria-label="Tambah">{Icon.plus()}</button>
              </div>
              <button ref={ctaRef} onClick={take} disabled={demo} className="zk-cta zk-press flex-1 rounded-2xl py-3.5 text-sm font-extrabold disabled:opacity-50">
                Ambil paket · <RollingRupiah value={paket * qty} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
