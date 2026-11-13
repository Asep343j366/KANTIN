"use client";
// Keranjang sederhana berbasis localStorage + event untuk sinkronisasi antar komponen.
// Multi-store: key keranjang dipisah per store (diambil dari slug di URL /s/<slug>/...)
// supaya isi keranjang tak tercampur antar toko.
function cartKey() {
  if (typeof window === "undefined") return "kantin_cart_v1";
  const m = window.location.pathname.match(/\/s\/([^/]+)/);
  return m ? `kantin_cart_${m[1]}` : "kantin_cart_v1";
}

export function getCart() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(cartKey()) || "[]");
  } catch {
    return [];
  }
}

function save(items) {
  localStorage.setItem(cartKey(), JSON.stringify(items));
  window.dispatchEvent(new Event("cart:update"));
}

// promo (opsional) = promo diskon aktif untuk produk ini → harga diskon dipakai,
// harga normal & promo_id disimpan agar checkout bisa memvalidasi ulang.
export function addToCart(product, qty = 1, note = "", promo = null) {
  const items = getCart();
  const idx = items.findIndex((i) => i.id === product.id && i.note === note);
  const harga = promo ? promo.harga : product.harga;
  if (idx >= 0) {
    items[idx].qty += qty;
    items[idx].harga = harga;
    items[idx].harga_normal = product.harga;
    items[idx].promo_id = promo?.id || null;
  } else {
    items.push({
      id: product.id,
      nama: product.nama,
      harga,
      harga_normal: product.harga,
      promo_id: promo?.id || null,
      foto_url: product.foto_url,
      qty,
      note,
    });
  }
  save(items);
}

// Paket bundling = SATU baris keranjang (id "promo:<id>"). components = isi paket
// [{product_id, nama, qty, harga_normal}] — dipecah per menu saat checkout.
export function addBundle(promo, components, foto_url, qty = 1) {
  const items = getCart();
  const id = `promo:${promo.id}`;
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) items[idx].qty += qty;
  else items.push({
    id, bundle: true, promo_id: promo.id, nama: promo.nama, harga: promo.harga_paket,
    harga_normal: components.reduce((s, c) => s + c.harga_normal * c.qty, 0),
    components, foto_url: foto_url || null, qty, note: "",
  });
  save(items);
}

// Ganti seluruh isi keranjang (dipakai checkout setelah validasi harga promo).
export function setCart(items) { save(items); }

export function updateQty(index, qty) {
  const items = getCart();
  if (!items[index]) return;
  items[index].qty = Math.max(1, qty);
  save(items);
}

export function removeItem(index) {
  const items = getCart();
  items.splice(index, 1);
  save(items);
}

export function clearCart() {
  save([]);
}

// Qty item polos (tanpa catatan) berdasarkan id — dipakai stepper di kartu menu.
export function getQtyById(id) {
  const it = getCart().find((i) => i.id === id && !i.note);
  return it ? it.qty : 0;
}

export function decById(id) {
  const items = getCart();
  const idx = items.findIndex((i) => i.id === id && !i.note);
  if (idx < 0) return;
  if (items[idx].qty > 1) items[idx].qty -= 1;
  else items.splice(idx, 1);
  save(items);
}

export function cartTotal(items) {
  return (items || getCart()).reduce((s, i) => s + i.harga * i.qty, 0);
}

export function cartCount(items) {
  return (items || getCart()).reduce((s, i) => s + i.qty, 0);
}
