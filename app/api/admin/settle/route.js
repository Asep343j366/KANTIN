import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Pastikan pemanggil adalah admin yang sudah login (punya sesi Supabase valid).
async function requireAuth(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// Settle manual: tandai order lunas + kurangi stok, untuk kasus pembayaran
// yang benar-benar masuk tapi gagal terbaca otomatis oleh Casaku.
// Memakai fungsi idempoten mark_order_paid (aman dari dobel-kurang stok).
export async function POST(request) {
  const me = await requireAuth(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { order_id } = await request.json().catch(() => ({}));
  if (!order_id) return Response.json({ error: "order_id wajib" }, { status: 400 });

  const db = admin();

  const { data: order, error } = await db
    .from("orders")
    .select("id, payment_ref, amount_charged, total, payment_status")
    .eq("id", order_id)
    .single();
  if (error || !order) return Response.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.payment_status === "paid")
    return Response.json({ error: "Order sudah lunas." }, { status: 400 });

  // Order nggantung selalu punya payment_ref (transactionId Casaku). Bila entah
  // kenapa kosong, beri ref manual agar fungsi settle tetap bisa mencocokkannya.
  let ref = order.payment_ref;
  if (!ref) {
    ref = `MANUAL-${order.id}`;
    await db.from("orders").update({ payment_ref: ref }).eq("id", order.id);
  }

  const amount = order.amount_charged ?? order.total ?? null;

  const { data: settled, error: rpcErr } = await db.rpc("mark_order_paid", {
    p_payment_ref: ref,
    p_amount: amount,
  });
  if (rpcErr) return Response.json({ error: rpcErr.message }, { status: 500 });

  return Response.json({ ok: true, settled: settled === true });
}
