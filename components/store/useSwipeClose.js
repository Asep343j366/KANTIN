"use client";
// Geser-ke-bawah untuk menutup lembar (bottom sheet) dari BAGIAN MANA PUN.
// Lembar baru ikut turun bila isi yang bisa di-scroll sudah di posisi paling
// atas (agar scroll isi tetap normal). Lepas > 110px atau sentakan cepat → tutup.
// Listener dipasang native (passive:false) agar bisa mencegah scroll/pull-to-refresh.
import { useEffect, useRef, useState } from "react";

export function useSwipeClose(sheetRef, scrollRef, onClose) {
  const [drag, setDrag] = useState(0);
  const dragRef = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    let y0 = null, t0 = 0, active = false;
    const set = (v) => { dragRef.current = v; setDrag(v); };
    const start = (e) => { y0 = e.touches[0].clientY; t0 = Date.now(); active = false; };
    const move = (e) => {
      if (y0 == null) return;
      const dy = e.touches[0].clientY - y0;
      const sc = scrollRef?.current;
      const atTop = !sc || sc.scrollTop <= 0;
      if (!active) {
        if (dy > 6 && atTop) active = true;              // mulai menyeret lembar
        else if (dy < -6 || (dy > 6 && !atTop)) { y0 = null; return; } // biarkan isi di-scroll
        else return;
      }
      if (e.cancelable) e.preventDefault();
      set(Math.max(0, dy));
    };
    const end = () => {
      if (active) {
        const d = dragRef.current;
        const fast = d > 40 && Date.now() - t0 < 250;
        if (d > 110 || fast) closeRef.current(); else set(0);
      }
      y0 = null; active = false;
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return drag;
}
