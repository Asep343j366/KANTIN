"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Root: sementara alihkan ke storefront store utama (platform-admin / J366)
// agar tautan & QR lama tetap berfungsi. Fase 6 akan mengganti ini dengan
// halaman landing yang benar (pilih store / marketing).
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    supabase
      .from("stores")
      .select("slug")
      .eq("is_platform_admin", true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data?.slug) router.replace(`/s/${data.slug}`); });
  }, [router]);

  return <div className="grid min-h-screen place-items-center text-ink-soft">Mengalihkan…</div>;
}
