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
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const jsQR = (await import("jsqr")).default;
  const res = jsQR(data, w, h, { inversionAttempts: "attemptBoth" });
  const txt = res?.data || "";
  if (txt) {
    try { sessionStorage.setItem(key, txt); } catch {}
  }
  return txt;
}

// Hook: gambar QRIS statis + nominal → data-URL QR bernominal, atau "" (fallback ke gambar asli).
export function useAmountQris(imageUrl, amount, enabled = true) {
  const [img, setImg] = useState("");
  useEffect(() => {
    setImg("");
    if (!enabled || !imageUrl || !(amount > 0)) return;
    let alive = true;
    (async () => {
      try {
        const raw = await decodeQrFromUrl(imageUrl);
        const dyn = toAmountQris(raw, amount);
        if (!dyn) return;
        const out = await QRCode.toDataURL(dyn, { width: 280, margin: 1 });
        if (alive) setImg(out);
      } catch {
        // diam: tetap pakai gambar statis
      }
    })();
    return () => { alive = false; };
  }, [imageUrl, amount, enabled]);
  return img;
}
