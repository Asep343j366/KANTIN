import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getPaymentConfig } from "@/lib/paymentConfig";

export const dynamic = "force-dynamic";

// Webhook Casaku PER STORE — URL: /api/pay/webhook/<storeId>
// Tiap store mendaftarkan URL ini (dengan storeId-nya) di dashboard Casaku.
// Signature HMAC-SHA256 (header X-Casaku-Signature) atas RAW body, diverifikasi
// pakai webhook_secret milik store tsb. Balas 200 <10s (Casaku retry 3x).
export async function POST(request, { params }) {
  const storeId = params?.storeId;
  if (!storeId) return Response.json({ error: "store tidak dikenal" }, { status: 400 });

  const cfg = await getPaymentConfig(storeId);
  const secret = cfg?.casaku?.webhookSecret;
  if (!secret) {
    console.error("[casaku webhook] webhook_secret belum diatur untuk store", storeId);
    return Response.json({ error: "not configured" }, { status: 500 });
  }

  const signature = request.headers.get("x-casaku-signature") || "";
  const raw = await request.text(); // RAW body — jangan di-parse dulu (HMAC sensitif urutan)

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  let valid = false;
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }
  if (!valid) {
    console.error("[casaku webhook] signature mismatch", { storeId, hasSignature: Boolean(signature) });
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload = {};
  try { payload = JSON.parse(raw); } catch { return Response.json({ received: true }); }

  if (payload.status === "paid" && payload.transactionId) {
    try {
      const db = supabaseAdmin();
      // Pastikan transaksi memang milik store ini (payment_ref unik global).
      const { data: order } = await db
        .from("orders")
        .select("id, store_id")
        .eq("payment_ref", payload.transactionId)
        .maybeSingle();
      if (order && order.store_id === storeId) {
        await db.rpc("mark_order_paid", {
          p_payment_ref: payload.transactionId,
          p_amount: payload.amount ?? null,
        });
      } else {
        console.warn("[casaku webhook] order tak cocok dengan store", { storeId, txn: payload.transactionId });
      }
    } catch (e) {
      console.error("[casaku webhook]", e?.message || e);
    }
  }

  return Response.json({ received: true });
}
