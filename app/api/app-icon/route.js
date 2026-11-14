import { ImageResponse } from "next/og";
import { thumbUrl } from "@/lib/thumb";

export const runtime = "edge";

// Ikon PNG dari logo aplikasi (platform_settings.app_logo_url) di atas latar
// navy DKantin — untuk ikon yang TIDAK boleh transparan: apple-touch-icon (iOS
// memberi latar hitam) & maskable (Android memotong lingkaran/squircle).
// ?size=32..1024 (default 512). Logo belum diatur → ikon bawaan.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const size = Math.min(1024, Math.max(32, parseInt(searchParams.get("size")) || 512));

  let logo = null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const r = await fetch(`${url}/rest/v1/platform_settings?id=eq.1&select=app_logo_url`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    const rows = await r.json();
    logo = Array.isArray(rows) ? rows[0]?.app_logo_url || null : null;
  } catch {}
  if (!logo) return Response.redirect(`${origin}/icons/icon-512.png`, 302);

  // HEMAT EGRESS: dulu tiap render menarik logo penuh (±250KB) dari Supabase
  // tiap jam per ukuran ikon. Kini: ikon kecil pakai thumbnail 256px, gambar
  // ditarik lewat data-cache (1 hari) lalu disisipkan sbg data URL.
  let src = logo;
  try {
    const pick = size <= 256 ? thumbUrl(logo) : logo;
    let r = await fetch(pick, { next: { revalidate: 86400 } });
    if (!r.ok && pick !== logo) r = await fetch(logo, { next: { revalidate: 86400 } });
    if (r.ok) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      src = `data:${r.headers.get("content-type") || "image/png"};base64,${btoa(bin)}`;
    }
  } catch {}

  // bg=0 → latar transparan, logo penuh (ikon "any" berukuran PERSIS, satu origin);
  // default → latar navy + zona aman (maskable / apple-touch-icon).
  const transparent = searchParams.get("bg") === "0";
  const inner = Math.round(size * (transparent ? 1 : 0.72));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: transparent ? "transparent" : "linear-gradient(150deg,#16397a 0%,#0f2a5c 55%,#0a1d42 100%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={inner} height={inner} style={{ objectFit: "contain" }} alt="" />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": searchParams.get("v")
      // ?v=<nama file logo> berubah saat logo diganti → aman di-cache lama.
      ? "public, max-age=86400, s-maxage=31536000, immutable"
      : "public, max-age=3600, s-maxage=86400" } }
  );
}
