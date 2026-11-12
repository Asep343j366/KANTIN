import { ImageResponse } from "next/og";

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

  const inner = Math.round(size * 0.72); // zona aman ikon maskable (±80%)
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(150deg,#16397a 0%,#0f2a5c 55%,#0a1d42 100%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={inner} height={inner} style={{ objectFit: "contain" }} alt="" />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } }
  );
}
