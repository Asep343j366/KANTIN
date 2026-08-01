import StoreProvider from "./StoreProvider";

// Manifest PWA per-store: install dari /s/<slug> → aplikasi buka toko itu, bukan landing.
export async function generateMetadata({ params }) {
  return {
    manifest: `/s/${params.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Kantin" },
  };
}

export default function StorefrontLayout({ children }) {
  return <StoreProvider>{children}</StoreProvider>;
}
