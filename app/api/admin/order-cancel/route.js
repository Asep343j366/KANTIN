import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function requireAuth(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: mem } = await admin()
    .from("store_members")
    .select("store_id")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  if (!mem?.store_id) return null;
  return { user: data.user, store_id: mem.store_id };
}

// Batalkan pesanan yang menggantung (belum lunas) — mis. transaksi ganda atau
// yang sudah dicatat manual di jurnal. Soft-cancel: data tetap ada, hanya
// ditandai dibatalkan agar hilang dari daftar. Order yang SUDAH lunas ditolak
// (jangan batalkan yang sudah kurangi stok / tercatat sebagai omzet).
export async function POST(request) {
  const me = await requireAuth(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { order_id } = await request.json().catch(() => ({}));
  if (!order_id) return Response.json({ error: "order_id wajib" }, { status: 400 });

  const db = admin();

  const { data: order, error } = await db
    .from("orders")
    .select("id, payment_status, store_id")
    .eq("id", order_id)
    .single();
  if (error || !order) return Response.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.store_id !== me.store_id)
    return Response.json({ error: "Order bukan milik store Anda." }, { status: 403 });
  if (order.payment_status === "paid")
    return Response.json({ error: "Order sudah lunas, tidak bisa dibatalkan." }, { status: 400 });

  // Kembalikan stok + tandai dibatalkan (idempoten, atomik di DB).
  // Stok sudah dikurangi trigger saat order dibuat, jadi harus di-restore.
  const { error: rpcErr } = await db.rpc("cancel_order_restock", { p_order_id: order_id });
  if (rpcErr) return Response.json({ error: rpcErr.message }, { status: 500 });

  return Response.json({ ok: true });
}
