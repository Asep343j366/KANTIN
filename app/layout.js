import "./globals.css";
import BottomNav from "@/components/BottomNav";
import PWARegister from "@/components/PWARegister";
import { getBrandServer } from "@/lib/brandServer";
import { metaIcons } from "@/lib/appIconsServer";

// Judul default memakai nama aplikasi dari platform_settings (default DKantin).
export async function generateMetadata() {
  const { name, tagline, logo } = await getBrandServer();
  return {
    title: `${name} — ${tagline}`,
    description: "Pesan makanan & minuman kantin, bayar QRIS, ambil di tempat.",
    manifest: "/app.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: name },
    // Favicon tab & ikon iPhone mengikuti logo aplikasi global (Kelola Store).
    icons: metaIcons(logo),
  };
}

export const viewport = {
  themeColor: "#0F4575",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PWARegister />
        <div className="min-h-screen pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
