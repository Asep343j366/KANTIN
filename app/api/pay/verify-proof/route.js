import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cache antar-request (hemat kuota): daftar model & model yang terbukti jalan.
let _models = null;
let _goodModel = null;

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
  if (!key || !bukti_url) return Response.json({ status: "manual", reason: key ? "no_image" : "no_key", expected });

  // Analisa foto via Gemini. APA PUN yang gagal (kuota habis/429, error,
  // jaringan, respons tak bisa diparse) → jatuh ke verifikasi MANUAL, tidak
  // pernah melempar error ke pelanggan.
  let verdict = null;
  let reason = "ai_error";
  let detail = null;
  try {
    const imgRes = await fetch(bukti_url);
    const mime = imgRes.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const b64 = buf.toString("base64");

    const prompt =
      "Kamu memverifikasi bukti pembayaran (screenshot transfer / QRIS / e-wallet / m-banking seperti DANA, GoPay, OVO, BCA, BRI, Mandiri) untuk sebuah kantin. " +
      "Lihat gambar dan tentukan: apakah ini bukti transaksi yang BERHASIL/SUKSES, dan berapa NOMINAL utama yang dibayarkan. " +
      'Jawab HANYA dengan JSON valid tanpa teks lain: {"is_proof":boolean,"success":boolean,"amount":number|null}. ' +
      "amount = nominal dalam RUPIAH PENUH sebagai angka bulat. PENTING: Rupiah TIDAK memakai sen, jadi ABAIKAN dua angka desimal di belakang titik/koma. " +
      "Contoh: 'IDR 802.00' -> 802 ; 'Rp 1.500,00' -> 1500 ; 'Rp10.001' -> 10001 ; 'IDR 12,500.00' -> 12500. " +
      "Jika bukan bukti pembayaran atau tidak jelas, is_proof/success=false dan amount=null.";

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
      // maxOutputTokens cukup besar + paksa output JSON agar hasil pasti terbaca
      // (model kecil/thinking sebelumnya kehabisan token → teks kosong).
      generationConfig: { temperature: 0, maxOutputTokens: 800, responseMimeType: "application/json" },
    });

    // Deteksi model yang DIDUKUNG key ini; utamakan flash stabil, hindari
    // varian thinking/exp/tts/image/embedding (bisa 400 / tak keluarkan teks).
    const bad = /embedding|tts|image-generation|imagen|live|thinking|-exp/i;
    const rank = (n) =>
      /2\.0-flash\b/.test(n) ? 0 : /flash-latest/.test(n) ? 1 : /1\.5-flash\b/.test(n) ? 2 : /2\.5-flash\b/.test(n) ? 3 : 5;
    // HEMAT KUOTA: kalau sudah ada model yang terbukti jalan, pakai itu saja.
    // Kalau belum, deteksi via ListModels (sekali, lalu di-cache).
    let models;
    if (_goodModel) {
      models = [_goodModel];
    } else {
      if (!_models) {
        let list = [];
        try {
          const lr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
          if (lr.ok) {
            const lj = await lr.json();
            list = (lj.models || [])
              .filter((mm) => (mm.supportedGenerationMethods || []).includes("generateContent") && /flash/i.test(mm.name))
              .map((mm) => mm.name.replace(/^models\//, ""))
              .filter((n) => !bad.test(n))
              .sort((a, b) => rank(a) - rank(b));
          }
        } catch {}
        if (process.env.GEMINI_MODEL) list.unshift(process.env.GEMINI_MODEL);
        if (!list.length) list = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash"];
        _models = list;
      }
      models = _models.slice(0, 3); // maksimal 3 percobaan model
    }

    // Coba tiap model; model yang 400/404/empty → lanjut; 429 (kuota) → berhenti.
    for (const model of models) {
      let gRes;
      try {
        gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body }
        );
      } catch { reason = "ai_network"; continue; }

      if (gRes.ok) {
        try {
          const gJson = await gRes.json();
          const text = gJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const m = text.match(/\{[\s\S]*\}/);
          if (m) { verdict = JSON.parse(m[0]); _goodModel = model; break; }
          reason = "ai_empty"; detail = (text || JSON.stringify(gJson)).slice(0, 180);
          continue;
        } catch { reason = "ai_parse"; continue; }
      }
      if (gRes.status === 429) { reason = "ai_quota"; break; }
      if (gRes.status === 404) { reason = "ai_model_404"; continue; }
      reason = "ai_http_" + gRes.status;
      try { const et = await gRes.json(); detail = (et?.error?.message || JSON.stringify(et)).slice(0, 180); } catch {}
      continue;
    }
  } catch {
    verdict = null;
  }

  if (!verdict) return Response.json({ status: "manual", reason, detail, expected });

  const detected = Number(verdict.amount);
  // Terima bila nominal terbaca cocok dengan nominal unik (amount_charged, mis.
  // 401) ATAU total dasar (mis. 400) — keduanya sah. Plus toleransi "sen"
  // (mis. 401.00 terbaca 40100 → /100 = 401).
  const targets = [Number(order.amount_charged), Number(order.total)].filter((x) => x > 0);
  const amountOk =
    Number.isFinite(detected) && targets.length > 0 &&
    targets.some((t) => detected === t || Math.round(detected / 100) === t);
  const valid = verdict.is_proof === true && verdict.success === true && amountOk;

  if (!valid) {
    return Response.json({
      status: "manual",
      reason: !amountOk ? "amount_mismatch" : "not_valid_proof",
      detected: Number.isFinite(detected) ? detected : null,
      expected,
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
