"use client";
import Link from "next/link";

export default function Header({ settings }) {
  return (
    <header className="bg-gradient-to-br from-[#0F4575] to-[#0A2E4F] px-4 pb-5 pt-4 text-white">
      <div className="container-app flex items-center gap-3 px-0">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/95 shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512.png" alt="Logo" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Kantin Digital</p>
          <h1 className="truncate text-lg font-extrabold leading-tight">
            {settings?.nama_kantin || "Big Mall Samarinda"}
          </h1>
        </div>
        <Link href="/order" className="grid h-10 w-10 place-items-center rounded-full bg-white/12"
          aria-label="Lacak pesanan">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h6M4 7h16v13H4zM9 11h6M9 15h4"/></svg>
        </Link>
      </div>
    </header>
  );
}
