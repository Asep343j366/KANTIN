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
  const base = storePath(slug);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur">
      <div className="container-app flex items-center justify-around py-2">
        {items.map((it) => {
          const href = storePath(slug, it.sub);
          const active = it.sub === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={it.sub}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-medium ${
                active ? "text-primary" : "text-ink-soft"
              }`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={it.icon} />
              </svg>
              {it.label}
              {it.sub === "/cart" && count > 0 && (
                <span className="absolute right-4 top-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
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
