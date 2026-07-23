import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Webhook Casaku — dipanggil saat transaksi menjadi "paid".
// Payload ditandatangani HMAC-SHA256 (header X-Casaku-Signature) atas RAW body.
// Kita WAJIB verifikasi tanda tangan sebelum mempercayai payload.
// Balas 200 dalam <10 detik (Casaku retry hingga 3x bila gagal).
export async function POST(request) {
  const secret = process.env.CASAKU_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[casaku webhook] CASAKU_WEBHOOK_SECRET belum diset");
    return Response.json({ error: "not configured" }, { status: 500 });
  }

  const signature = request.headers.get("x-casaku-signature") || "";
  const raw = await request.text(); // RAW body — jangan di-parse dulu (HMAC sensitif urutan)

  // Verifikasi HMAC-SHA256, perbandingan constant-time
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
    console.error("[casaku webhook] signature mismatch", {
      hasSignature: Boolean(signature),
      sigLen: signature.length,
      expectedLen: expected.length,
      bodyPreview: raw.slice(0, 120),
    });
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ received: true });
  }

  if (payload.status === "paid" && payload.transactionId) {
    try {
      const db = supabaseAdmin();
      // Fungsi idempoten: settle sekali + kurangi stok
      await db.rpc("mark_order_paid", {
        p_payment_ref: payload.transactionId,
        p_amount: payload.amount ?? null,
      });
    } catch (e) {
      console.error("[casaku webhook]", e?.message || e);
    }
  }

  return Response.json({ received: true });
}
