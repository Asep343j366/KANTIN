import { supabaseAdmin } from "@/lib/supabaseServer";
import { generateQris } from "@/lib/casaku";

export const dynamic = "force-dynamic";

// Buat transaksi QRIS dinamis (Casaku) untuk sebuah order.
// Nominal dasar DIHITUNG ULANG dari order_items di server (otoritatif).
// Casaku menambahkan kode unik → totalAmount adalah nominal yang wajib
// dibayar pelanggan PERSIS agar cocok otomatis.
export async function POST(request) {
  const { order_id } = await request.json().catch(() => ({}));
  if (!order_id) return Response.json({ error: "order_id wajib" }, { status: 400 });

  const db = supabaseAdmin();

  const { data: order, error } = await db
    .from("orders")
    .select("id, kode_pesanan, payment_status")
    .eq("id", order_id)
    .single();
  if (error || !order) return Response.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.payment_status === "paid")
    return Response.json({ error: "Order sudah dibayar" }, { status: 400 });

  const { data: items } = await db
    .from("order_items")
    .select("harga, jumlah")
    .eq("order_id", order_id);
  const amount = (items || []).reduce((s, i) => s + i.harga * i.jumlah, 0);
  if (amount < 1) return Response.json({ error: "Nominal tidak valid" }, { status: 400 });

  try {
    const resp = await generateQris({ amount, prefix: "KTN" });
    const d = resp?.data || resp;
    const txnId = d?.transactionId;
    const qr = d?.qr_string;
    const totalAmount = d?.totalAmount ?? amount;
    if (!txnId || !qr) throw new Error("Respons Casaku tidak lengkap.");

    await db
      .from("orders")
      .update({ payment_ref: txnId, payment_status: "pending", amount_charged: totalAmount })
      .eq("id", order_id);

    return Response.json({
      qr_string: qr,
      transaction_id: txnId,
      amount: totalAmount,
      expired_at: d?.expiredAt || null,
    });
  } catch (e) {
    return Response.json({ error: e.message || "Gagal membuat transaksi" }, { status: 502 });
  }
}
