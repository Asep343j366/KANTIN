"use client";
// Kompres foto di sisi browser sebelum diupload (hemat storage & kuota).
// Mengecilkan dimensi & meng-encode ulang ke JPEG berkualitas sedang.
export async function compressImage(file, opts = {}) {
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.7 } = opts;
  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  try {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // latar putih agar PNG transparan tidak jadi hitam
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;
    const name = (file.name || "foto").replace(/\.\w+$/, "") + ".jpg";
    const out = new File([blob], name, { type: "image/jpeg" });
    return out.size < file.size ? out : file;
  } catch {
    return file; // jika gagal, pakai file asli
  }
}
