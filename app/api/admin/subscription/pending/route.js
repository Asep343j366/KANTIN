import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { finalizeSubscriptionOrder } from "@/lib/subscriptionFinalize";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function requirePlatformAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const db = supabaseAdmin();
  const { data: mems } = await db
    .from("store_members")
    .select("stores(is_platform_admin)")
    .eq("user_id", data.user.id);
  const isPlatform = (mems || []).some((m) => m.stores?.is_platform_admin);
  if (!isPlatform) return null;
  return { user: data.user };
}

// Daftar pembayaran langganan yang menunggu verifikasi manual (Casaku gagal baca).
export async function GET(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: orders } = await db
    .from("subscription_orders")
    .select("id, store_id, amount, amount_charged, durasi_hari, status, payment_ref, created_at, stores(nama, kode_site)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  return Response.json({ orders: orders || [] });
}

// Verifikasi manual: terbitkan voucher + AUTO-perpanjang + catat jurnal J366.
export async function POST(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const id = b.order_id;
  const action = b.action || "settle";
  if (!id) return Response.json({ error: "order_id wajib." }, { status: 400 });

  const db = supabaseAdmin();

  if (action === "cancel") {
    const { error } = await db.from("subscription_orders").update({ status: "cancel" }).eq("id", id).neq("status", "paid");
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  const fin = await finalizeSubscriptionOrder(db, id);
  if (!fin.ok) return Response.json({ error: "Gagal memproses pesanan." }, { status: 400 });
  return Response.json({ ok: true, token_code: fin.token_code });
}
