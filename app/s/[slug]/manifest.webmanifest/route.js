import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Manifest PWA PER-STORE: start_url & scope diarahkan ke /s/<slug> agar,
// saat pelanggan meng-install dari halaman toko tertentu, aplikasi yang
// terpasang membuka toko itu — bukan landing page.
export async function GET(_request, { params }) {
  const slug = params?.slug || "";
  let nama = "Kantin";
  try {
    const { data } = await supabaseAdmin().from("stores").select("nama").eq("slug", slug).maybeSingle();
    if (data?.nama) nama = data.nama;
  } catch {}

  const base = `/s/${slug}`;
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
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
