"use client";
// Carousel banner promo: geser manual (scroll-snap) + otomatis tiap 4 dtk
// (berhenti sementara saat disentuh). Titik penanda di bawah.
import { useEffect, useRef, useState } from "react";
import PromoBanner from "@/components/store/PromoBanner";
import { sisaKuota } from "@/lib/promo";

export default function PromoCarousel({ promos, prodMap, usage, onOpen }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const pause = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || promos.length < 2) return;
    const onScroll = () => {
      const w = el.firstElementChild?.getBoundingClientRect().width || 1;
      setIdx(Math.round(el.scrollLeft / (w + 12)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = reduce ? null : setInterval(() => {
      if (Date.now() < pause.current || document.hidden) return;
      const w = el.firstElementChild?.getBoundingClientRect().width || 0;
      const n = Math.round(el.scrollLeft / (w + 12));
      const next = n + 1 >= promos.length ? 0 : n + 1;
      el.scrollTo({ left: next * (w + 12), behavior: "smooth" });
    }, 4000);
    return () => { el.removeEventListener("scroll", onScroll); if (t) clearInterval(t); };
  }, [promos.length]);

  if (!promos.length) return null;
  const hold = () => { pause.current = Date.now() + 7000; };

  return (
    <section className="mt-3">
      <div ref={ref} onTouchStart={hold} onMouseDown={hold}
        className="no-scrollbar mx-auto flex max-w-md snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1">
        {promos.map((p, i) => (
          <div key={p.id} className={`zk-up shrink-0 snap-start ${promos.length > 1 ? "w-[88%]" : "w-full"}`} style={{ animationDelay: `${i * 0.06}s` }}>
            <PromoBanner promo={p} prodMap={prodMap} sisa={sisaKuota(p, usage)} onClick={() => onOpen(p)} className="zk-press" />
          </div>
        ))}
      </div>
      {promos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {promos.map((p, i) => (
            <span key={p.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-5 bg-[#0f2a5c]" : "w-1.5 bg-[#c9d1e3]"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
