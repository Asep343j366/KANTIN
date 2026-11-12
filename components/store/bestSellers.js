"use client";
// "Terlaris minggu ini": jumlah qty terjual per produk dari order SELESAI
// 7 hari terakhir. Di-cache 10 menit per store (sessionStorage) agar hemat egress.
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/sbPaginate";

const TTL = 10 * 60 * 1000;

export async function loadBestSellers(storeId) {
  const key = `zk_best_${storeId}`;
  try {
    const hit = JSON.parse(sessionStorage.getItem(key) || "null");
    if (hit && Date.now() - hit.t < TTL) return hit.map;
  } catch {}

  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const orders = await fetchAllRows(() =>
    supabase.from("orders").select("id").eq("store_id", storeId).eq("status", "selesai")
      .gte("created_at", since).order("id", { ascending: true })
  );
  const ids = orders.map((o) => o.id);
  const map = {};
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from("order_items").select("product_id,jumlah").in("order_id", ids.slice(i, i + 150));
    (data || []).forEach((r) => { if (r.product_id) map[r.product_id] = (map[r.product_id] || 0) + (r.jumlah || 0); });
  }
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), map })); } catch {}
  return map;
}
