import { supabaseAdmin } from "@/lib/supabaseServer";

// Ambil config pembayaran sebuah store (server-only, service role).
// Bila store belum punya baris store_payment_config, fallback ke ENV Casaku
// agar store lama (J366) tetap berjalan tanpa perlu mengisi config dulu.
// Return bentuk ternormalisasi: { mode, casaku: { baseUrl, licenseKey, qrId, webhookSecret, packageIds, expireMinutes } }
export async function getPaymentConfig(store_id) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("store_payment_config")
    .select("*")
    .eq("store_id", store_id)
    .maybeSingle();

  if (data) {
    return {
      mode: data.active === false ? "manual" : (data.mode || "manual"),
      source: "db",
      casaku: {
        baseUrl: data.base_url || "https://api.casaku.id",
        licenseKey: data.license_key || null,
        qrId: data.qr_id || null,
        webhookSecret: data.webhook_secret || null,
        packageIds: data.package_ids || "id.dana",
        expireMinutes: data.expire_minutes || 1440,
      },
    };
  }

  // Fallback ENV (transisi untuk store platform / J366)
  if (process.env.CASAKU_LICENSE_KEY) {
    return {
      mode: "casaku",
      source: "env",
      casaku: {
        baseUrl: process.env.CASAKU_BASE_URL || "https://api.casaku.id",
        licenseKey: process.env.CASAKU_LICENSE_KEY,
        qrId: process.env.CASAKU_QR_ID || null,
        webhookSecret: process.env.CASAKU_WEBHOOK_SECRET || null,
        packageIds: process.env.CASAKU_PACKAGE_IDS || "id.dana",
        expireMinutes: Number(process.env.CASAKU_EXPIRE_MINUTES) || 1440,
      },
    };
  }

  // Tak ada config sama sekali → manual
  return { mode: "manual", source: "none", casaku: {} };
}
