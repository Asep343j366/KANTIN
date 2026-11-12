"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCart, cartCount } from "@/lib/cart";
import { slugFromPath, storePath } from "@/lib/slug";

const items = [
  { sub: "", label: "Menu", icon: "M3 9.5 12 3l9 6.5V21H3z" },
  { sub: "/cart", label: "Keranjang", icon: "M3 3h2l2 13h11l2-9H6" },
  { sub: "/order", label: "Pesanan", icon: "M9 5h6M4 7h16v13H4zM9 11h6M9 15h4" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const upd = () => setCount(cartCount(getCart()));
    upd();
    window.addEventListener("cart:update", upd);
    return () => window.removeEventListener("cart:update", upd);
  }, [pathname]);

  const slug = slugFromPath(pathname);
  // Hanya tampil di storefront sebuah store (/s/<slug>/...)
  if (!slug) return null;
  // Sembunyikan di layar TV (dashboard publik layar penuh).
  if (pathname.endsWith("/tv")) return null;
  const base = storePath(slug);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl bg-white/95 shadow-[0_-6px_20px_rgba(15,42,92,.08)] backdrop-blur">
      <div className="container-app flex items-center justify-around pb-2.5 pt-2">
        {items.map((it) => {
          const href = storePath(slug, it.sub);
          const active = it.sub === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={it.sub}
              href={href}
              id={it.sub === "/cart" ? "zk-nav-cart" : undefined}
              className={`zk-press relative flex flex-1 flex-col items-center gap-1 py-0.5 text-[11px] font-bold transition-colors ${
                active ? "text-[#0f2a5c]" : "text-[#9aa3b8]"
              }`}
            >
              <span className={`grid h-9 w-14 place-items-center rounded-2xl transition-all duration-300 ${active ? "bg-[#e1e8f6]" : ""}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={it.icon} />
                </svg>
              </span>
              {it.label}
              {it.sub === "/cart" && count > 0 && (
                <span key={count} className="zk-pop absolute right-[22%] top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-br from-[#ff9447] to-[#f0631c] px-1 text-[10px] font-extrabold text-white shadow">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
