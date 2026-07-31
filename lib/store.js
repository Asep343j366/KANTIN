"use client";
import { supabase } from "@/lib/supabaseClient";

// Resolusi store milik user yang sedang login (1 user = 1 store).
// Mengembalikan { store_id, role, is_platform_admin, store } atau null bila belum jadi anggota.
// Hasil di-cache di memori agar tak query berulang tiap halaman.
let _cache = null;
let _cacheUser = null;

export async function getMyStore({ force = false } = {}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id || null;
  if (!uid) { _cache = null; _cacheUser = null; return null; }
  if (!force && _cache && _cacheUser === uid) return _cache;

  const { data, error } = await supabase
    .from("store_members")
    .select("role, store:stores(id, kode_site, slug, nama, status, is_platform_admin, langganan_until)")
    .eq("user_id", uid)
    .limit(1)
    .maybeSingle();

  if (error || !data) { _cache = null; _cacheUser = uid; return null; }

  _cache = {
    store_id: data.store?.id || null,
    role: data.role,
    is_platform_admin: !!data.store?.is_platform_admin,
    store: data.store,
  };
  _cacheUser = uid;
  return _cache;
}

// Panggil saat logout / ganti user agar cache tak bocor antar akun.
export function clearStoreCache() {
  _cache = null;
  _cacheUser = null;
}

// Resolusi store publik berdasarkan slug (dipakai storefront pelanggan, tanpa login).
export async function getStoreBySlug(slug) {
  if (!slug) return null;
  const { data } = await supabase
    .from("stores")
    .select("id, kode_site, slug, nama, status, is_platform_admin")
    .eq("slug", slug)
    .maybeSingle();
  return data || null;
}
