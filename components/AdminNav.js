"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const links = [
  { href: "/admin", label: "Pesanan" },
  { href: "/admin/products", label: "Produk" },
  { href: "/admin/settings", label: "Pengaturan" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }
  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <span className="font-extrabold text-primary">Admin Kantin</span>
        <button onClick={logout} className="text-sm font-semibold text-ink-soft">Keluar</button>
      </div>
      <nav className="mx-auto flex max-w-3xl gap-1 px-4 pb-2">
        {links.map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${active ? "bg-primary-light text-primary" : "text-ink-soft"}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
