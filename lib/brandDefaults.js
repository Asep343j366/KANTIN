// Nama aplikasi default (dipakai bila platform_settings belum diisi / gagal dibaca).
// Diubah lewat Kelola Store → Pengaturan Landing (platform-admin).
export const DEFAULT_BRAND = { name: "DKantin", tagline: "Digital Kantin" };

export function normalizeBrand(row) {
  const name = String(row?.app_name || "").trim() || DEFAULT_BRAND.name;
  const tagline = String(row?.app_tagline || "").trim() || DEFAULT_BRAND.tagline;
  return { name, tagline };
}
