"use client";
// Banner promo (didesain dari template di admin). Dipakai di pratinjau admin
// & carousel toko pembeli. Murni tampilan.
import { thumbUrl, thumbFallback } from "@/lib/thumb";
import { rupiah } from "@/lib/format";
import { tplOf, discountedPrice, bundleNormal, pctOff } from "@/lib/promo";

const fmtTgl = (d) => {
  try { return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }); } catch { return d; }
};

export default function PromoBanner({ promo, prodMap = {}, sisa = null, className = "", onClick }) {
  const b = promo.banner || {};
  const t = tplOf(b.template);
  const aksen = b.aksen || t.aksen;
  const items = (promo.items || []).map((it) => ({ ...it, p: prodMap[it.product_id] })).filter((x) => x.p);

  let badge = "", oldPrice = null, newPrice = null;
  if (promo.jenis === "bundling") {
    const normal = bundleNormal(promo, prodMap);
    const off = pctOff(normal, promo.harga_paket || 0);
    badge = off > 0 ? `PAKET · HEMAT ${off}%` : "PAKET";
    oldPrice = normal > (promo.harga_paket || 0) ? normal : null;
    newPrice = promo.harga_paket || 0;
  } else {
    badge = promo.diskon_tipe === "nominal" ? `DISKON ${rupiah(promo.diskon_nilai || 0)}` : `DISKON ${promo.diskon_nilai || 0}%`;
    if (items.length === 1) { oldPrice = items[0].p.harga; newPrice = discountedPrice(items[0].p.harga, promo); }
  }
  const judul = b.judul || promo.nama || "Promo";
  const sub = b.sub || (promo.jenis === "bundling"
    ? items.map((x) => `${x.qty || 1}× ${x.p.nama}`).join(" + ")
    : items.length > 1 ? `${items.length} menu pilihan` : items[0]?.p.nama || "");
  const fotos = b.foto === false ? [] : items.map((x) => x.p.foto_url).filter(Boolean).slice(0, 2);
  const textOnAksen = ["#ffffff", "#ffd23f", "#3dd6f5"].includes(aksen) ? "#14213d" : "#ffffff";

  return (
    <div onClick={onClick} role={onClick ? "button" : undefined}
      className={`relative h-[128px] overflow-hidden rounded-[20px] p-3.5 shadow-[0_10px_24px_rgba(15,42,92,.22)] ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ background: t.bg, color: t.text }}>
      {/* dekorasi */}
      {t.deco === "circle" && <span className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full" style={{ background: aksen, opacity: 0.9 }} />}
      {t.deco === "stripe" && <span className="pointer-events-none absolute -right-6 top-0 h-full w-24 -skew-x-12" style={{ background: aksen, opacity: 0.85 }} />}
      {t.deco === "dots" && <span className="pointer-events-none absolute right-2 top-2 h-20 w-20 opacity-50" style={{ backgroundImage: `radial-gradient(${aksen} 2.5px, transparent 3px)`, backgroundSize: "12px 12px" }} />}

      <div className="relative z-10 flex h-full flex-col" style={{ maxWidth: fotos.length > 1 ? "64%" : fotos.length ? "70%" : "100%" }}>
        <span className="self-start rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide" style={{ background: aksen, color: textOnAksen }}>{badge}</span>
        <p className="mt-1 truncate pb-0.5 text-[17px] font-extrabold leading-[1.35]">{judul}</p>
        <p className="truncate text-[11px] leading-snug" style={{ color: t.sub }}>{sub}</p>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="leading-tight">
            {oldPrice != null && <span className="mr-1 text-[11px] line-through" style={{ color: t.sub }}>{rupiah(oldPrice)}</span>}
            {newPrice != null && <span className="text-[15px] font-extrabold">{rupiah(newPrice)}</span>}
          </div>
        </div>
        <p className="mt-0.5 text-[10px]" style={{ color: t.sub }}>
          s/d {fmtTgl(promo.berakhir)}{sisa != null ? ` · sisa ${sisa}` : ""}
        </p>
      </div>

      {fotos.length > 0 && (
        <div className="absolute bottom-3.5 right-3 z-10 flex">
          {fotos.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={thumbUrl(f)} onError={thumbFallback(f)} alt="" className={`h-[56px] w-[56px] rounded-xl border-2 border-white/90 bg-white object-cover shadow-lg ${i ? "-ml-4" : ""}`}
              style={{ transform: fotos.length > 1 ? `rotate(${i ? 7 : -7}deg)` : undefined, zIndex: i ? 2 : 1 }} />
          ))}
        </div>
      )}
    </div>
  );
}
