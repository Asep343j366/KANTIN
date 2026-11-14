"use client";
// Laporan Kas Bulanan (PDF asli, A4) untuk dilaporkan admin ke Area Manager.
// Bagian: kop + identitas, 1 Ringkasan, 2 Rekonsiliasi saldo, 3 Rincian kategori,
// 4 Mutasi kas non-penjualan, 5 Arus kas harian, 6 Catatan,
// dan blok validasi digital (kode verifikasi dari angka utama — tanpa tanda tangan).
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/sbPaginate";

const NAVY = [15, 42, 92], ORANGE = [255, 138, 61], INK = [30, 42, 58], MUTED = [100, 116, 139];
const LIGHT = [238, 242, 248], GREEN = [22, 163, 74], RED = [220, 38, 38], TEAL = [14, 116, 144];
const nf = (n) => Math.round(Number(n) || 0).toLocaleString("id-ID");
const rp = (n) => `Rp${nf(n)}`;
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ymdLocal = (d) => new Date(d).toLocaleDateString("en-CA");
const tglPendek = (d) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

async function sha8(text) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
  } catch { return "—"; }
}

async function imageDataUrl(url) {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(blob); });
  } catch { return null; }
}

// Jumlah transaksi (order selesai) bulan itu.
async function salesOfMonth(storeId, bulan) {
  const [y, mo] = bulan.split("-").map(Number);
  const startIso = new Date(y, mo - 1, 1).toISOString();
  const endIso = new Date(y, mo, 1).toISOString();
  const orders = await fetchAllRows(() => supabase.from("orders").select("id").eq("store_id", storeId)
    .eq("status", "selesai").gte("created_at", startIso).lt("created_at", endIso).order("id", { ascending: true }));
  return { trx: orders.length };
}

/**
 * @param {object} o
 *  store: {id, kode_site, nama, nama_store}, m: {bulan, saldoAwal, masuk, keluar, sisa},
 *  txs: transaksi jurnal bulan itu (urut naik, berisi saldoBerjalan),
 *  omzet, laba (bulan itu), adminEmail, catatan, logoUrl, appName
 */
export async function downloadMonthlyReport(o) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = [autoTableMod.default, autoTableMod.default?.default, autoTableMod.autoTable].find((x) => typeof x === "function");
  const { store, m, txs } = o;
  const [yy, mm] = m.bulan.split("-").map(Number);
  const periodeTeks = `${BULAN[mm - 1]} ${yy}`;
  const lastDay = new Date(yy, mm, 0).getDate();
  const kode = store.kode_site || "-";
  const namaStore = store.nama_store || store.nama || kode;
  const noLap = `KAS/${kode}/${m.bulan}`;
  const now = new Date();
  const dicetak = now.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const omzet = Number(o.omzet) || 0, laba = Number(o.laba) || 0, hpp = Math.max(0, omzet - laba);
  const margin = omzet > 0 ? (laba / omzet) * 100 : 0;
  const { trx } = await salesOfMonth(store.id, m.bulan);
  const kodeVerif = await sha8(`${noLap}|${m.saldoAwal}|${m.masuk}|${m.keluar}|${m.sisa}|${omzet}|${laba}`);
  const logo = o.logoUrl ? await imageDataUrl(o.logoUrl) : null;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, L = 14, R = 196;
  let y;

  // ---------- Kop ----------
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 30, "F");
  if (logo) { try { doc.addImage(logo, "PNG", L, 7, 16, 16); } catch { /* abaikan */ } }
  if (!logo) { doc.setFillColor(...ORANGE); doc.roundedRect(L, 7, 16, 16, 3, 3, "F"); doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("D", L + 8, 18, { align: "center" }); }
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("LAPORAN KAS BULANAN", L + 21, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(184, 196, 221);
  doc.text(`Kantin Kejujuran · ${o.appName || "DKantin"}`, L + 21, 20);
  doc.text(`No. ${noLap}`, R, 13, { align: "right" });
  doc.text(`Periode ${periodeTeks}`, R, 19, { align: "right" });

  // ---------- Identitas ----------
  autoTable(doc, {
    startY: 35, theme: "plain", margin: { left: L, right: W - R },
    styles: { fontSize: 9, cellPadding: { top: 0.8, bottom: 0.8, left: 0, right: 2 }, textColor: INK },
    columnStyles: { 0: { textColor: MUTED, cellWidth: 30 }, 1: { fontStyle: "bold", cellWidth: 70 }, 2: { textColor: MUTED, cellWidth: 24 } },
    body: [
      ["Site / Store", `${kode} · ${namaStore}`, "Periode", `1 – ${lastDay} ${periodeTeks}`],
      ["Nama kantin", store.nama || "-", "Dicetak", dicetak],
      ["Disusun oleh", namaStore, "Kepada", "Area Manager"],
    ],
  });
  y = doc.lastAutoTable.finalY + 7;

  const section = (title) => {
    if (y > 262) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY);
    doc.text(title, L, y);
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(L, y + 1.6, R, y + 1.6);
    y += 5;
  };
  const boxes = (items) => {
    const gap = 3, w = (R - L - gap * 3) / 4, h = 15;
    items.forEach((it, i) => {
      const x = L + i * (w + gap);
      if (it.dark) { doc.setFillColor(...NAVY); doc.roundedRect(x, y, w, h, 1.5, 1.5, "F"); }
      else { doc.setDrawColor(217, 224, 236); doc.setLineWidth(0.3); doc.roundedRect(x, y, w, h, 1.5, 1.5, "S"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...(it.dark ? [184, 196, 221] : MUTED));
      doc.text(it.label, x + 2.5, y + 5);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...(it.dark ? [255, 255, 255] : (it.color || INK)));
      doc.text(it.value, x + 2.5, y + 11.2);
    });
    y += h + 3;
  };
  const afterBoxes = () => { y += 6; // ruang sebelum judul seksi berikutnya (teks digambar dari garis dasar)
  };
  const tableBase = {
    margin: { left: L, right: W - R }, theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.6, textColor: INK, lineColor: [226, 231, 240], lineWidth: 0.2 },
    headStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: "bold" },
    footStyles: { fillColor: [246, 248, 252], textColor: INK, fontStyle: "bold" },
  };

  // ---------- 1. Ringkasan ----------
  section("1. RINGKASAN");
  boxes([
    { label: "Saldo awal", value: rp(m.saldoAwal) },
    { label: "Pemasukan", value: `+${rp(m.masuk)}`, color: GREEN },
    { label: "Pengeluaran", value: `-${rp(m.keluar)}`, color: RED },
    { label: "Saldo akhir", value: rp(m.sisa), dark: true },
  ]);
  boxes([
    { label: "Omzet penjualan", value: rp(omzet) },
    { label: "HPP", value: rp(hpp) },
    { label: `Laba kotor · margin ${margin.toFixed(1).replace(".", ",")}%`, value: rp(laba), color: TEAL },
    { label: "Transaksi · rata-rata", value: `${nf(trx)} · ${rp(trx ? omzet / trx : 0)}` },
  ]);
  afterBoxes();

  // ---------- 2. Rekonsiliasi ----------
  section("2. REKONSILIASI SALDO KAS");
  autoTable(doc, {
    ...tableBase, startY: y, theme: "striped", showHead: false,
    columnStyles: { 1: { halign: "right", cellWidth: 45 } },
    body: [
      [`Saldo awal per 1 ${periodeTeks}`, nf(m.saldoAwal)],
      ["Ditambah: total pemasukan", nf(m.masuk)],
      ["Dikurangi: total pengeluaran", `(${nf(m.keluar)})`],
    ],
    foot: [[`Saldo akhir per ${lastDay} ${periodeTeks}`, nf(m.sisa)]],
    footStyles: { ...tableBase.footStyles, halign: "left" },
    didParseCell: (d) => { if (d.section === "foot" && d.column.index === 1) d.cell.styles.halign = "right"; },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ---------- 3. Rincian kategori ----------
  section("3. RINCIAN PER KATEGORI");
  const byCat = (jenis) => {
    const g = {}; txs.filter((t) => t.jenis === jenis).forEach((t) => { g[t.kategori || "Lainnya"] = (g[t.kategori || "Lainnya"] || 0) + t.jumlah; });
    const tot = Object.values(g).reduce((s, v) => s + v, 0);
    const rows = Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, nf(v), tot ? ((v / tot) * 100).toFixed(1).replace(".", ",") : "0"]);
    return { rows: rows.length ? rows : [["-", "0", "0"]], tot };
  };
  const cin = byCat("masuk"), cout = byCat("keluar");
  const half = (R - L - 6) / 2, catY = y;
  const catTable = (title, c, left) => autoTable(doc, {
    ...tableBase, startY: catY, margin: { left, right: W - (left + half) }, tableWidth: half,
    head: [[title, "Rp", "%"]], body: c.rows, foot: [["Total", nf(c.tot), c.tot ? "100" : "0"]],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right", cellWidth: 14 } },
    didParseCell: (d) => { if ((d.section === "head" || d.section === "foot") && d.column.index > 0) d.cell.styles.halign = "right"; },
  });
  catTable("Pemasukan", cin, L); const y1 = doc.lastAutoTable.finalY;
  catTable("Pengeluaran", cout, L + half + 6); const y2 = doc.lastAutoTable.finalY;
  y = Math.max(y1, y2) + 6;

  // ---------- 4. Mutasi non-penjualan ----------
  section("4. MUTASI KAS NON-PENJUALAN");
  const nonSales = txs.filter((t) => !(t.kategori === "Penjualan" && t.order_id));
  const nsIn = nonSales.filter((t) => t.jenis === "masuk").reduce((s, t) => s + t.jumlah, 0);
  const nsOut = nonSales.filter((t) => t.jenis === "keluar").reduce((s, t) => s + t.jumlah, 0);
  autoTable(doc, {
    ...tableBase, startY: y, head: [["Tanggal", "Kategori", "Keterangan", "Masuk", "Keluar"]],
    body: nonSales.length ? nonSales.map((t) => [tglPendek(t.created_at), t.kategori || "-", t.keterangan || "-",
      t.jenis === "masuk" ? nf(t.jumlah) : "", t.jenis === "keluar" ? nf(t.jumlah) : ""]) : [["-", "-", "Tidak ada mutasi non-penjualan", "", ""]],
    foot: [["", "", "Total", nf(nsIn), nf(nsOut)]],
    columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 26 }, 3: { halign: "right", cellWidth: 24 }, 4: { halign: "right", cellWidth: 24 } },
    didParseCell: (d) => { if ((d.section === "head" || d.section === "foot") && d.column.index >= 3) d.cell.styles.halign = "right"; },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ---------- 6. Penjualan harian ----------
  section("5. ARUS KAS HARIAN");
  const days = {};
  txs.forEach((t) => {
    const k = ymdLocal(t.created_at);
    days[k] = days[k] || { n: 0, rp: 0, out: 0, lain: 0, saldo: 0 };
    if (t.kategori === "Penjualan" && t.order_id && t.jenis === "masuk") { days[k].n++; days[k].rp += t.jumlah; }
    else if (t.jenis === "keluar") days[k].out += t.jumlah;
    else days[k].lain += t.jumlah; // pemasukan lain (non-penjualan) — tetap memengaruhi saldo
    days[k].saldo = t.saldoBerjalan; // saldo akhir hari (tx terakhir hari itu)
  });
  const dayRows = Object.entries(days).sort((a, b) => a[0].localeCompare(b[0]));
  const sumBy = (key) => dayRows.reduce((s, [, v]) => s + v[key], 0);
  autoTable(doc, {
    ...tableBase, startY: y, head: [["Tanggal", "Transaksi", "Penjualan", "Pengeluaran", "Saldo akhir hari"]],
    body: dayRows.length
      ? dayRows.map(([k, v]) => [tglPendek(k + "T00:00:00"), nf(v.n), v.rp ? nf(v.rp) : "-", v.out ? nf(v.out) : "-", nf(v.saldo)])
      : [["-", "0", "-", "-", "-"]],
    foot: [["Total", nf(sumBy("n")), nf(sumBy("rp")), nf(sumBy("out")), nf(m.sisa)]],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    didParseCell: (d) => {
      if ((d.section === "head" || d.section === "foot") && d.column.index >= 1) d.cell.styles.halign = "right";
      if (d.section === "body" && (d.column.index === 2 || d.column.index === 3) && d.cell.raw === "-") d.cell.styles.textColor = [160, 170, 186];
      else if (d.section === "body" && d.column.index === 3) d.cell.styles.textColor = RED;
    },
  });
  y = doc.lastAutoTable.finalY + 4;
  if (sumBy("lain") > 0) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`Saldo akhir hari juga memperhitungkan pemasukan lain non-penjualan (${rp(sumBy("lain"))}, rinciannya di bagian 4).`, L, y);
    y += 3;
  }
  y += 4;

  // ---------- 7. Catatan ----------
  if (o.catatan && o.catatan.trim()) {
    section("6. CATATAN");
    const lines = doc.splitTextToSize(o.catatan.trim(), R - L - 6);
    const h = lines.length * 4.2 + 5;
    if (y + h > 280) { doc.addPage(); y = 18; }
    doc.setDrawColor(201, 210, 226); doc.setLineWidth(0.3); doc.roundedRect(L, y, R - L, h, 1.5, 1.5, "S");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK);
    doc.text(lines, L + 3, y + 5.5);
    y += h + 6;
  }

  // ---------- Validasi digital (pengganti tanda tangan) ----------
  if (y > 255) { doc.addPage(); y = 18; }
  doc.setFillColor(246, 248, 252); doc.setDrawColor(...NAVY); doc.setLineWidth(0.3);
  doc.roundedRect(L, y, R - L, 22, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
  doc.text("VALIDASI DOKUMEN DIGITAL", L + 4, y + 6);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...INK);
  doc.text("Dokumen ini dibuat otomatis oleh sistem dari data jurnal kas & penjualan, sah tanpa tanda tangan.", L + 4, y + 11);
  doc.text(`Disusun oleh: ${kode} · ${namaStore}   ·   Diunduh oleh: ${o.adminEmail || "-"}   ·   ${dicetak}`, L + 4, y + 15.5);
  doc.setFont("helvetica", "bold");
  doc.text(`Kode verifikasi: ${kodeVerif}`, L + 4, y + 20);

  // ---------- Kaki halaman ----------
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(L, 287, R, 287);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text(`${o.appName || "DKantin"} · Laporan Kas Bulanan · ${kode} · ${noLap}`, L, 291);
    doc.text(`Halaman ${i} / ${n}`, R, 291, { align: "right" });
  }

  doc.save(`Laporan-Kas-${kode}-${m.bulan}.pdf`);
  return { kodeVerif, pages: n };
}
