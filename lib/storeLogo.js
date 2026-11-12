"use client";
// SATU logo aplikasi untuk semua site: platform_settings.app_logo_url (lewat
// useBrand). Kosong / migrasi v26 belum jalan → logo bawaan.
import { useBrand } from "@/lib/brand";

export const DEFAULT_LOGO = "/icons/icon-512.png";

export function logoOf(brand) {
  return brand?.logo || DEFAULT_LOGO;
}

export function useAppLogo() {
  return logoOf(useBrand());
}
