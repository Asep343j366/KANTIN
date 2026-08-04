import crypto from "crypto";

// Kode voucher: KTN-XXXX-XXXX (base32 Crockford tanpa char ambigu) — sama pola
// dengan token yang dibuat manual oleh platform-admin.
function genCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  const pick = (n) => Array.from({ length: n }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  return `KTN-${pick(4)}-${pick(4)}`;
}

// Finalisasi pembayaran langganan (idempoten & aman-balapan). Dipakai oleh:
//  - polling check-status (otomatis, saat Casaku baca pembayaran), dan
//  - verifikasi manual platform-admin J366 (kalau Casaku gagal baca).
//
// Alur menang-balapan (hanya SATU pemanggil yang lolos gerbang UPDATE):
//  1) terbitkan voucher (subscription_tokens),
//  2) AUTO-perpanjang langganan store (redeem_subscription_token),
//  3) matikan status trip (is_trial=false),
//  4) catat jurnal J366 (kategori Langganan) — HANYA jurnal, bukan order,
//  5) simpan token_code + amount_charged ke subscription_orders.
//
// Return: { ok, already, token_code, langganan_until }
export async function finalizeSubscriptionOrder(db, orderId, { amountCharged } = {}) {
  // Gerbang atomik: hanya baris yang masih != 'paid' yang lolos.
  const { data: won } = await db
    .from("subscription_orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), ...(amountCharged ? { amount_charged: amountCharged } : {}) })
    .eq("id", orderId)
    .neq("status", "paid")
    .select()
    .maybeSingle();

  if (!won) {
    // Sudah difinalisasi pemanggil lain (atau tak ada) → kembalikan yang ada.
    const { data: cur } = await db
      .from("subscription_orders")
      .select("status, token_code")
      .eq("id", orderId)
      .maybeSingle();
    return { ok: cur?.status === "paid", already: true, token_code: cur?.token_code || null };
  }

  // 1) Terbitkan voucher
  const code = genCode();
  await db.from("subscription_tokens").insert({ code, durasi_hari: won.durasi_hari });

  // 2) AUTO-perpanjang langganan store (RPC idempoten: extend + tandai token terpakai)
  const { data: until } = await db.rpc("redeem_subscription_token", {
    p_code: code,
    p_store: won.store_id,
  });

  // 3) Trial selesai → badge countdown hilang
  await db.from("stores").update({ is_trial: false }).eq("id", won.store_id);

  // 4) Jurnal J366 (platform-admin) — kategori Langganan, HANYA jurnal
  const { data: plat } = await db
    .from("stores")
    .select("id, nama")
    .eq("is_platform_admin", true)
    .limit(1)
    .maybeSingle();
  const { data: buyer } = await db.from("stores").select("nama, kode_site").eq("id", won.store_id).maybeSingle();
  if (plat?.id) {
    await db.from("journal").insert({
      store_id: plat.id,
      jenis: "masuk",
      kategori: "Langganan",
      keterangan: `Langganan ${won.durasi_hari} hari — ${buyer?.nama || "toko"} (${buyer?.kode_site || "-"})`,
      jumlah: won.amount,
      dicatat_oleh: "sistem",
      sub_order_id: won.id,
    });
  }

  // 5) Simpan kode voucher ke pesanan langganan
  await db.from("subscription_orders").update({ token_code: code }).eq("id", won.id);

  return { ok: true, already: false, token_code: code, langganan_until: until || null };
}
