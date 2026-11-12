import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Manifest PWA PER-STORE: start_url & scope diarahkan ke /s/<slug> agar,
// saat pelanggan meng-install dari halaman toko tertentu, aplikasi yang
// terpasang membuka toko itu — bukan landing page.
// Ikon: logo aplikasi global (PNG 512 persegi) bila diatur; else bawaan.
export async function GET(_request, { params }) {
  const slug = params?.slug || "";
  let nama = "Kantin";
  let logo = null;
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("stores").select("id, nama").eq("slug", slug).maybeSingle();
    if (data?.nama) nama = data.nama;
    // Satu logo untuk semua site (platform_settings.app_logo_url, migration v26).
    const { data: ps, error } = await db.from("platform_settings").select("app_logo_url").eq("id", 1).maybeSingle();
    if (!error && ps?.app_logo_url) logo = ps.app_logo_url;
  } catch {}

  const base = `/s/${slug}`;
  const icons = logo
    ? [
        { src: logo, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: logo, sizes: "192x192", type: "image/png", purpose: "any" },
      ]
    : [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];

  const manifest = {
    id: base,
    name: nama,
    short_name: nama.length > 18 ? nama.slice(0, 18) : nama,
    description: `Pesan makanan & minuman di ${nama}, bayar QRIS.`,
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#0F4575",
    icons,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
