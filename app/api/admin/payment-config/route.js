import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Pemanggil harus admin login + owner store. Kembalikan store_id & role.
async function requireOwner(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: mem } = await admin()
    .from("store_members")
    .select("store_id, role")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  if (!mem?.store_id) return null;
  return { user: data.user, store_id: mem.store_id, role: mem.role };
}

export async function GET(request) {
  const me = await requireOwner(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await admin()
    .from("store_payment_config")
    .select("*")
    .eq("store_id", me.store_id)
    .maybeSingle();

  return Response.json({ config: data || { store_id: me.store_id, mode: "manual", active: true } });
}

export async function POST(request) {
  const me = await requireOwner(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (me.role !== "owner") return Response.json({ error: "Hanya owner yang boleh mengubah pembayaran." }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const mode = b.mode === "casaku" ? "casaku" : "manual";

  if (mode === "casaku") {
    if (!b.license_key || !b.qr_id || !b.webhook_secret) {
      return Response.json({ error: "Mode Casaku butuh License Key, QR ID, dan Webhook Secret." }, { status: 400 });
    }
  }

  const payload = {
    store_id: me.store_id,
    mode,
    license_key: b.license_key || null,
    qr_id: b.qr_id || null,
    webhook_secret: b.webhook_secret || null,
    package_ids: b.package_ids || "id.dana",
    expire_minutes: parseInt(b.expire_minutes) || 1440,
    base_url: b.base_url || "https://api.casaku.id",
    active: b.active !== false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin()
    .from("store_payment_config")
    .upsert(payload, { onConflict: "store_id" });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
