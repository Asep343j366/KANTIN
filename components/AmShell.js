"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyAm, clearAmCache } from "@/lib/am";
import Button from "@/components/Button";

const icons = {
  area: "M3 12h4v8H3zM10 6h4v14h-4zM17 3h4v17h-4z",
  store: "M3 9l1.5-5h15L21 9M4 9h16v11H4zM9 13h6",
};

const links = [
  { href: "/am/area", label: "Dashboard Area", icon: "area" },
  { href: "/am/store", label: "Dashboard Store", icon: "store" },
];

function Icon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>
  );
}

export default function AmShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [am, setAm] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { getMyAm().then(setAm); }, []);

  async function logout() {
    setLoggingOut(true);
    clearAmCache();
    await supabase.auth.signOut();
    router.replace("/am/login");
  }

  const current = links.find((l) => pathname.startsWith(l.href));

  const Sidebar = (
    <aside className="flex h-full w-52 flex-col border-r border-gray-100 bg-gradient-to-b from-white to-[#F5F8FC]">
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-4">
        <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512.png" alt="Logo" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-soft">Area Manager</p>
          <p className="truncate text-[13px] font-extrabold text-ink">{am?.nama || "Controlling"}</p>
          <p className="truncate text-[9px] font-semibold text-ink-soft">{am?.sites?.length || 0} store dipantau</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2.5 py-3">
        {links.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                active ? "bg-gradient-to-r from-primary-light to-[#EEF5FF] text-primary" : "text-ink-soft hover:bg-gray-50"
              }`}>
              <Icon name={l.icon} />{l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 px-3 py-3">
        <p className="mb-2 truncate text-center text-[11px] text-ink-soft">{am?.email}</p>
        <Button variant="primary" loading={loggingOut} onClick={logout} className="btn-xs btn-block">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Logout
        </Button>
        <div className="mt-3 flex flex-col items-center leading-none">
          <span className="text-sm font-extrabold text-ink">iKantin</span>
          <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-ink-soft">Area Control · Digital Borneo</span>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-surface">
      <div className="fixed inset-y-0 left-0 z-40 hidden md:block">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">{Sidebar}</div>
        </div>
      )}
      <div className="md:pl-52">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-white to-[#F5F8FC] px-4 py-3">
          <button onClick={() => setOpen(true)} className="text-ink md:hidden" aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <h1 className="text-base font-extrabold text-ink">{current?.label || "Dashboard Area"}</h1>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
      </div>
    </div>
  );
}
