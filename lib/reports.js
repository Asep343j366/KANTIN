// Perhitungan Dashboard & Laporan dari data Supabase nyata.
// Input:
//   orders   : [{id, kode_pesanan, total, created_at, status}]
//   items    : [{order_id, product_id, nama_produk, harga, jumlah}]
//   products : [{id, nama, harga, stok, tersedia, category_id, categoryNama}]

// Gunakan tanggal LOKAL (bukan UTC) agar penjualan "hari ini" sesuai zona waktu pengguna.
function ymd(d) { return new Date(d).toLocaleDateString("en-CA"); } // -> YYYY-MM-DD lokal
export function todayStr() { return new Date().toLocaleDateString("en-CA"); }
export function monthStr() { return todayStr().slice(0, 7); }

export function daysBetweenInclusive(a, b) {
  if (!a || !b) return 1;
  const d1 = new Date(a + "T00:00:00"), d2 = new Date(b + "T00:00:00");
  return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
}
export function daysSince(dateStr) {
  if (!dateStr) return null;
  const d1 = new Date(dateStr + "T00:00:00"), d0 = new Date(todayStr() + "T00:00:00");
  return Math.round((d0 - d1) / 86400000);
}

// Ubah orders+items jadi baris penjualan per-item beserta tanggal & kategori.
export function buildSalesRows(orders, items, products) {
  const done = orders.filter((o) => o.status === "selesai");
  const oMap = {};
  done.forEach((o) => (oMap[o.id] = o));
  const pMap = {};
  products.forEach((p) => (pMap[p.id] = p));
  return items
    .filter((it) => oMap[it.order_id])
    .map((it) => {
      const o = oMap[it.order_id];
      const p = pMap[it.product_id];
      const hpp = p?.hpp || 0;
      return {
        NOMOR: o.kode_pesanan,
        TANGGAL: ymd(o.created_at),
        ID: it.product_id,
        NAMA: it.nama_produk,
        KATEGORI: p?.categoryNama || "Lainnya",
        HARGA: it.harga,
        HPP: hpp,
        QTY: it.jumlah,
        SUBTOTAL: it.harga * it.jumlah,
        LABA: (it.harga - hpp) * it.jumlah,
      };
    });
}

export function computeDashboard(orders, items, products, threshold = 5) {
  const done = orders.filter((o) => o.status === "selesai");
  const today = todayStr(), month = monthStr();
  const todays = done.filter((o) => ymd(o.created_at) === today);
  const months = done.filter((o) => ymd(o.created_at).slice(0, 7) === month);
  const omzetHariIni = todays.reduce((s, o) => s + o.total, 0);
  const omzetBulanIni = months.reduce((s, o) => s + o.total, 0);
  const avgBasketSize = done.length ? Math.round(done.reduce((s, o) => s + o.total, 0) / done.length) : 0;

  const rows = buildSalesRows(orders, items, products);
  const labaHariIni = rows.filter((r) => r.TANGGAL === today).reduce((s, r) => s + r.LABA, 0);
  const labaBulanIni = rows.filter((r) => r.TANGGAL.slice(0, 7) === month).reduce((s, r) => s + r.LABA, 0);
  const terlarisMap = {};
  rows.forEach((r) => { terlarisMap[r.NAMA] = (terlarisMap[r.NAMA] || 0) + r.QTY; });
  const produkTerlaris = Object.entries(terlarisMap)
    .map(([nama, qty]) => ({ nama, qty }))
    .sort((a, b) => b.qty - a.qty).slice(0, 5);

  const stokMenipis = products
    .filter((p) => p.stok <= threshold)
    .sort((a, b) => a.stok - b.stok)
    .map((p) => ({ nama: p.nama, stok: p.stok }));

  return {
    omzetHariIni, omzetBulanIni,
    labaHariIni, labaBulanIni,
    transaksiHariIni: todays.length,
    transaksiBulanIni: months.length,
    avgBasketSize,
    produkTerlaris, stokMenipis,
    totalProduk: products.length,
  };
}

export function computeReport(orders, items, products, opts) {
  const { start, end, namaId = "ALL", kategori = "ALL" } = opts;
  let rows = buildSalesRows(orders, items, products);
  // filter nama & kategori
  rows = rows.filter((r) => {
    if (namaId !== "ALL" && r.ID !== namaId) return false;
    if (kategori !== "ALL" && r.KATEGORI !== kategori) return false;
    return true;
  });
  const scopedAll = rows.slice();
  const rangeRows = rows.filter((r) => (!start || r.TANGGAL >= start) && (!end || r.TANGGAL <= end));

  // last sale map (dari seluruh histori, bukan hanya range)
  const lastSaleMap = {};
  scopedAll.forEach((r) => { if (!lastSaleMap[r.ID] || r.TANGGAL > lastSaleMap[r.ID]) lastSaleMap[r.ID] = r.TANGGAL; });

  // agregasi per produk (range)
  const agg = {};
  rangeRows.forEach((r) => {
    if (!agg[r.ID]) agg[r.ID] = { ID: r.ID, NAMA: r.NAMA, KATEGORI: r.KATEGORI, qty: 0, total: 0, trx: new Set() };
    agg[r.ID].qty += r.QTY; agg[r.ID].total += r.SUBTOTAL; agg[r.ID].trx.add(r.NOMOR);
  });
  const perProduct = Object.values(agg);
  const totalPenjualan = perProduct.reduce((s, p) => s + p.total, 0);
  const totalQty = perProduct.reduce((s, p) => s + p.qty, 0);
  const totalTransaksi = new Set(rangeRows.map((r) => r.NOMOR)).size;
  const skuCount = perProduct.length;
  const daysInRange = daysBetweenInclusive(start, end);
  const avgPerHari = daysInRange > 0 ? totalPenjualan / daysInRange : 0;
  const avgQtyPerTrx = totalTransaksi > 0 ? totalQty / totalTransaksi : 0;
  const avgBasket = totalTransaksi > 0 ? totalPenjualan / totalTransaksi : 0;

  const pMap = {}; products.forEach((p) => (pMap[p.id] = p));
  const produkAktifTerjual = perProduct.filter((p) => pMap[p.ID]?.tersedia).length;

  const detailRows = perProduct.map((p) => ({
    ID: p.ID, NAMA: p.NAMA, KATEGORI: p.KATEGORI, qty: p.qty, total: p.total,
    avgHarga: p.qty > 0 ? p.total / p.qty : 0,
    kontribusi: totalPenjualan > 0 ? (p.total / totalPenjualan) * 100 : 0,
    lastSale: lastSaleMap[p.ID] || null,
    daysSinceLastSale: daysSince(lastSaleMap[p.ID]),
  })).sort((a, b) => b.qty - a.qty);

  const fastMoving = detailRows.slice().sort((a, b) => b.qty - a.qty).slice(0, 10);
  const contributors = detailRows.slice().sort((a, b) => b.total - a.total).slice(0, 10);

  // scoped products untuk slow/dead/stock (dari master, ikut filter nama/kategori)
  const scopedProducts = products.filter((p) => {
    if (namaId !== "ALL" && p.id !== namaId) return false;
    if (kategori !== "ALL" && (p.categoryNama || "Lainnya") !== kategori) return false;
    return true;
  });
  const slowAll = scopedProducts.map((p) => {
    const last = lastSaleMap[p.id] || null;
    const days = last ? daysSince(last) : Infinity;
    const ra = agg[p.id];
    return { ID: p.id, NAMA: p.nama, KATEGORI: p.categoryNama || "Lainnya", qty: ra ? ra.qty : 0, lastSale: last, days, stok: p.stok };
  }).sort((a, b) => (b.days === Infinity ? 1e9 : b.days) - (a.days === Infinity ? 1e9 : a.days));
  const slowMoving = slowAll.slice(0, 10);
  const deadStock = slowAll.filter((x) => x.days > 30);

  const stockMonitoring = scopedProducts.map((p) => {
    const ra = agg[p.id];
    const qty = ra ? ra.qty : 0;
    const avgSalesPerHari = daysInRange > 0 ? qty / daysInRange : 0;
    const estimasiHari = avgSalesPerHari > 0 ? p.stok / avgSalesPerHari : null;
    return { ID: p.id, NAMA: p.nama, stok: p.stok, qty, avgSalesPerHari, estimasiHari };
  }).sort((a, b) => (a.estimasiHari === null ? 1e9 : a.estimasiHari) - (b.estimasiHari === null ? 1e9 : b.estimasiHari));

  // trend harian
  const trendMap = {};
  rangeRows.forEach((r) => { if (!trendMap[r.TANGGAL]) trendMap[r.TANGGAL] = { omzet: 0, qty: 0 }; trendMap[r.TANGGAL].omzet += r.SUBTOTAL; trendMap[r.TANGGAL].qty += r.QTY; });
  const trend = [];
  if (start && end) {
    let d = new Date(start + "T00:00:00"); const endD = new Date(end + "T00:00:00"); let guard = 0;
    while (d <= endD && guard < 400) {
      const ds = d.toISOString().slice(0, 10);
      trend.push({ date: ds, omzet: trendMap[ds]?.omzet || 0, qty: trendMap[ds]?.qty || 0 });
      d.setDate(d.getDate() + 1); guard++;
    }
  }

  const insights = generateInsights({ detailRows, contributors, slowMoving, deadStock, stockMonitoring, totalPenjualan });

  return {
    kpi: { totalPenjualan, totalQty, totalTransaksi, skuCount, avgPerHari, avgQtyPerTrx, avgBasket, produkAktifTerjual },
    detailRows, fastMoving, contributors, slowMoving, deadStock, stockMonitoring, trend, insights,
  };
}

function generateInsights(d) {
  const list = [];
  if (d.contributors.length) {
    const t = d.contributors[0];
    list.push(`Produk <b>${t.NAMA}</b> adalah kontributor omzet terbesar dengan <b>${t.kontribusi.toFixed(1)}%</b> dari total penjualan pada periode ini.`);
  }
  const stable = d.detailRows.find((p) => p.daysSinceLastSale !== null && p.daysSinceLastSale <= 1 && p.qty >= 5);
  if (stable) list.push(`Produk <b>${stable.NAMA}</b> penjualannya stabil dan masih rutin terjual hingga hari ini.`);
  const deadC = d.slowMoving.find((p) => p.days > 30 && p.days !== Infinity);
  if (deadC) list.push(`Produk <b>${deadC.NAMA}</b> tidak terjual selama <b>${deadC.days} hari</b> dan berpotensi menjadi dead stock.`);
  const never = d.slowMoving.find((p) => p.days === Infinity);
  if (never) list.push(`Produk <b>${never.NAMA}</b> belum pernah tercatat terjual — perlu ditinjau apakah masih relevan dijual.`);
  const crit = d.stockMonitoring.filter((s) => s.estimasiHari !== null && s.estimasiHari <= 7).sort((a, b) => a.estimasiHari - b.estimasiHari)[0];
  if (crit) list.push(`Produk <b>${crit.NAMA}</b> estimasi stok habis dalam <b>${Math.max(0, Math.round(crit.estimasiHari))} hari</b> — pertimbangkan restock segera.`);
  if (!list.length) list.push("Belum cukup data penjualan pada rentang filter ini untuk menghasilkan insight.");
  return list;
}
