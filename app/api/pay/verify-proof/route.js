import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Verifikasi bukti pembayaran yang DIUPLOAD pelanggan.
//  - Simpan URL bukti ke order.
//  - Bila GEMINI_API_KEY ada: analisa foto (apakah bukti pembayaran BERHASIL +
//    ekstrak nominal). Auto-lunas HANYA jika sukses DAN nominal cocok dengan
//    nominal unik pesanan (amount_charged, fallback total) → anti bukti palsu.
//  - Bila tidak ada key / AI ragu / nominal tak cocok → biarkan pending untuk
//    VERIFIKASI MANUAL admin (foto tetap tersimpan sebagai lampiran).
// Catatan: Casaku yang settle otomatis tak lewat sini. Tak mengubah alur manual.
export async function POST(request) {
  const { order_id, bukti_url } = await request.json().catch(() => ({}));
  if (!order_id) return Response.json({ error: "order_id wajib" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: order, error } = await db
    .from("orders")
    .select("id, payment_ref, amount_charged, total, payment_status, store_id")
    .eq("id", order_id)
    .single();
  if (error || !order) return Response.json({ error: "Order tidak ditemukan" }, { status: 404 });

  // Simpan lampiran bukti bila dikirim.
  if (bukti_url) {
    await db.from("orders").update({ bukti_bayar_url: bukti_url }).eq("id", order.id);
  }

  if (order.payment_status === "paid") return Response.json({ status: "already_paid" });

  const expected = Number(order.amount_charged ?? order.total ?? 0);
  const key = process.env.GEMINI_API_KEY;

  // Tanpa key atau tanpa url bukti → tak bisa auto-analisa → manual.
  if (!key || !bukti_url) return Response.json({ status: "manual", reason: key ? "no_image" : "no_key" });

  // Analisa foto via Gemini. APA PUN yang gagal (kuota habis/429, error,
  // jaringan, respons tak bisa diparse) → jatuh ke verifikasi MANUAL, tidak
  // pernah melempar error ke pelanggan.
  let verdict = null;
  let reason = "ai_error";
  try {
    const imgRes = await fetch(bukti_url);
    const mime = imgRes.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const b64 = buf.toString("base64");

    const prompt =
      "Kamu memverifikasi bukti pembayaran (screenshot transfer / QRIS / e-wallet seperti DANA, GoPay, OVO, m-banking) untuk sebuah kantin. " +
      "Lihat gambar dan tentukan: apakah ini bukti transaksi yang BERHASIL/SUKSES, dan berapa NOMINAL utama yang dibayarkan. " +
      'Jawab HANYA dengan JSON valid tanpa teks lain: {"is_proof":boolean,"success":boolean,"amount":number|null}. ' +
      "amount = nominal rupiah sebagai angka bulat tanpa titik/koma (contoh 10001). Jika bukan bukti pembayaran atau tidak jelas, is_proof/success=false dan amount=null.";

    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 120 },
        }),
      }
    );

    if (!gRes.ok) {
      // 429 = kuota/rate limit free-tier habis → biarkan manual, jangan error.
      reason = gRes.status === 429 ? "ai_quota" : "ai_http_" + gRes.status;
    } else {
      const gJson = await gRes.json();
      const text = gJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const m = text.match(/\{[\s\S]*\}/);
      if (m) verdict = JSON.parse(m[0]);
    }
  } catch {
    verdict = null;
  }

  if (!verdict) return Response.json({ status: "manual", reason });

  const detected = Number(verdict.amount);
  const amountOk = Number.isFinite(detected) && expected > 0 && detected === expected;
  const valid = verdict.is_proof === true && verdict.success === true && amountOk;

  if (!valid) {
    return Response.json({
      status: "manual",
      reason: !amountOk ? "amount_mismatch" : "not_valid_proof",
      detected: Number.isFinite(detected) ? detected : null,
    });
  }

  // Lolos → settle (idempoten, sama dengan jalur manual/webhook).
  let ref = order.payment_ref;
  if (!ref) {
    ref = `BUKTI-${order.id}`;
    await db.from("orders").update({ payment_ref: ref }).eq("id", order.id);
  }
  const { error: rpcErr } = await db.rpc("mark_order_paid", {
    p_payment_ref: ref,
    p_amount: order.amount_charged ?? order.total ?? null,
  });
  if (rpcErr) return Response.json({ status: "manual", reason: "settle_error" });

  return Response.json({ status: "auto" });
}
