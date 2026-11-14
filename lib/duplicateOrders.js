// Deteksi pesanan ganda: pembeli yang sama (no HP, atau nama bila HP kosong),
// total sama, dibuat berdekatan (≤ WINDOW menit dari pesanan sebelumnya).
export const DUP_WINDOW_MIN = 10;

const who = (o) => (String(o.no_hp || "").replace(/\D/g, "") || String(o.nama_pelanggan || "").trim().toLowerCase());

// orders: [{id, no_hp, nama_pelanggan, total, created_at, ...}] → array rantai (≥2 order)
export function findDuplicateChains(orders, windowMin = DUP_WINDOW_MIN) {
  const groups = {};
  for (const o of orders) {
    const k = who(o) + "|" + Number(o.total || 0);
    (groups[k] ||= []).push(o);
  }
  const chains = [];
  for (const list of Object.values(groups)) {
    if (list.length < 2) continue;
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    let cur = [list[0]];
    for (let i = 1; i < list.length; i++) {
      const gap = (new Date(list[i].created_at) - new Date(cur[cur.length - 1].created_at)) / 60000;
      if (gap <= windowMin) cur.push(list[i]);
      else { if (cur.length > 1) chains.push(cur); cur = [list[i]]; }
    }
    if (cur.length > 1) chains.push(cur);
  }
  return chains.sort((a, b) => new Date(b[0].created_at) - new Date(a[0].created_at));
}

// Saran: pertahankan 1 order per rantai — yang terbukti dibayar (ref Casaku /
// bukti transfer), kalau tidak ada yang paling awal. Sisanya disarankan batal.
export function suggestKeep(chain) {
  const proven = chain.find((o) => o.payment_ref || o.bukti_bayar_url);
  return (proven || chain[0]).id;
}

// Set id order pending yang punya kembaran (pending lain / sudah lunas).
export function duplicateIds(orders, windowMin = DUP_WINDOW_MIN) {
  const ids = new Set();
  for (const c of findDuplicateChains(orders, windowMin)) for (const o of c) ids.add(o.id);
  return ids;
}
