import AdminGuard from "@/components/AdminGuard";

// PWA admin terpisah dari PWA pembeli: manifest, nama, ikon, & scope berbeda
// sehingga keduanya bisa di-install berdampingan di satu HP tanpa bentrok.
export const metadata = {
  title: "Kantin Admin BMS",
  description: "Panel admin kantin: transaksi, produk, inventory, jurnal, laporan.",
  manifest: "/admin-manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kantin Admin" },
  icons: {
    icon: [{ url: "/icons/admin-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/admin-apple-touch.png", sizes: "180x180" }],
  },
};

export const viewport = {
  themeColor: "#0F4575",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function AdminLayout({ children }) {
  return <AdminGuard>{children}</AdminGuard>;
}
