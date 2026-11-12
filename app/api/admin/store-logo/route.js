import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Hanya admin platform (anggota store is_platform_admin = J366).
async function requirePlatformAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: mems } = await admin().from("store_members").select("stores(is_platform_admin)").eq("user_id", data.user.id);
  return (mems || []).some((m) => m.stores?.is_platform_admin) ? { user: data.user } : null;
}

// Atur logo kantin sebuah store. Body: { store_id, logo_url } (null = logo bawaan).
// logo_url WAJIB file logo di bucket publik 'qris' milik proyek ini.
export async function POST(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "Hanya admin platform yang boleh mengatur logo." }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const store_id = typeof b.store_id === "string" ? b.store_id : "";
  const logo = b.logo_url ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(store_id)) return Response.json({ error: "store_id tidak valid" }, { status: 400 });
  const prefix = `${url}/storage/v1/object/public/qris/logo-`;
  if (logo !== null && (typeof logo !== "string" || !logo.startsWith(prefix) || logo.length > 500)) {
    return Response.json({ error: "URL logo tidak valid" }, { status: 400 });
  }

  const db = admin();
  const { data: st } = await db.from("stores").select("id, nama").eq("id", store_id).maybeSingle();
  if (!st) return Response.json({ error: "Store tidak ditemukan" }, { status: 404 });

  const { data: row } = await db.from("settings").select("id").eq("store_id", store_id).maybeSingle();
  const { error } = row
    ? await db.from("settings").update({ logo_url: logo }).eq("store_id", store_id)
    : await db.from("settings").insert({ store_id, nama_kantin: st.nama, logo_url: logo });
  if (error) return Response.json({ error: "Gagal menyimpan logo" }, { status: 500 });
  return Response.json({ ok: true });
}
