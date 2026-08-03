"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore, clearStoreCache } from "@/lib/store";
import Button from "@/components/Button";

const icons = {
  dashboard: "M3 12h4v8H3zM10 6h4v14h-4zM17 3h4v17h-4z",
  transaksi: "M6 2h9l3 3v17H6zM9 8h6M9 12h6M9 16h4",
  menunggu: "M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
  produk: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  inventory: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
  laporan: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  jurnal: "M5 3h11l3 3v15H5zM16 3v3h3M9 12h6M9 16h6",
  bayar: "M2 7h20v10H2zM2 11h20M6 15h4",
  langganan: "M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6-6.3 4.6L7.9 14 2 9.4h7.6z",
  store: "M3 9l1.5-5h15L21 9M4 9h16v11H4zM9 13h6",
  user: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M20 8v6M23 11h-6",
  setting: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 2h-5l-.3 2.9a7 7 0 00-1.7 1l-2.4-1-2 3.4L2.1 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.9h5l.3-2.9a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z",
};

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin", label: "Transaksi", icon: "transaksi" },
  { href: "/admin/pending", label: "Menunggu", icon: "menunggu" },
  { href: "/admin/products", label: "Produk", icon: "produk" },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
  { href: "/admin/reports", label: "Laporan", icon: "laporan" },
  { href: "/admin/journal", label: "Jurnal", icon: "jurnal" },
  { href: "/admin/payment", label: "Pembayaran", icon: "bayar" },
  { href: "/admin/subscription", label: "Langganan", icon: "langganan" },
  { href: "/admin/stores", label: "Kelola Store", icon: "store", platformOnly: true },
  { href: "/admin/users", label: "User", icon: "user" },
  { href: "/admin/settings", label: "Pengaturan", icon: "setting" },
];

function Icon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
  const [store, setStore] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email || ""));
    getMyStore().then(setStore);
  }, []);

  async function logout() {
    setLoggingOut(true);
    clearStoreCache();
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  const current = links.find((l) => (l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href)));

  // Kunci admin bila store nonaktif/suspended (kecuali platform-admin & halaman Langganan)
  const st = store?.store?.status;
  const locked =
    store && !store.is_platform_admin &&
    (st === "nonaktif" || st === "suspended") &&
    !pathname.startsWith("/admin/subscription");

  const Sidebar = (
    <aside className="flex h-full w-52 flex-col border-r border-gray-100 bg-gradient-to-b from-white to-[#F5F8FC]">
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-4">
        <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512.png" alt="Logo" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-soft">
            {store?.is_platform_admin ? "Admin Panel · Platform" : "Admin Panel"}
          </p>
          <p className="truncate text-[13px] font-extrabold text-ink">{store?.store?.nama || "Kantin"}</p>
          {store?.store?.kode_site && (
            <p className="truncate text-[9px] font-semibold text-ink-soft">Site {store.store.kode_site}</p>
          )}
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2.5 py-3">
        {links.filter((l) => !l.platformOnly || store?.is_platform_admin).map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                active
                  ? "bg-gradient-to-r from-primary-light to-[#EEF5FF] text-primary"
                  : "text-ink-soft hover:bg-gray-50"
              }`}>
              <Icon name={l.icon} />{l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 px-3 py-3">
        <p className="mb-2 truncate text-center text-[11px] text-ink-soft">{email}</p>
        <Button variant="primary" loading={loggingOut} onClick={logout} className="btn-xs btn-block">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Logout
        </Button>
        <div className="mt-3 flex flex-col items-center leading-none">
          <span className="text-sm font-extrabold text-ink">iKantin</span>
          <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-ink-soft">Digital Borneo</span>
        </div>
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

      <div className="md:pl-52">
        {/* Header clean */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-white to-[#F5F8FC] px-4 py-3">
          <button onClick={() => setOpen(true)} className="text-ink md:hidden" aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-512.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-base font-extrabold text-ink">{current?.label || "Dashboard"}</h1>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-5">
          {locked ? (
            <div className="card p-6 text-center">
              <h2 className="text-lg font-extrabold">Langganan tidak aktif</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Store ini sedang nonaktif. Perpanjang langganan untuk membuka kembali panel admin & storefront.
              </p>
              <Link href="/admin/subscription" className="btn-primary mt-4 inline-flex">Buka Halaman Langganan</Link>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}
