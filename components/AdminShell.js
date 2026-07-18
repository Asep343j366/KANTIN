"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const icons = {
  dashboard: "M3 12h4v8H3zM10 6h4v14h-4zM17 3h4v17h-4z",
  transaksi: "M6 2h9l3 3v17H6zM9 8h6M9 12h6M9 16h4",
  produk: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  inventory: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
  laporan: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  jurnal: "M5 3h11l3 3v15H5zM16 3v3h3M9 12h6M9 16h6",
  user: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M20 8v6M23 11h-6",
  setting: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 2h-5l-.3 2.9a7 7 0 00-1.7 1l-2.4-1-2 3.4L2.1 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.9h5l.3-2.9a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z",
};

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin", label: "Transaksi", icon: "transaksi" },
  { href: "/admin/products", label: "Produk", icon: "produk" },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
  { href: "/admin/reports", label: "Laporan", icon: "laporan" },
  { href: "/admin/journal", label: "Jurnal", icon: "jurnal" },
  { href: "/admin/users", label: "User", icon: "user" },
  { href: "/admin/settings", label: "Pengaturan", icon: "setting" },
];

function Icon({ name }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={icons[name]} />
    </svg>
  );
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  const current = links.find((l) => (l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href)));

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col bg-gradient-to-b from-[#0F4575] to-[#0A2E4F] text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-white/95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.PNG" alt="Logo" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Admin Panel</p>
          <p className="truncate text-sm font-extrabold">Big Mall Kantin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {links.map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active ? "bg-white text-[#0F4575] shadow-card" : "text-white/80 hover:bg-white/10"
              }`}>
              <Icon name={l.icon} />{l.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 pb-5 pt-2">
        <p className="mb-2 truncate px-1 text-[11px] text-white/60">{email}</p>
        <button onClick={logout} className="btn w-full bg-primary text-white hover:bg-primary-dark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar desktop */}
      <div className="fixed inset-y-0 left-0 z-40 hidden md:block">{Sidebar}</div>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">{Sidebar}</div>
        </div>
      )}

      <div className="md:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-r from-[#0F4575] to-[#12558C] px-4 py-3 text-white shadow-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="md:hidden" aria-label="Menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-white/95 md:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.PNG" alt="Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Admin</p>
              <h1 className="text-base font-extrabold leading-tight">{current?.label || "Dashboard"}</h1>
            </div>
          </div>
          <button onClick={logout} className="btn bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Logout
          </button>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-5">{children}</main>
      </div>
    </div>
  );
}
