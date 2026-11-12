import { getBrandServer } from "@/lib/brandServer";
import { manifestIcons } from "@/lib/appIconsServer";

export const dynamic = "force-dynamic";

// Manifest PWA admin — terpisah dari PWA pembeli (scope /admin); ikon mengikuti
// logo aplikasi global (bila kosong → ikon admin bawaan).
export async function GET() {
  const brand = await getBrandServer();
  const manifest = {
    id: "/admin",
    name: `${brand.name} Admin`,
    short_name: `${brand.name} Admin`,
    description: "Panel admin kantin: transaksi, produk, inventory, jurnal, laporan.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#0F4575",
    icons: manifestIcons(brand.logo, "/icons/admin-icon-192.png", "/icons/admin-icon-512.png"),
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
