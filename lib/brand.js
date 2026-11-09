"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_BRAND, normalizeBrand } from "@/lib/brandDefaults";

export { DEFAULT_BRAND };

// Nama aplikasi (mis. "DKantin" / "Digital Kantin") dari platform_settings
// (public-read). Di-cache per muat halaman; select("*") supaya tetap jalan
// walau kolom app_name belum ada (migrasi belum dijalankan) → pakai default.
let _p = null;
export function loadBrand(force = false) {
  if (!_p || force) {
    _p = Promise.resolve(
      supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle()
    )
      .then(({ data }) => normalizeBrand(data))
      .catch(() => DEFAULT_BRAND);
  }
  return _p;
}

// Panggil setelah nama aplikasi diubah agar semua komponen ikut ter-update.
export function refreshBrand() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("brand:update"));
}

export function useBrand() {
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  useEffect(() => {
    let alive = true;
    loadBrand().then((b) => { if (alive) setBrand(b); });
    const onUpd = () => loadBrand(true).then((b) => { if (alive) setBrand(b); });
    window.addEventListener("brand:update", onUpd);
    return () => { alive = false; window.removeEventListener("brand:update", onUpd); };
  }, []);
  return brand;
}
