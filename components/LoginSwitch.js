"use client";
import Link from "next/link";

// Tombol pindah antar halaman login (Admin Kantin ⇄ Area Manager) tanpa ubah URL manual.
export default function LoginSwitch({ active }) {
  const tabs = [
    { key: "admin", href: "/admin/login", label: "Admin Kantin" },
    { key: "am", href: "/am/login", label: "Area Manager" },
  ];
  return (
    <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1" role="tablist" aria-label="Pilih jenis login">
      {tabs.map((t) =>
        t.key === active ? (
          <span key={t.key} role="tab" aria-selected="true"
            className="rounded-lg bg-white py-2 text-center text-sm font-bold text-primary shadow-card">
            {t.label}
          </span>
        ) : (
          <Link key={t.key} href={t.href} role="tab" aria-selected="false" replace
            className="rounded-lg py-2 text-center text-sm font-semibold text-ink-soft transition hover:text-ink">
            {t.label}
          </Link>
        )
      )}
    </div>
  );
}
