import { getBrandServer } from "@/lib/brandServer";
import { manifestIcons } from "@/lib/appIconsServer";

export const dynamic = "force-dynamic";

// Manifest PWA pembeli (umum) — ikon mengikuti logo aplikasi global.
export async function GET() {
  const brand = await getBrandServer();
  const manifest = {
    id: "/?app=pembeli",
    name: `${brand.name} — ${brand.tagline}`,
    short_name: brand.name,
    description: "Pesan makanan & minuman kantin, bayar QRIS, ambil di tempat.",
    start_url: "/?app=pembeli",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#0F4575",
    icons: manifestIcons(brand.logo),
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
