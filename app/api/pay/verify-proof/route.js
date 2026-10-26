import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Verifikasi bukti pembayaran yang diupload pelanggan — pakai OCR biasa
// (OCR.space, non-AI). Simpan URL bukti, lalu baca teksnya:
//  - AUTO-LUNAS hanya jika nominal yang terbaca cocok dengan nominal unik
//    pesanan (amount_charged, mis. 401) ATAU total (mis. 400) — toleran format
//    "sen" (401.00) — DAN tidak ada tanda gagal/pending.
//  - Tanpa OCRSPACE_API_KEY / OCR gagal / nominal tak cocok / bukti gagal →
//    tetap pending untuk VERIFIKASI MANUAL admin (foto tetap tersimpan).
// Casaku auto-settle tak lewat sini. Alur manual tidak berubah.
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

  if (bukti_url) await db.from("orders").update({ bukti_bayar_url: bukti_url }).eq("id", order.id);
  if (order.payment_status === "paid") return Response.json({ status: "already_paid" });

  const targets = [Number(order.amount_charged), Number(order.total)].filter((x) => x > 0);
  const expected = Number(order.amount_charged ?? order.total ?? 0);
  const key = process.env.OCRSPACE_API_KEY;
  if (!key || !bukti_url) return Response.json({ status: "manual", reason: key ? "no_image" : "no_key", expected });

  // OCR via OCR.space (kirim URL gambar publik; server mereka yang membaca).
  let text = "";
  let reason = "ocr_error";
  let detail = null;
  try {
    const form = new URLSearchParams();
    form.set("apikey", key);
    form.set("url", bukti_url);
    form.set("OCREngine", "2");     // engine 2: auto-bahasa, lebih baik utk struk
    form.set("scale", "true");
    form.set("isOverlayRequired", "false");
    const oRes = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const oJson = await oRes.json();
    if (oJson?.IsErroredOnProcessing) {
      detail = (Array.isArray(oJson.ErrorMessage) ? oJson.ErrorMessage.join(" ") : (oJson.ErrorMessage || "")).toString().slice(0, 180);
      reason = /quota|limit|rate|exceed/i.test(detail) ? "ocr_quota" : "ocr_error";
    } else {
      text = oJson?.ParsedResults?.[0]?.ParsedText || "";
    }
  } catch {
    reason = "ocr_network";
  }

  if (!text) return Response.json({ status: "manual", reason, detail, expected });

  // Analisa teks hasil OCR.
  const failure = /gagal|failed|pending|menunggu|dibatalkan|cancel|ditolak|tidak berhasil|belum berhasil|expired|kedaluwarsa/i.test(text);
  // Semua angka pada teks (buang pemisah ribuan/desimal → integer); cocokkan ke
  // target persis atau versi "sen" (dibagi 100).
  const nums = (text.match(/\d[\d.,]*\d|\d/g) || [])
    .map((s) => Number(s.replace(/[.,]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  const amountOk = nums.some((n) => targets.some((t) => n === t || Math.round(n / 100) === t));

  if (!amountOk) return Response.json({ status: "manual", reason: "amount_mismatch", expected });
  if (failure) return Response.json({ status: "manual", reason: "not_valid_proof", expected });

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
