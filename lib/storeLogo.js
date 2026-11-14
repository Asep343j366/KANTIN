"use client";
// SATU logo aplikasi untuk semua site: platform_settings.app_logo_url (lewat
// useBrand). Kosong / migrasi v26 belum jalan → logo bawaan.
import { useBrand } from "@/lib/brand";
import { thumbUrl } from "@/lib/thumb";

export const DEFAULT_LOGO = "/icons/icon-512.png";

export function logoOf(brand) {
  return brand?.logo ? thumbUrl(brand.logo) : DEFAULT_LOGO; // versi 256px (hemat egress)
}

export function useAppLogo() {
  return logoOf(useBrand());
}
