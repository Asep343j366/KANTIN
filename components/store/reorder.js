"use client";
// "Pesan lagi": masukkan ulang isi sebuah pesanan ke keranjang memakai data
// produk TERKINI (harga & stok sekarang). Menu yang habis/tidak dijual dilewati.
import { supabase } from "@/lib/supabaseClient";
import { addToCart } from "@/lib/cart";

export async function reorder(orderId, preloadedItems) {
  let items = preloadedItems;
  if (!items) {
    const { data } = await supabase.from("order_items").select("product_id,jumlah").eq("order_id", orderId);
    items = data || [];
  }
  const ids = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  if (!ids.length) return { added: 0, skipped: items.length };
  const { data: prods } = await supabase.from("products").select("*").in("id", ids);
  const map = {};
  (prods || []).forEach((p) => { map[p.id] = p; });
  let added = 0, skipped = 0;
  for (const it of items) {
    const p = map[it.product_id];
    if (!p || !p.tersedia || p.stok <= 0) { skipped++; continue; }
    addToCart(p, Math.min(it.jumlah || 1, p.stok));
    added++;
  }
  return { added, skipped };
}
