"use client";
import { supabase } from "@/lib/supabaseClient";

// Resolusi akun Area Manager (AM) yang sedang login.
// Mengembalikan { user_id, email, nama, sites[] } atau null bila bukan AM.
// Di-cache di memori agar tak query berulang antar halaman.
let _cache = null;
let _cacheUser = null;

export async function getMyAm({ force = false } = {}) {
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth?.session?.user?.id || null;
  if (!uid) { _cache = null; _cacheUser = null; return null; }
  if (!force && _cache && _cacheUser === uid) return _cache;

  const { data } = await supabase
    .from("am_accounts")
    .select("user_id, email, nama, sites")
    .eq("user_id", uid)
    .maybeSingle();

  _cache = data || null;
  _cacheUser = uid;
  return _cache;
}

export function clearAmCache() {
  _cache = null;
  _cacheUser = null;
}

// Ambil store yang SUDAH terdaftar (row stores ada) untuk daftar kode_site AM.
// Urutan mengikuti urutan `sites` yang diberikan.
export async function getAmStores(sites) {
  if (!sites?.length) return [];
  const { data } = await supabase
    .from("stores")
    .select("id, kode_site, slug, nama, status, is_trial, langganan_until")
    .in("kode_site", sites);
  const order = {}; sites.forEach((s, i) => (order[s] = i));
  return (data || []).sort((a, b) => (order[a.kode_site] ?? 99) - (order[b.kode_site] ?? 99));
}

// ---- Loader data satu store (dipakai Dashboard Store) ----
export async function loadStoreData(sid) {
  const [{ data: orders }, { data: items }, { data: products }, { data: cats }, { data: settings }] =
    await Promise.all([
      supabase.from("orders").select("id,kode_pesanan,total,created_at,status").eq("store_id", sid),
      supabase.from("order_items").select("order_id,product_id,nama_produk,harga,jumlah").eq("store_id", sid),
      supabase.from("products").select("id,nama,harga,hpp,stok,tersedia,category_id").eq("store_id", sid),
      supabase.from("categories").select("id,nama").eq("store_id", sid),
      supabase.from("settings").select("*").eq("store_id", sid).maybeSingle(),
    ]);
  const catMap = {}; (cats || []).forEach((c) => (catMap[c.id] = c.nama));
  const prods = (products || []).map((p) => ({ ...p, categoryNama: catMap[p.category_id] || "Lainnya" }));
  const { data: journal } = await supabase
    .from("journal").select("jenis,jumlah").eq("store_id", sid);
  const masuk = (journal || []).filter((r) => r.jenis === "masuk").reduce((s, r) => s + r.jumlah, 0);
  const keluar = (journal || []).filter((r) => r.jenis === "keluar").reduce((s, r) => s + r.jumlah, 0);
  return {
    orders: orders || [], items: items || [], products: prods, settings,
    kas: { masuk, keluar, saldo: masuk - keluar },
  };
}

// ---- Loader agregat SELURUH store (dipakai Dashboard Area) ----
// Satu query .in() per tabel, lalu dikelompokkan di JS (hemat round-trip).
export async function loadAreaData(stores) {
  const ids = stores.map((s) => s.id);
  if (!ids.length) return [];
  const [{ data: orders }, { data: items }, { data: products }, { data: cats }, { data: journal }] =
    await Promise.all([
      supabase.from("orders").select("id,kode_pesanan,total,created_at,status,store_id").in("store_id", ids),
      supabase.from("order_items").select("order_id,product_id,nama_produk,harga,jumlah,store_id").in("store_id", ids),
      supabase.from("products").select("id,nama,harga,hpp,stok,tersedia,category_id,store_id").in("store_id", ids),
      supabase.from("categories").select("id,nama,store_id").in("store_id", ids),
      supabase.from("journal").select("jenis,jumlah,store_id").in("store_id", ids),
    ]);

  const group = (arr) => {
    const m = {}; ids.forEach((id) => (m[id] = []));
    (arr || []).forEach((r) => { if (m[r.store_id]) m[r.store_id].push(r); });
    return m;
  };
  const gOrders = group(orders), gItems = group(items), gProducts = group(products),
    gCats = group(cats), gJournal = group(journal);

  return stores.map((s) => {
    const catMap = {}; gCats[s.id].forEach((c) => (catMap[c.id] = c.nama));
    const prods = gProducts[s.id].map((p) => ({ ...p, categoryNama: catMap[p.category_id] || "Lainnya" }));
    const jr = gJournal[s.id];
    const masuk = jr.filter((r) => r.jenis === "masuk").reduce((a, r) => a + r.jumlah, 0);
    const keluar = jr.filter((r) => r.jenis === "keluar").reduce((a, r) => a + r.jumlah, 0);
    return {
      store: s,
      orders: gOrders[s.id],
      items: gItems[s.id],
      products: prods,
      kas: { masuk, keluar, saldo: masuk - keluar },
    };
  });
}
