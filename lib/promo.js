"use client";
// Logika promo (diskon item & bundling) yang dipakai toko, keranjang, checkout, admin.
import { supabase } from "@/lib/supabaseClient";

// ---------- Template banner (desain dipilih admin, teks/warna bisa diubah) ----------
export const TEMPLATES = [
  { id: "navy", nama: "Navy", bg: "linear-gradient(135deg,#16397a 0%,#0f2a5c 55%,#0a1d42 100%)", text: "#ffffff", sub: "#b8c4dd", aksen: "#ff8a3d", deco: "circle" },
  { id: "oranye", nama: "Oranye", bg: "linear-gradient(135deg,#ff9447,#e8561a)", text: "#ffffff", sub: "#ffe3cf", aksen: "#0f2a5c", deco: "stripe" },
  { id: "hijau", nama: "Hijau", bg: "linear-gradient(135deg,#1f9d63,#0d5c37)", text: "#ffffff", sub: "#c9f2db", aksen: "#ffd23f", deco: "dots" },
  { id: "krem", nama: "Krem", bg: "linear-gradient(135deg,#fff7ee,#ffe8d2)", text: "#3b1f0b", sub: "#8a5a35", aksen: "#c2560f", deco: "circle" },
  { id: "ungu", nama: "Ungu", bg: "linear-gradient(135deg,#7b2ff7,#f107a3)", text: "#ffffff", sub: "#f7d6ff", aksen: "#ffd23f", deco: "dots" },
  { id: "kuning", nama: "Kuning", bg: "repeating-linear-gradient(45deg,#ffd23f 0 14px,#ffc300 14px 28px)", text: "#2a1a00", sub: "#5c4300", aksen: "#e8561a", deco: "stripe" },
];
export const AKSEN = ["#ff8a3d", "#e8561a", "#22c55e", "#ffd23f", "#3dd6f5", "#f107a3", "#0f2a5c", "#ffffff"];
export const tplOf = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

// ---------- Tanggal (lokal, YYYY-MM-DD) ----------
export const todayStr = () => new Date().toLocaleDateString("en-CA");
export function promoStatus(p, today = todayStr()) {
  if (!p.aktif) return "nonaktif";
  if (today < p.mulai) return "terjadwal";
  if (today > p.berakhir) return "berakhir";
  return "aktif";
}

// ---------- Harga ----------
export function discountedPrice(harga, p) {
  const h = Number(harga) || 0;
  const v = Number(p?.diskon_nilai) || 0;
  if (!p || v <= 0) return h;
  const off = p.diskon_tipe === "nominal" ? v : Math.round((h * Math.min(v, 100)) / 100);
  return Math.max(0, h - off);
}
export const pctOff = (normal, now) => (normal > 0 ? Math.round(((normal - now) / normal) * 100) : 0);

// Total harga normal paket dari daftar produk.
export function bundleNormal(p, prodMap) {
  return (p.items || []).reduce((s, it) => s + (prodMap[it.product_id]?.harga || 0) * (it.qty || 1), 0);
}

// Bagi harga paket ke tiap menu SECARA PROPORSIONAL (harga satuan bulat).
// Sisa pembulatan dibebankan ke komponen qty=1 bila ada agar total = harga paket.
export function allocateBundle(hargaPaket, comps) {
  const normal = comps.reduce((s, c) => s + c.harga_normal * c.qty, 0) || 1;
  const out = comps.map((c) => ({ ...c, harga: Math.floor((hargaPaket * c.harga_normal) / normal) }));
  let rem = hargaPaket - out.reduce((s, c) => s + c.harga * c.qty, 0);
  const single = out.find((c) => c.qty === 1);
  if (rem > 0 && single) { single.harga += rem; rem = 0; }
  if (rem > 0) {
    const big = out.reduce((a, b) => (a.harga_normal * a.qty >= b.harga_normal * b.qty ? a : b));
    big.harga += Math.floor(rem / big.qty);
  }
  return out;
}

// ---------- Muat promo aktif untuk toko pembeli ----------
// Return: { list: promo aktif (urut), diskonByProduct: {product_id: promo}, usage: {promo_id: n} }
export async function loadActivePromos(storeId) {
  const today = todayStr();
  const { data, error } = await supabase.from("promos").select("*")
    .eq("store_id", storeId).eq("aktif", true).lte("mulai", today).gte("berakhir", today)
    .order("urutan", { ascending: true }).order("created_at", { ascending: false });
  if (error || !data) return { list: [], diskonByProduct: {}, usage: {} };

  const usage = {};
  await Promise.all(data.filter((p) => p.kuota > 0).map(async (p) => {
    const { data: n } = await supabase.rpc("promo_usage", { p_promo: p.id });
    usage[p.id] = Number(n) || 0;
  }));
  const list = data.filter((p) => !(p.kuota > 0) || (usage[p.id] || 0) < p.kuota);

  const diskonByProduct = {};
  list.filter((p) => p.jenis === "diskon").forEach((p) => {
    (p.items || []).forEach((it) => { if (!diskonByProduct[it.product_id]) diskonByProduct[it.product_id] = p; });
  });
  return { list, diskonByProduct, usage };
}

export function sisaKuota(p, usage) {
  if (!(p.kuota > 0)) return null;
  return Math.max(0, p.kuota - (usage?.[p.id] || 0));
}
