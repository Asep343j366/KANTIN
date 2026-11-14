// Thumbnail foto (hemat cached egress Supabase). Foto produk & logo punya versi
// kecil di "<bucket>/thumbs/<nama file sama>" (360px utk produk, 256px utk logo).
// Daftar menu/kartu/TV/keranjang memakai thumbnail; foto penuh hanya di detail.
// Bila thumbnail belum ada (mis. foto lama), <img onError> jatuh ke foto penuh.
const RE = /(\/storage\/v1\/object\/public\/(?:products|qris)\/)(?!thumbs\/)([^/?]+)/;

export function thumbUrl(url) {
  if (!url) return url;
  return String(url).replace(RE, "$1thumbs/$2");
}

// Pakai di <img onError={thumbFallback(fullUrl)}>: sekali saja ganti ke foto penuh.
export function thumbFallback(full) {
  return (e) => {
    const img = e.currentTarget;
    if (!full || img.dataset.fb) return;
    img.dataset.fb = "1";
    img.src = full;
  };
}

// Buat + unggah thumbnail utk file yang baru diunggah ke `bucket/path`.
// Gagal membuat thumbnail tidak menggagalkan upload utama (fallback ke foto penuh).
export async function uploadThumb(supabase, bucket, path, file, { png = false } = {}) {
  try {
    const { compressImage } = await import("@/lib/compressImage");
    const max = png ? 256 : 360;
    const small = await compressImage(file, { maxWidth: max, maxHeight: max, quality: 0.62, type: png ? "image/png" : "image/jpeg", always: true });
    await supabase.storage.from(bucket).upload(`thumbs/${path.split("/").pop()}`, small,
      { upsert: true, cacheControl: "31536000", contentType: png ? "image/png" : "image/jpeg" });
  } catch {}
}
