import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function requirePlatformAdmin(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  // Cek SEMUA keanggotaan: platform-admin bila ADA membership ke store platform.
  // (limit(1) lama bisa salah pilih untuk user J366 dgn >1 keanggotaan → 401.)
  const { data: mems } = await admin()
    .from("store_members")
    .select("stores(is_platform_admin)")
    .eq("user_id", data.user.id);
  const isPlatform = (mems || []).some((m) => m.stores?.is_platform_admin);
  if (!isPlatform) return null;
  return { user: data.user };
}

export async function GET(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await admin().from("platform_settings").select("*").eq("id", 1).maybeSingle();
  return Response.json({ settings: data || { id: 1 } });
}

export async function POST(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const harga = parseInt(String(b.langganan_harga).replace(/[^0-9]/g, ""));
  const durasi = parseInt(b.langganan_durasi_hari);
  const payload = {
    id: 1,
    wa_number: (b.wa_number || "").replace(/[^0-9]/g, "") || null,
    harga_label: b.harga_label || null,
    harga_note: b.harga_note || null,
    langganan_harga: Number.isFinite(harga) && harga > 0 ? harga : null,
    langganan_durasi_hari: Number.isFinite(durasi) && durasi > 0 ? durasi : 120,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin().from("platform_settings").upsert(payload, { onConflict: "id" });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
