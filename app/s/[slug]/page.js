"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ProductCard from "@/components/ProductCard";
import ProductSheet from "@/components/store/ProductSheet";
import BrandLogo from "@/components/BrandLogo";
import { useBrand } from "@/lib/brand";
import { getFavorites } from "@/lib/favorites";
import { getCart, cartCount, cartTotal } from "@/lib/cart";
import { useSlug, storePath } from "@/lib/slug";
import { loadBestSellers } from "@/components/store/bestSellers";
import { CatIcon, Icon, greeting, openStatus, useBump, RollingRupiah } from "@/components/store/fx";
import { useStore } from "./StoreProvider";
import PromoCarousel from "@/components/store/PromoCarousel";
import BundleSheet from "@/components/store/BundleSheet";
import { loadActivePromos } from "@/lib/promo";
import { logoOf } from "@/lib/storeLogo";

export default function CatalogPage() {
  const store = useStore();
  const brand = useBrand();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState([]);
  const [best, setBest] = useState({});
  const [open, setOpen] = useState(null); // produk yang dibuka di lembar detail
  const [promo, setPromo] = useState({ list: [], diskonByProduct: {}, usage: {} });
  const [bundle, setBundle] = useState(null); // promo bundling yang dibuka
  const [now, setNow] = useState(null);

  useEffect(() => { setNow(new Date()); }, []);

  useEffect(() => {
    const upd = () => setFavs(getFavorites());
    upd();
    window.addEventListener("fav:update", upd);
    return () => window.removeEventListener("fav:update", upd);
  }, []);

  useEffect(() => {
    if (!store?.id) return;
    (async () => {
      const [{ data: prod }, { data: cats }, { data: set }] = await Promise.all([
        supabase.from("products").select("*").eq("store_id", store.id).order("created_at", { ascending: false }),
        supabase.from("categories").select("*").eq("store_id", store.id).order("urutan"),
        supabase.from("settings").select("*").eq("store_id", store.id).maybeSingle(),
      ]);
      setProducts(prod || []);
      setCategories(cats || []);
      setSettings(set || null);
      setLoading(false);
    })();
    // Terlaris: dimuat terpisah agar tak menahan tampilan menu.
    loadBestSellers(store.id).then(setBest).catch(() => {});
    // Promo aktif (tabel belum ada / gagal → kosong, toko tetap normal).
    loadActivePromos(store.id).then(setPromo).catch(() => {});
  }, [store?.id]);

  const available = (p) => p.tersedia && p.stok > 0;

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const okCat = cat === "fav" ? favs.includes(p.id) : (cat === "all" || p.category_id === cat);
      const okQ = p.nama.toLowerCase().includes(q.toLowerCase());
      return available(p) && okCat && okQ; // sembunyikan produk habis
    });
  }, [products, q, cat, favs]);

  // Peringkat terlaris (hanya produk yang masih tersedia), maks 8.
  const ranking = useMemo(() => {
    return products
      .filter((p) => available(p) && best[p.id] > 0)
      .sort((a, b) => best[b.id] - best[a.id])
      .slice(0, 8);
  }, [products, best]);
  const rankOf = useMemo(() => {
    const m = {};
    ranking.forEach((p, i) => { m[p.id] = i + 1; });
    return m;
  }, [ranking]);

  const alternatives = useMemo(() => {
    if (!open) return [];
    return products.filter((p) => p.id !== open.id && available(p) && p.category_id === open.category_id).slice(0, 2);
  }, [open, products]);

  const prodMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  // Banner hanya untuk promo yang menunya masih ada di toko.
  const banners = useMemo(() => promo.list.filter((p) => (p.items || []).some((it) => prodMap[it.product_id])), [promo.list, prodMap]);
  function openPromo(p) {
    if (p.jenis === "bundling") return setBundle(p);
    const first = (p.items || []).map((it) => prodMap[it.product_id]).find((x) => x && x.tersedia && x.stok > 0)
      || prodMap[p.items?.[0]?.product_id];
    if (first) setOpen(first);
  }

  const status = openStatus(settings?.jam_operasional, now || undefined);
  const nama = settings?.nama_kantin || store?.nama || "Kantin Digital";
  const showRail = !q && cat === "all" && ranking.length > 0;

  return (
    <main className="pb-44">
      {/* HERO */}
      <header className="zk-hero relative overflow-hidden rounded-b-[28px] px-4 pb-14 pt-4 text-white">
        <span className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/[0.07]" />
        <span className="pointer-events-none absolute right-16 top-16 h-20 w-20 rounded-full bg-white/[0.06]" />
        <span className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-[#ff8a3d]/10" />
        <div className="container-app relative px-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-white/85">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoOf(brand)} alt="Logo" className="h-full w-full object-contain" />
              </span>
              <BrandLogo brand={brand} />
            </div>
            {status && (
              <span className={`zk-fade rounded-full px-2.5 py-1 text-[11px] font-bold ${
                status.open === false ? "bg-red-500/20 text-red-200" : "bg-emerald-400/20 text-emerald-200"}`}>
                {status.open === null ? status.label : `● ${status.open ? "Buka" : "Tutup"} · ${status.label}`}
              </span>
            )}
          </div>
          <p className="zk-up mt-5 text-sm text-[#b8c4dd]">{now ? greeting(now) : "Halo"} 👋</p>
          <h1 className="zk-up text-2xl font-extrabold leading-tight" style={{ animationDelay: ".05s" }}>{nama}</h1>
          <p className="zk-up mt-0.5 text-xs text-white/60" style={{ animationDelay: ".1s" }}>Pesan dari HP, bayar QRIS, ambil di kantin.</p>
        </div>
      </header>

      {/* CARI */}
      <div className="container-app relative z-10 -mt-7">
        <label className="zk-card zk-up flex items-center gap-2.5 px-4 py-3.5 text-[#6b7591]" style={{ animationDelay: ".12s" }}>
          {Icon.search()}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari makanan atau minuman…"
            className="w-full bg-transparent text-sm text-[#14213d] outline-none placeholder:text-[#9aa3b8]" />
          {q && <button onClick={() => setQ("")} className="text-xs font-bold text-[#0f2a5c]">Hapus</button>}
        </label>
      </div>

      {/* BANNER PROMO */}
      {!q && <PromoCarousel promos={banners} prodMap={prodMap} usage={promo.usage} onOpen={openPromo} />}

      {/* KATEGORI (menempel saat scroll) */}
      <div className="sticky top-0 z-30 mt-3 bg-[#f2f4f9]/90 backdrop-blur">
        <div className="container-app no-scrollbar flex gap-3 overflow-x-auto py-3">
          <CatBtn active={cat === "all"} onClick={() => setCat("all")} label="Semua" icon={<CatIcon name="" />} />
          <CatBtn active={cat === "fav"} onClick={() => setCat("fav")} label="Favorit" icon={Icon.heart(18, cat === "fav" ? false : false)} />
          {categories.map((c) => (
            <CatBtn key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.nama} icon={<CatIcon name={c.nama} />} />
          ))}
        </div>
      </div>

      {/* TERLARIS */}
      {showRail && (
        <section className="mt-1">
          <div className="container-app flex items-center justify-between pb-2">
            <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-[#14213d]">
              <span className="text-[#ff7a2a]">{Icon.flame(16)}</span> Terlaris minggu ini
            </h2>
            <span className="text-[11px] font-semibold text-[#9aa3b8]">geser →</span>
          </div>
          <div className="no-scrollbar mx-auto flex max-w-md snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 pt-1">
            {ranking.map((p, i) => (
              <ProductCard key={p.id} product={p} demo={store?.is_demo} onOpen={setOpen} rank={i + 1} promo={promo.diskonByProduct[p.id]}
                variant="rail" style={{ animationDelay: `${i * 0.05}s` }} />
            ))}
          </div>
        </section>
      )}

      {/* SEMUA MENU */}
      <section className="container-app mt-2">
        <h2 className="pb-2 text-[15px] font-extrabold text-[#14213d]">
          {cat === "fav" ? "Menu favoritmu" : q ? `Hasil untuk “${q}”` : cat === "all" ? "Semua menu" : categories.find((c) => c.id === cat)?.nama}
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="zk-shimmer h-56 rounded-[1.1rem]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="zk-fade py-16 text-center">
            <p className="font-bold text-[#14213d]">{cat === "fav" ? "Belum ada favorit" : "Menu tidak ditemukan"}</p>
            <p className="mt-1 text-sm text-[#6b7591]">{cat === "fav" ? "Ketuk ♡ di menu untuk menyimpannya di sini." : "Coba kata kunci atau kategori lain."}</p>
          </div>
        ) : (
          <div key={cat + q} className="grid grid-cols-2 gap-3">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} product={p} demo={store?.is_demo} onOpen={setOpen} rank={rankOf[p.id]} promo={promo.diskonByProduct[p.id]}
                style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }} />
            ))}
          </div>
        )}
      </section>

      <CartBar />

      {bundle && (
        <BundleSheet promo={bundle} prodMap={prodMap} usage={promo.usage} demo={store?.is_demo} onClose={() => setBundle(null)} />
      )}

      {open && (
        <ProductSheet product={open} rank={rankOf[open.id]} demo={store?.is_demo} alternatives={alternatives} promo={promo.diskonByProduct[open.id]}
          onClose={() => setOpen(null)} onPick={(p) => setOpen(p)} />
      )}
    </main>
  );
}

function CatBtn({ active, onClick, label, icon }) {
  return (
    <button onClick={onClick} className="zk-press flex w-[62px] shrink-0 flex-col items-center gap-1.5">
      <span className={`grid h-12 w-12 place-items-center rounded-2xl transition-all duration-300 ${
        active ? "zk-navy scale-105 shadow-[0_6px_16px_rgba(15,42,92,.35)]" : "bg-white text-[#0f2a5c] shadow-[0_3px_10px_rgba(15,42,92,.10)]"}`}>
        {icon}
      </span>
      <span className={`line-clamp-1 w-full text-center text-[11px] font-bold ${active ? "text-[#0f2a5c]" : "text-[#6b7591]"}`}>{label}</span>
    </button>
  );
}

// Bar keranjang mengambang (muncul bila ada isi) — juga target animasi "terbang".
function CartBar() {
  const slug = useSlug();
  const [items, setItems] = useState([]);
  const bump = useBump();
  useEffect(() => {
    const upd = () => setItems(getCart());
    upd();
    window.addEventListener("cart:update", upd);
    return () => window.removeEventListener("cart:update", upd);
  }, []);
  const n = cartCount(items);
  if (!n) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[74px] z-40">
      <div className="container-app">
        <Link id="zk-cart-target" key={bump} href={storePath(slug, "/cart")}
          className={`zk-navy zk-press pointer-events-auto flex items-center justify-between rounded-2xl px-4 py-3 shadow-[0_12px_28px_rgba(10,29,66,.45)] ${bump ? "zk-pop" : "zk-up"}`}>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-7 min-w-[28px] place-items-center rounded-lg bg-gradient-to-br from-[#ff9447] to-[#f0631c] px-1.5 text-xs font-extrabold text-white">{n}</span>
            item di keranjang
          </span>
          <span className="flex items-center gap-1 text-sm font-extrabold text-[#ffb36b]">
            <RollingRupiah value={cartTotal(items)} /> →
          </span>
        </Link>
      </div>
    </div>
  );
}
