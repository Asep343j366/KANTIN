export function rupiah(n) {
  const v = Number(n || 0);
  return "Rp" + v.toLocaleString("id-ID");
}

export function orderCode() {
  const d = new Date();
  const ymd =
    d.getFullYear().toString().slice(2) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KTN-${ymd}-${rnd}`;
}

export const STATUS = {
  menunggu_verifikasi: { label: "Menunggu Verifikasi", tone: "warning" },
  diproses: { label: "Diproses", tone: "primary" },
  siap_diambil: { label: "Siap Diambil", tone: "success" },
  selesai: { label: "Selesai", tone: "ink" },
  dibatalkan: { label: "Dibatalkan", tone: "danger" },
};

export function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
