"use client";
import { thumbUrl, thumbFallback } from "@/lib/thumb";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCart, updateQty, removeItem, cartTotal, cartCount, clearCart } from "@/lib/cart";
import { rupiah } from "@/lib/format";
import { useSlug, storePath } from "@/lib/slug";
import { confirmDialog } from "@/lib/confirmDialog";
import { TopBar, StepBar, Icon, RollingRupiah, tintFor } from "@/components/store/fx";

export default function CartPage() {
  const slug = useSlug();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [leaving, setLeaving] = useState(null);

  useEffect(() => {
    const upd = () => setItems(getCart());
    upd();
    window.addEventListener("cart:update", upd);
    return () => window.removeEventListener("cart:update", upd);
  }, []);

  const total = cartTotal(items);
  const count = cartCount(items);
  const hemat = items.reduce((s, i) => s + Math.max(0, ((i.harga_normal || i.harga) - i.harga) * i.qty), 0);

  function remove(idx) {
    setLeaving(idx);
    setTimeout(() => { removeItem(idx); setLeaving(null); }, 220);
  }
  async function clearAll() {
    const ok = await confirmDialog({ title: "Kosongkan keranjang?", message: "Semua menu di keranjang akan dihapus.", confirmLabel: "Kosongkan", danger: true });
    if (ok) clearCart();
  }

  if (items.length === 0) {
    return (
      <main className="container-app pb-28">
        <TopBar title="Keranjang" onBack={() => router.push(storePath(slug))} />
        <div className="zk-up pt-14 text-center">
          <div className="relative mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full bg-[#e1e8f6] text-[#0f2a5c]">
            <span className="zk-ripple absolute inset-0 rounded-full bg-[#e1e8f6]" />
            <svg className="relative" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h2l2 13h11l2-9H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
          </div>
          <h2 className="text-lg font-extrabold text-[#14213d]">Keranjang masih kosong</h2>
          <p className="mt-1 text-sm text-[#6b7591]">Yuk pilih menu favoritmu dulu.</p>
          <Link href={storePath(slug)} className="zk-cta zk-press mt-6 inline-flex rounded-2xl px-6 py-3 text-sm font-extrabold">Lihat menu</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-app pb-56">
      <TopBar title="Keranjang" onBack={() => router.push(storePath(slug))}
        right={<button onClick={clearAll} className="text-xs font-bold text-[#9aa3b8]">Hapus semua</button>} />
      <StepBar step={1} />

      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={`${it.id}-${it.note || ""}`}
            className={`zk-card zk-up flex gap-3 p-2.5 transition-all duration-200 ${leaving === idx ? "translate-x-10 opacity-0" : ""}`}
            style={{ animationDelay: `${idx * 0.04}s` }}>
            <div className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${tintFor(it.id)}`}>
              {it.foto_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl(it.foto_url)} onError={thumbFallback(it.foto_url)} alt={it.nama} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-bold text-[#14213d]">{it.nama}</h3>
                <button onClick={() => remove(idx)} className="zk-press text-[#b4bccd]" aria-label="Hapus">{Icon.trash(17)}</button>
              </div>
              {it.bundle && (
                <p className="text-[11px] leading-snug text-[#6b7591]">
                  <span className="mr-1 rounded bg-[#0f2a5c] px-1 py-px text-[10px] font-bold text-[#ffb36b]">PAKET</span>
                  {(it.components || []).map((c) => `${c.qty}× ${c.nama}`).join(" + ")}
                </p>
              )}
              {it.note && <p className="text-xs text-[#c2560f]">{it.note}</p>}
              <div className="flex items-center justify-between">
                <span className="flex flex-col leading-tight">
                  {it.harga_normal > it.harga && <span className="text-[11px] text-[#9aa3b8] line-through">{rupiah(it.harga_normal * it.qty)}</span>}
                  <span className={`text-sm font-extrabold ${it.harga_normal > it.harga ? "text-[#e8561a]" : "text-[#0f2a5c]"}`}>{rupiah(it.harga * it.qty)}</span>
                </span>
                <div className="flex items-center gap-1 rounded-xl bg-[#f2f4f9] p-0.5">
                  <button onClick={() => (it.qty > 1 ? updateQty(idx, it.qty - 1) : remove(idx))}
                    className="zk-press grid h-7 w-7 place-items-center rounded-lg bg-white text-[#0f2a5c] shadow-sm" aria-label="Kurangi">{Icon.minus(13)}</button>
                  <span key={it.qty} className="zk-pop w-6 text-center text-sm font-extrabold">{it.qty}</span>
                  <button onClick={() => updateQty(idx, it.qty + 1)}
                    className="zk-press grid h-7 w-7 place-items-center rounded-lg bg-white text-[#0f2a5c] shadow-sm" aria-label="Tambah">{Icon.plus(13)}</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Link href={storePath(slug)} className="mt-3 flex items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#d9dfec] py-3 text-sm font-bold text-[#0f2a5c]">
        {Icon.plus(14)} Tambah menu lain
      </Link>

      {/* Ringkasan + CTA */}
      <div className="fixed inset-x-0 bottom-[74px] z-30">
        <div className="container-app">
          <div className="zk-card zk-up p-4 shadow-[0_-4px_24px_rgba(15,42,92,.12)]">
            <div className="flex justify-between text-sm"><span className="text-[#6b7591]">Subtotal ({count} item)</span><span className="font-semibold">{rupiah(total + hemat)}</span></div>
            {hemat > 0 && <div className="mt-1 flex justify-between text-sm"><span className="text-[#6b7591]">Hemat promo</span><span className="font-semibold text-emerald-600">−{rupiah(hemat)}</span></div>}
            <div className="mt-1 flex justify-between text-sm"><span className="text-[#6b7591]">Biaya layanan</span><span className="font-semibold text-emerald-600">Gratis</span></div>
            <div className="my-2.5 border-t border-dashed border-[#d9dfec]" />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-[#6b7591]">Total</p>
                <RollingRupiah value={total} className="text-xl font-extrabold text-[#0f2a5c]" />
              </div>
              <Link href={storePath(slug, "/checkout")} className="zk-cta zk-press rounded-2xl px-5 py-3.5 text-sm font-extrabold">
                Lanjut isi data →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
