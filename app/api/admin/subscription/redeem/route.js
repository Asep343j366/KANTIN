import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

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
  return { store_id: mem.store_id, role: mem.role };
}

export async function POST(request) {
  const me = await requireOwner(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (me.role !== "owner") return Response.json({ error: "Hanya owner yang boleh menukarkan kode." }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const code = (b.code || "").trim().toUpperCase();
  if (!code) return Response.json({ error: "Kode wajib diisi." }, { status: 400 });

  const { data, error } = await admin().rpc("redeem_subscription_token", {
    p_code: code,
    p_store: me.store_id,
  });
  if (error) return Response.json({ error: error.message.replace(/^.*?:\s*/, "") || "Gagal menukarkan kode." }, { status: 400 });

  return Response.json({ ok: true, langganan_until: data });
}
