// Ikon PWA/web dari logo aplikasi global (server). Logo kosong → ikon bawaan.
//  - "any"      : PNG logo apa adanya (boleh transparan)
//  - "maskable" : /api/app-icon (logo di atas latar navy, zona aman)
export function manifestIcons(logo, fallback192 = "/icons/icon-192.png", fallback512 = "/icons/icon-512.png") {
  if (!logo) {
    return [
      { src: fallback192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: fallback512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: fallback192, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: fallback512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ];
  }
  return [
    { src: logo, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: logo, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/api/app-icon?size=192", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/api/app-icon?size=512", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
}

// Ikon untuk metadata halaman (favicon tab browser + apple-touch-icon).
export function metaIcons(logo, fallback = { icon: "/icons/icon-192.png", favicon: "/icons/favicon-32.png", apple: "/icons/apple-touch-icon.png" }) {
  if (!logo) {
    return {
      icon: [
        { url: fallback.favicon, sizes: "32x32", type: "image/png" },
        { url: fallback.icon, sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: fallback.apple, sizes: "180x180" }],
    };
  }
  return {
    icon: [{ url: logo, type: "image/png" }],
    apple: [{ url: "/api/app-icon?size=180", sizes: "180x180" }],
  };
}
