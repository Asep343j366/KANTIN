"use client";
// Potong tengah jadi persegi & perkecil ke `size` px PNG (transparansi tetap).
export async function toSquarePng(file, size = 512) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - side) / 2, sy = (bmp.height - side) / 2;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
  return await new Promise((res) => c.toBlob(res, "image/png"));
}
