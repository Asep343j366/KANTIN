import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Pemanggil harus platform-admin (anggota store is_platform_admin, mis. J366).
async function requirePlatformAdmin(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: mems } = await admin()
    .from("store_members")
    .select("store_id, stores(is_platform_admin)")
    .eq("user_id", data.user.id);
  const isPlatform = (mems || []).some((m) => m.stores?.is_platform_admin);
  if (!isPlatform) return null;
  return { user: data.user };
}

// Kode acak tak mudah ditebak: KTN-XXXX-XXXX (base32 Crockford tanpa char ambigu)
function genCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  const pick = (n) => Array.from({ length: n }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  return `KTN-${pick(4)}-${pick(4)}`;
}

export async function GET(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await admin()
    .from("subscription_tokens")
    .select("code, durasi_hari, status, redeemed_by_store, redeemed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ tokens: data || [] });
}

export async function POST(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const durasi = parseInt(b.durasi_hari);
  const jumlah = Math.min(Math.max(parseInt(b.jumlah) || 1, 1), 50);
  if (!durasi || durasi < 1) return Response.json({ error: "Durasi hari tidak valid." }, { status: 400 });

  const rows = Array.from({ length: jumlah }, () => ({ code: genCode(), durasi_hari: durasi }));
  const { data, error } = await admin()
    .from("subscription_tokens")
    .insert(rows)
    .select("code, durasi_hari");
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ created: data || [] });
}
