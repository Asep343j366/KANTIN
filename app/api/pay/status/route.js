import { supabaseAdmin } from "@/lib/supabaseServer";
import { checkStatus } from "@/lib/casaku";
import { getPaymentConfig } from "@/lib/paymentConfig";

export const dynamic = "force-dynamic";

// Polling status pembayaran sebuah order storefront (dipanggil halaman order).
// Menanyakan langsung ke Casaku, jadi pembayaran tetap tertangkap walau webhook
// gagal/telat terbaca. Bila Casaku melapor 'paid' → settle via mark_order_paid
// (idempoten — aman dipanggil berkali-kali). Hanya berlaku untuk order casaku
// yang masih pending & punya payment_ref.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return Response.json({ error: "code wajib" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("id, store_id, status, payment_status, payment_ref")
    .eq("kode_pesanan", code)
    .maybeSingle();
  if (!order) return Response.json({ error: "not found" }, { status: 404 });

  // Sudah lunas / batal → tak perlu cek Casaku.
  if (order.status === "selesai" || order.payment_status === "paid")
    return Response.json({ status: "paid" });
  if (order.status === "dibatalkan")
    return Response.json({ status: "cancel" });
  if (!order.payment_ref)
    return Response.json({ status: "pending" });

  const cfg = await getPaymentConfig(order.store_id);
  if (cfg.mode !== "casaku")
    return Response.json({ status: "pending" });

  try {
    const resp = await checkStatus(cfg.casaku, order.payment_ref);
    const d = resp?.data || resp;
    const st = (d?.status || "").toLowerCase();
    if (st === "paid") {
      // Settle idempoten (webhook bisa saja sudah/duluan menandai lunas).
      await db.rpc("mark_order_paid", {
        p_payment_ref: order.payment_ref,
        p_amount: d?.amount ?? null,
      });
      return Response.json({ status: "paid" });
    }
    return Response.json({ status: st || "pending" });
  } catch {
    // Gagal cek (jaringan/Casaku) — jangan gagalkan UI, biarkan pending.
    return Response.json({ status: "pending", note: "cek tertunda" });
  }
}
