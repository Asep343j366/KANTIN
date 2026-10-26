"use client";
import { useEffect, useState } from "react";

// Registrasi service worker + deteksi versi deploy baru.
// Saat versi server (/api/version) berbeda dari versi ketika tab dibuka,
// tampilkan banner agar user memuat ulang halaman memakai versi terbaru.
export default function PWARegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Minta browser cek update SW berkala (tangkap sw.js baru).
          setInterval(() => reg.update().catch(() => {}), 120000);
        })
        .catch(() => {});
    }

    let initial = null;
    let alive = true;
    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { v } = await res.json();
        if (!alive || !v) return;
        if (initial === null) initial = v; // versi saat tab ini dibuka
        else if (v !== initial) setUpdateReady(true); // deploy baru terdeteksi
      } catch {}
    }
    check();
    const id = setInterval(check, 120000); // cek tiap 2 menit
    const onVis = () => { if (!document.hidden) check(); }; // + saat tab difokuskan
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999,
        background: "#1B2E54", color: "#fff", padding: "12px 16px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
        fontFamily: "var(--font-sans, system-ui, sans-serif)", boxShadow: "0 -2px 12px rgba(0,0,0,.2)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600 }}>
        Versi baru tersedia — muat ulang untuk memakai fitur terbaru.
      </span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: "#F26F21", color: "#fff", border: "none", borderRadius: 8,
          padding: "8px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}
      >
        Muat Ulang
      </button>
    </div>
  );
}
