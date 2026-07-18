"use client";
// Keranjang sederhana berbasis localStorage + event untuk sinkronisasi antar komponen.
const KEY = "kantin_cart_v1";

export function getCart() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart:update"));
}

export function addToCart(product, qty = 1, note = "") {
  const items = getCart();
  const idx = items.findIndex((i) => i.id === product.id && i.note === note);
  if (idx >= 0) {
    items[idx].qty += qty;
  } else {
    items.push({
      id: product.id,
      nama: product.nama,
      harga: product.harga,
      foto_url: product.foto_url,
      qty,
      note,
    });
  }
  save(items);
}

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
