// Helper Casaku (QRIS dinamis + auto-verifikasi) — HANYA dipakai di server.
// License key rahasia diambil dari env, tidak pernah dikirim ke client.
// Docs: https://casaku.id/docs

const BASE = process.env.CASAKU_BASE_URL || "https://api.casaku.id";
const KEY = process.env.CASAKU_LICENSE_KEY;

async function call(path, body) {
  if (!KEY) throw new Error("CASAKU_LICENSE_KEY belum diset di environment.");
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-license-key": KEY,
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
// expiredInMinutes: sengaja dibuat sangat panjang (default 24 jam) agar
// transaksi tidak keburu expired sebelum Casaku sempat membaca notifikasi
// pembayaran yang masuk. Bisa diatur via env CASAKU_EXPIRE_MINUTES.
export function generateQris({
  amount,
  prefix,
  expiredInMinutes = Number(process.env.CASAKU_EXPIRE_MINUTES) || 1440,
}) {
  const qrId = process.env.CASAKU_QR_ID;
  if (!qrId) throw new Error("CASAKU_QR_ID belum diset di environment.");
  const packageIds = (process.env.CASAKU_PACKAGE_IDS || "id.dana")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return call("/api/generate/v2/qris", {
    qr_id: qrId,
    amount,
    useUniqueCode: true,
    packageIds,
    expiredInMinutes,
    qrType: "dynamic",
    paymentMethod: "qris",
    useQris: true,
    prefix: prefix ? prefix.slice(0, 8) : undefined,
  });
}

// Cek status transaksi ke Casaku: pending | paid | cancel | expired.
export function checkStatus(transactionId) {
  return call("/api/generate/check-status", { transactionId });
}
