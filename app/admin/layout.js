import AdminGuard from "@/components/AdminGuard";
import { getBrandServer } from "@/lib/brandServer";
import { metaIcons } from "@/lib/appIconsServer";

// PWA admin terpisah dari PWA pembeli: manifest, nama, ikon, & scope berbeda
// sehingga keduanya bisa di-install berdampingan di satu HP tanpa bentrok.
// Judul memakai nama aplikasi dari platform_settings (default DKantin).
export async function generateMetadata() {
  const { name, logo } = await getBrandServer();
  return {
    title: `Admin ${name}`,
    description: "Panel admin kantin: transaksi, produk, inventory, jurnal, laporan.",
    manifest: "/admin.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: `Admin ${name}` },
    icons: metaIcons(logo, { icon: "/icons/admin-icon-192.png", favicon: "/icons/admin-icon-192.png", apple: "/icons/admin-apple-touch.png" }),
  };
}

export const viewport = {
  themeColor: "#0F4575",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function AdminLayout({ children }) {
  return <AdminGuard>{children}</AdminGuard>;
}
