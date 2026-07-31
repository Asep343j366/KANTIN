"use client";
import { usePathname } from "next/navigation";

// Ambil slug store dari URL storefront ( /s/<slug>/... ).
export function slugFromPath(pathname) {
  const m = (pathname || "").match(/\/s\/([^/]+)/);
  return m ? m[1] : "";
}

export function useSlug() {
  return slugFromPath(usePathname());
}

// Bangun path storefront untuk slug tertentu. storePath("j366-nvd", "/cart") => "/s/j366-nvd/cart"
export function storePath(slug, sub = "") {
  return `/s/${slug}${sub}`;
}
