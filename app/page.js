"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProductCard from "@/components/ProductCard";

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [loading, setLoading] = useState(true);

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
      const okCat = cat === "all" || p.category_id === cat;
      const okQ = p.nama.toLowerCase().includes(q.toLowerCase());
      return okCat && okQ;
    });
  }, [products, q, cat]);

  return (
    <main className="container-app pt-5">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Selamat datang di
        </p>
        <h1 className="text-2xl font-extrabold">{settings?.nama_kantin || "Kantin Digital"}</h1>
        {settings?.jam_operasional && (
          <p className="mt-0.5 text-sm text-ink-soft">Buka: {settings.jam_operasional}</p>
        )}
      </header>

      <div className="sticky top-0 z-30 -mx-4 bg-surface/95 px-4 pb-3 pt-1 backdrop-blur">
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
          {categories.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.nama}</Chip>
          ))}
        </div>
      </div>

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
