"use client";
// Favorit pelanggan guest — disimpan di localStorage browser.
const KEY = "kantin_favorites_v1";

export function getFavorites() {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function isFavorite(id) {
  return getFavorites().includes(id);
}

export function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  localStorage.setItem(KEY, JSON.stringify(favs));
  window.dispatchEvent(new Event("fav:update"));
  return favs.includes(id);
}
