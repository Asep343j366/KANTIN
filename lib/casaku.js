// Helper Casaku (QRIS dinamis + auto-verifikasi) — HANYA dipakai di server.
// Config (license key, qr id, dll) DITERIMA sebagai argumen (per store),
// bukan dibaca dari env. License key rahasia tidak pernah dikirim ke client.
// Docs: https://casaku.id/docs

async function call(cfg, path, body) {
  if (!cfg?.licenseKey) throw new Error("License key Casaku belum diatur untuk store ini.");
  const base = cfg.baseUrl || "https://api.casaku.id";
  const res = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-license-key": cfg.licenseKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Casaku error ${res.status}`);
  return data;
}

// Buat transaksi QRIS dinamis. Casaku menyisipkan kode unik ke nominal
// (useUniqueCode) sehingga tiap transaksi punya total berbeda & bisa
// dicocokkan otomatis ke pembayaran yang masuk.
// cfg: { baseUrl, licenseKey, qrId, packageIds (array|string), expireMinutes }
export function generateQris(cfg, { amount, prefix }) {
  if (!cfg?.qrId) throw new Error("QR ID Casaku belum diatur untuk store ini.");
  const packageIds = Array.isArray(cfg.packageIds)
    ? cfg.packageIds
    : String(cfg.packageIds || "id.dana").split(",").map((s) => s.trim()).filter(Boolean);

  return call(cfg, "/api/generate/v2/qris", {
    qr_id: cfg.qrId,
    amount,
    useUniqueCode: true,
    packageIds,
    expiredInMinutes: Number(cfg.expireMinutes) || 1440,
    qrType: "dynamic",
    paymentMethod: "qris",
    useQris: true,
    prefix: prefix ? prefix.slice(0, 8) : undefined,
  });
}

// Cek status transaksi ke Casaku: pending | paid | cancel | expired.
export function checkStatus(cfg, transactionId) {
  return call(cfg, "/api/generate/check-status", { transactionId });
}
