"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProductCard from "@/components/ProductCard";
import Header from "@/components/Header";
import { getFavorites } from "@/lib/favorites";

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState([]);

  useEffect(() => {
    const upd = () => setFavs(getFavorites());
    upd();
    window.addEventListener("fav:update", upd);
    return () => window.removeEventListener("fav:update", upd);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: prod }, { data: cats }, { data: set }] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("urutan"),
        supabase.from("settings").select("*").eq("id", 1).single(),
      ]);
      setProducts(prod || []);
      setCategories(cats || []);
      setSettings(set || null);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const okCat = cat === "fav" ? favs.includes(p.id) : (cat === "all" || p.category_id === cat);
      const okQ = p.nama.toLowerCase().includes(q.toLowerCase());
      return okCat && okQ;
    });
  }, [products, q, cat, favs]);

  return (
    <main className="pb-5">
      <Header settings={settings} />

      <div className="container-app sticky top-0 z-30 bg-surface/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" strokeLinecap="round"/>
          </svg>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Cari makanan atau minuman..."
            className="input pl-10"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>Semua</Chip>
          <Chip active={cat === "fav"} onClick={() => setCat("fav")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={cat === "fav" ? "#fff" : "none"} stroke="currentColor" strokeWidth="2" className="mr-1 inline">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
            </svg>
            Favorit
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.nama}</Chip>
          ))}
        </div>
      </div>

      <div className="container-app">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-56 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-ink-soft">Tidak ada produk ditemukan.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </main>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-primary text-white shadow-card" : "bg-white text-ink-soft"
      }`}>
      {children}
    </button>
  );
}
