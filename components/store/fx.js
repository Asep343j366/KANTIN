"use client";
// Utilitas tampilan storefront premium: animasi "terbang ke keranjang", angka
// bergulir, warna pastel kartu, ikon kategori, sapaan & status buka.
import { useEffect, useRef, useState } from "react";
import { rupiah } from "@/lib/format";

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Titik oranye terbang dari elemen sumber ke target keranjang (#zk-cart-target),
// lalu memicu event "zk:bump" agar bar keranjang memantul.
export function flyToCart(fromEl) {
  if (typeof window === "undefined") return;
  const target = document.getElementById("zk-cart-target") || document.getElementById("zk-nav-cart");
  if (!fromEl || !target || reduced()) { window.dispatchEvent(new Event("zk:bump")); return; }
  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement("div");
  Object.assign(dot.style, {
    position: "fixed", zIndex: 80, width: "16px", height: "16px", borderRadius: "9999px",
    background: "linear-gradient(135deg,#ffa25c,#ff7a2a)", boxShadow: "0 4px 10px rgba(255,122,42,.5)",
    left: `${a.left + a.width / 2 - 8}px`, top: `${a.top + a.height / 2 - 8}px`, pointerEvents: "none",
    transition: "left .55s cubic-bezier(.5,-.3,.7,1), top .55s cubic-bezier(.3,.1,.2,1), transform .55s, opacity .55s",
  });
  document.body.appendChild(dot);
  requestAnimationFrame(() => {
    dot.style.left = `${b.left + 18}px`;
    dot.style.top = `${b.top + b.height / 2 - 8}px`;
    dot.style.transform = "scale(.5)";
    dot.style.opacity = ".7";
  });
  setTimeout(() => { dot.remove(); window.dispatchEvent(new Event("zk:bump")); }, 560);
}

// Kelas animasi "pop" sesaat setiap event zk:bump (untuk bar keranjang / badge).
export function useBump() {
  const [k, setK] = useState(0);
  useEffect(() => {
    const on = () => setK((x) => x + 1);
    window.addEventListener("zk:bump", on);
    return () => window.removeEventListener("zk:bump", on);
  }, []);
  return k;
}

// Angka rupiah yang bergulir halus saat nilainya berubah.
export function RollingRupiah({ value, className = "" }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced() || from.current === value) { setShown(value); from.current = value; return; }
    const start = from.current, diff = value - start, t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 320);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + diff * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{rupiah(shown)}</span>;
}

// Latar pastel bergradasi untuk foto produk (stabil per id).
const TINTS = [
  "from-[#fff3e6] to-[#ffe0c2]", "from-[#e8f6ee] to-[#cdebd9]", "from-[#fde8e1] to-[#f9d2c4]",
  "from-[#ecebfd] to-[#d9d6fa]", "from-[#e6f1fb] to-[#c9def5]", "from-[#fff8dc] to-[#fbe7a6]",
];
export function tintFor(id = "") {
  let h = 0;
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

// Ikon kategori dari namanya (heuristik sederhana).
export function CatIcon({ name = "", size = 18 }) {
  const n = name.toLowerCase();
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (/minum|drink|kopi|teh|jus|es /.test(n + " "))
    return <svg {...p}><path d="M6 8h12l-1.5 12h-9z" /><path d="M5 8h14M12 8V3l3-1" /></svg>;
  if (/snack|camil|jajan|kue|roti|cemil/.test(n))
    return <svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="9.5" cy="10" r="1" /><circle cx="14" cy="13.5" r="1" /><circle cx="10" cy="15" r=".8" /></svg>;
  if (/makan|nasi|mie|food|berat/.test(n))
    return <svg {...p}><path d="M3 11h18a8 8 0 0 1-16 0" /><path d="M8 7c0-1 1-1 1-2M12 7c0-1 1-1 1-2M16 7c0-1 1-1 1-2" /></svg>;
  return <svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

// Status buka dari teks jam operasional bebas ("07.00 - 17.00", "7:00–16:30").
// Teks tak terbaca → { label: teks apa adanya, open: null }.
export function openStatus(text, d = new Date()) {
  if (!text) return null;
  const m = String(text).match(/(\d{1,2})[.:](\d{2})\s*[-–sd/.]+\s*(\d{1,2})[.:](\d{2})/i);
  if (!m) return { open: null, label: String(text) };
  const now = d.getHours() * 60 + d.getMinutes();
  const a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4];
  const open = a <= b ? now >= a && now < b : now >= a || now < b;
  const hhmm = (h, mm) => `${String(h).padStart(2, "0")}.${mm}`;
  return { open, label: `${hhmm(m[1], m[2])}–${hhmm(m[3], m[4])}` };
}

// Ikon kecil yang sering dipakai.
export const Icon = {
  back: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>,
  plus: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  minus: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14" /></svg>,
  heart: (s = 16, filled = false) => <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? "#EF4444" : "none"} stroke={filled ? "#EF4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>,
  flame: (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3.5 5 5.6 5 10.5A5 5 0 0 1 12 18a5 5 0 0 1-5-5.5c0-2.4 1.3-3.6 2.3-4.6.3 1.6 1 2.6 2 3 0-3 .6-5.8.7-8.9z" /></svg>,
  search: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>,
  photo: (s = 34) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3zM3 15l5-5 4 4 3-3 6 6" /></svg>,
  check: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>,
  download: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>,
  upload: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>,
  trash: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>,
  user: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  phone: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>,
  note: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12l-4 4H4z" /><path d="M8 9h8M8 13h5" /></svg>,
  shield: (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>,
  refresh: (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>,
  receipt: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>,
};

// Bar atas halaman: tombol kembali + judul (+ isi kanan opsional).
export function TopBar({ title, onBack, right }) {
  return (
    <div className="flex items-center gap-3 pb-3 pt-4">
      <button onClick={onBack} aria-label="Kembali"
        className="zk-press grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#0f2a5c] shadow-[0_3px_10px_rgba(15,42,92,.12)]">
        {Icon.back()}
      </button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold text-[#14213d]">{title}</h1>
      {right}
    </div>
  );
}

// Indikator langkah checkout (Keranjang · Data · Bayar).
export function StepBar({ step }) {
  const labels = ["Keranjang", "Data", "Bayar"];
  return (
    <div className="mb-4">
      <div className="flex gap-1.5">
        {labels.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#d9dfec]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ffa25c] to-[#ff7a2a] transition-all duration-500"
              style={{ width: i < step ? "100%" : "0%" }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold">
        {labels.map((l, i) => <span key={l} className={i < step ? "text-[#0f2a5c]" : "text-[#9aa3b8]"}>{l}</span>)}
      </div>
    </div>
  );
}

// Konfeti kecil (sekali) untuk momen pembayaran berhasil.
export function Confetti() {
  if (reduced()) return null;
  const colors = ["#ffb36b", "#ff7a2a", "#3dd6f5", "#22c55e", "#ffffff", "#f9d2c4"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 22 }).map((_, i) => {
        const x = (Math.random() * 2 - 1) * 170, y = 60 + Math.random() * 180, r = Math.random() * 540 - 270;
        return (
          <span key={i} className="absolute left-1/2 top-16 h-2 w-1.5 rounded-sm"
            style={{ background: colors[i % colors.length], "--x": `${x}px`, "--y": `${y}px`, "--r": `${r}deg`,
              animation: `zkConfetti ${0.9 + Math.random() * 0.7}s cubic-bezier(.2,.7,.4,1) ${0.15 + Math.random() * 0.25}s both` }} />
        );
      })}
    </div>
  );
}
