"use client";
// QRIS statis → QRIS bernominal (tanpa layanan luar).
//
// Isi QRIS = teks EMVCo TLV (ID 2 digit + panjang 2 digit + nilai), diakhiri CRC16.
// Untuk mengisi nominal otomatis: tag 01 "11"(statis) → "12"(dinamis), sisipkan
// tag 54 (nominal), buang tag 55–57 (tip), lalu hitung ulang CRC (tag 63).
//
// AMAN-GAGAL: bila gambar tak terbaca / bukan QRIS valid / proses apa pun error,
// hook mengembalikan "" → halaman tetap menampilkan gambar QRIS statis asli
// (perilaku lama). Tidak ada perubahan server/DB.
import { useEffect, useState } from "react";
import QRCode from "qrcode";

function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function parseTlv(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const id = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len) || i + 4 + len > s.length) return null;
    out.push({ id, value: s.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

const tlv = (id, value) => id + String(value.length).padStart(2, "0") + value;

// Kembalikan teks QRIS bernominal, atau null bila input bukan QRIS yang valid.
export function toAmountQris(raw, amount) {
  const s = String(raw || "").trim();
  const amt = Math.round(Number(amount));
  if (!s.startsWith("000201") || !(amt > 0)) return null;
  // Validasi CRC asli — tolak teks yang bukan QRIS utuh.
  if (s.slice(-8, -4) !== "6304" || crc16(s.slice(0, -4)) !== s.slice(-4).toUpperCase()) return null;
  const tags = parseTlv(s.slice(0, -8));
  if (!tags || !tags.some((t) => t.id === "58")) return null;

  const kept = tags
    .filter((t) => !["54", "55", "56", "57"].includes(t.id))
    .map((t) => (t.id === "01" ? { id: "01", value: "12" } : t));
  if (!kept.some((t) => t.id === "01")) kept.splice(1, 0, { id: "01", value: "12" });
  kept.push({ id: "54", value: String(amt) });
  kept.sort((a, b) => Number(a.id) - Number(b.id)); // urutan tag menaik

  const body = kept.map((t) => tlv(t.id, t.value)).join("") + "6304";
  return body + crc16(body);
}

// Baca teks QR dari URL gambar (jsQR dimuat hanya saat dibutuhkan).
async function decodeQrFromUrl(url) {
  const key = "qris_txt:" + url;
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return hit;
  } catch {}
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const jsQR = (await import("jsqr")).default;
  // Coba beberapa ukuran: satu gambar bisa gagal terbaca di ukuran tertentu
  // tapi berhasil di ukuran lain (terbukti pada QRIS salah satu store).
  let txt = "";
  for (const max of [800, 600, 1200, 400]) {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0, w, h);
    const res = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" });
    if (res?.data && toAmountQris(res.data, 1)) { txt = res.data; break; }
  }
  if (txt) {
    try { sessionStorage.setItem(key, txt); } catch {}
  }
  return txt;
}

// Hook: gambar QRIS statis + nominal → { qr, loading }.
//  - loading=true selama memproses → halaman tampilkan placeholder (JANGAN
//    gambar statis, agar tak terlihat "tertimpa" saat QR bernominal siap).
//  - qr = data-URL QR bernominal; "" bila gagal → halaman pakai gambar statis asli.
export function useAmountQris(imageUrl, amount, enabled = true) {
  const active = !!(enabled && imageUrl && amount > 0);
  const key = active ? `${imageUrl}|${amount}` : "";
  // done = key yang SUDAH selesai diproses. Selama done !== key → masih loading
  // (termasuk render pertama setelah gambar/nominal berubah — tanpa kedip statis).
  const [res, setRes] = useState({ done: "", qr: "" });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const finish = (qr) => { if (alive) setRes((r) => (r.done === key && (r.qr || !qr) ? r : { done: key, qr })); };
    // Batas aman: bila proses macet > 8 dtk, tampilkan gambar statis.
    const guard = setTimeout(() => finish(""), 8000);
    (async () => {
      let out = "";
      try {
        const raw = await decodeQrFromUrl(imageUrl);
        const dyn = toAmountQris(raw, amount);
        if (dyn) out = await QRCode.toDataURL(dyn, { width: 280, margin: 1 });
      } catch {
        // gagal → tetap pakai gambar statis
      }
      clearTimeout(guard);
      finish(out);
    })();
    return () => { alive = false; clearTimeout(guard); };
  }, [key, imageUrl, amount]);
  if (!key) return { qr: "", loading: false };
  return res.done === key ? { qr: res.qr, loading: false } : { qr: "", loading: true };
}
