"use client";
// Logo per kantin (settings.logo_url) dengan cadangan logo bawaan.
// Di-cache per store di sessionStorage; event "logo:update" memicu muat ulang.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const DEFAULT_LOGO = "/icons/icon-512.png";

export function logoOf(settings) {
  return settings?.logo_url || DEFAULT_LOGO;
}

export function useStoreLogo(storeId) {
  const [url, setUrl] = useState(DEFAULT_LOGO);
  useEffect(() => {
    if (!storeId) return;
    const key = `zk_logo_${storeId}`;
    const load = async (force) => {
      if (!force) {
        try { const hit = sessionStorage.getItem(key); if (hit) { setUrl(hit); return; } } catch {}
      }
      const { data, error } = await supabase.from("settings").select("logo_url").eq("store_id", storeId).maybeSingle();
      const u = (!error && data?.logo_url) || DEFAULT_LOGO;
      setUrl(u);
      try { sessionStorage.setItem(key, u); } catch {}
    };
    load(false);
    const on = () => load(true);
    window.addEventListener("logo:update", on);
    return () => window.removeEventListener("logo:update", on);
  }, [storeId]);
  return url;
}
