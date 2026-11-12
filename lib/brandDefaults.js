// Nama & gaya logo aplikasi default (dipakai bila platform_settings belum diisi /
// gagal dibaca). Diubah lewat Kelola Store → Pengaturan Landing (platform-admin).
export const DEFAULT_STYLE = {
  accentCount: 1,          // jumlah huruf depan yang diberi aksen (0 = tanpa aksen)
  accentStyle: "plain",    // plain | box | circle | underline
  accentColor: "#F26F21",  // warna aksen
  accentTextColor: "#FFFFFF", // warna huruf di dalam kotak/bulatan
  accentScale: 1,          // ukuran huruf aksen relatif (0.8–2)
  textColor: "",           // "" = ikuti warna latar/konteks
  weight: 800,             // 500 | 600 | 700 | 800
  tracking: -0.02,         // jarak huruf (em)
  uppercase: false,
  showTagline: true,
};

export const DEFAULT_BRAND = { name: "DKantin", tagline: "Digital Kantin", style: DEFAULT_STYLE, logo: null };

const HEX = /^#[0-9a-fA-F]{6}$/;
const num = (v, min, max, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

// Saring isian gaya agar nilai aneh tak bisa merusak tampilan.
export function sanitizeStyle(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const d = DEFAULT_STYLE;
  return {
    accentCount: Math.round(num(o.accentCount, 0, 3, d.accentCount)),
    accentStyle: ["plain", "box", "circle", "underline"].includes(o.accentStyle) ? o.accentStyle : d.accentStyle,
    accentColor: HEX.test(o.accentColor) ? o.accentColor : d.accentColor,
    accentTextColor: HEX.test(o.accentTextColor) ? o.accentTextColor : d.accentTextColor,
    accentScale: Math.round(num(o.accentScale, 0.8, 2, d.accentScale) * 100) / 100,
    textColor: HEX.test(o.textColor) ? o.textColor : "",
    weight: [500, 600, 700, 800].includes(Number(o.weight)) ? Number(o.weight) : d.weight,
    tracking: Math.round(num(o.tracking, -0.08, 0.3, d.tracking) * 100) / 100,
    uppercase: o.uppercase === true,
    showTagline: o.showTagline !== false,
  };
}

export function normalizeBrand(row) {
  const name = String(row?.app_name || "").trim() || DEFAULT_BRAND.name;
  const tagline = String(row?.app_tagline || "").trim() || DEFAULT_BRAND.tagline;
  const logo = typeof row?.app_logo_url === "string" && row.app_logo_url ? row.app_logo_url : null;
  return { name, tagline, style: sanitizeStyle(row?.app_brand_style), logo };
}
