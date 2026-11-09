import { createClient } from "@supabase/supabase-js";
import { DEFAULT_BRAND, normalizeBrand } from "@/lib/brandDefaults";

// Versi server (untuk metadata/judul tab). Cache 5 menit agar halaman tetap
// statis; selalu jatuh ke default bila env/kolom belum ada.
export async function getBrandServer() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return DEFAULT_BRAND;
    const client = createClient(url, key, {
      auth: { persistSession: false },
      global: { fetch: (u, o) => fetch(u, { ...o, next: { revalidate: 300 } }) },
    });
    const { data } = await client.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    return normalizeBrand(data);
  } catch {
    return DEFAULT_BRAND;
  }
}
