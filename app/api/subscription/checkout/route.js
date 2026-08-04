import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getPaymentConfig } from "@/lib/paymentConfig";
import { generateQris, checkStatus } from "@/lib/casaku";
import { finalizeSubscriptionOrder } from "@/lib/subscriptionFinalize";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Autentikasi owner store pemanggil. 1 user = 1 store.
async function requireOwner(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const db = supabaseAdmin();
  const { data: mem } = await db
    .from("store_members")
    .select("store_id, role, stores(id, is_platform_admin)")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: true });
  const own = (mem || []).find((m) => !m.stores?.is_platform_admin) || (mem || [])[0];
  if (!own?.store_id) return null;
  return { store_id: own.store_id, role: own.role, is_platform_admin: !!own.stores?.is_platform_admin };
}

// Ambil harga & durasi voucher + config Casaku milik J366 (akun penerima dana).
async function platformContext(db) {
  const { data: ps } = await db.from("platform_settings").select("langganan_harga, langganan_durasi_hari").eq("id", 1).maybeSingle();
  const { data: plat } = await db.from("stores").select("id").eq("is_platform_admin", true).limit(1).maybeSingle();
  return {
    harga: parseInt(ps?.langganan_harga) || 0,
    durasi: parseInt(ps?.langganan_durasi_hari) || 120,
    platformStoreId: plat?.id || null,
  };
}

// --- Buat pesanan langganan + QRIS dinamis (ditagih ke akun QRIS J366) ---
export async function POST(request) {
  const me = await requireOwner(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (me.is_platform_admin) return Response.json({ error: "Store platform tidak perlu berlangganan." }, { status: 400 });

  const db = supabaseAdmin();
  const { harga, durasi, platformStoreId } = await platformContext(db);
  if (harga < 1) return Response.json({ error: "Harga langganan belum diatur oleh admin. Silakan hubungi admin." }, { status: 400 });
  if (!platformStoreId) return Response.json({ error: "Akun platform tidak ditemukan." }, { status: 500 });

  // Cegah pesanan pending menumpuk: pakai ulang yang masih pending bila ada.
  const { data: existing } = await db
    .from("subscription_orders")
    .select("id, payment_ref, amount_charged, status")
    .eq("store_id", me.store_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Config Casaku J366
  const cfg = await getPaymentConfig(platformStoreId);
  if (cfg.mode !== "casaku" || !cfg.casaku?.licenseKey || !cfg.casaku?.qrId) {
    return Response.json({ error: "Pembayaran otomatis belum dikonfigurasi admin." }, { status: 400 });
  }

  // Buat baris pesanan (atau pakai yang pending)
  let orderId = existing?.id;
  if (!orderId) {
    const { data: row, error } = await db
      .from("subscription_orders")
      .insert({ store_id: me.store_id, amount: harga, durasi_hari: durasi })
      .select("id")
      .single();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    orderId = row.id;
  }

  try {
    const resp = await generateQris(cfg.casaku, { amount: harga, prefix: "SUB" });
    const d = resp?.data || resp;
    const txnId = d?.transactionId;
    const qr = d?.qr_string;
    const totalAmount = d?.totalAmount ?? harga;
    if (!txnId || !qr) throw new Error("Respons Casaku tidak lengkap.");

    await db.from("subscription_orders")
      .update({ payment_ref: txnId, amount_charged: totalAmount })
      .eq("id", orderId);

    return Response.json({
      id: orderId,
      qr_string: qr,
      transaction_id: txnId,
      amount: totalAmount,
      base_amount: harga,
      durasi_hari: durasi,
      expired_at: d?.expiredAt || null,
    });
  } catch (e) {
    return Response.json({ error: e.message || "Gagal membuat transaksi." }, { status: 502 });
  }
}

// --- Poll status (?id=) ATAU daftar pesanan langganan store (tanpa id) ---
export async function GET(request) {
  const me = await requireOwner(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const id = new URL(request.url).searchParams.get("id");

  // Daftar riwayat pesanan langganan store ini
  if (!id) {
    const { data } = await db
      .from("subscription_orders")
      .select("id, amount, amount_charged, durasi_hari, status, token_code, created_at, paid_at")
      .eq("store_id", me.store_id)
      .order("created_at", { ascending: false })
      .limit(20);
    return Response.json({ orders: data || [] });
  }

  const { data: ord } = await db
    .from("subscription_orders")
    .select("id, store_id, payment_ref, status, token_code")
    .eq("id", id)
    .maybeSingle();
  if (!ord || ord.store_id !== me.store_id) return Response.json({ error: "not found" }, { status: 404 });
  if (ord.status === "paid") return Response.json({ status: "paid", token_code: ord.token_code });
  if (!ord.payment_ref) return Response.json({ status: ord.status });

  // Cek otomatis ke akun QRIS J366 (Casaku).
  const { platformStoreId } = await platformContext(db);
  const cfg = await getPaymentConfig(platformStoreId);
  try {
    const resp = await checkStatus(cfg.casaku, ord.payment_ref);
    const d = resp?.data || resp;
    const st = (d?.status || "").toLowerCase();
    if (st === "paid") {
      const fin = await finalizeSubscriptionOrder(db, ord.id, { amountCharged: d?.amount });
      return Response.json({ status: "paid", token_code: fin.token_code });
    }
    if (st === "expired" || st === "cancel") {
      await db.from("subscription_orders").update({ status: st }).eq("id", ord.id).neq("status", "paid");
      return Response.json({ status: st });
    }
    return Response.json({ status: "pending" });
  } catch (e) {
    // Gagal cek (jaringan/Casaku) — biarkan pending, jangan gagalkan UI.
    return Response.json({ status: "pending", note: "cek tertunda" });
  }
}
