"use client";
import { useState } from "react";
import { rupiah, fmtDateTime } from "@/lib/format";

export default function Receipt({ order, items, settings, onClose }) {
  const [sharing, setSharing] = useState(false);

  // Render struk (#receipt) menjadi file JPG untuk dibagikan/diunduh.
  async function buildReceiptFile() {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = document.getElementById("receipt");
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      if (!blob) return null;
      return new File([blob], `struk-${order.kode_pesanan}.jpg`, { type: "image/jpeg" });
    } catch {
      return null;
    }
  }

  async function share() {
    setSharing(true);
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Struk ${settings?.nama_kantin || "Kantin"} — ${order.kode_pesanan}\nTotal: ${rupiah(order.total)} (LUNAS)\n${url}`;
    const file = await buildReceiptFile();

    // 1) Bagikan foto struk (JPG) + teks bila didukung
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Struk Pesanan", text });
        setSharing(false);
        return;
      } catch { /* dibatalkan / gagal → lanjut fallback */ }
    }
    // 2) Bagikan teks + link saja
    if (navigator.share) {
      try {
        await navigator.share({ title: "Struk Pesanan", text, url });
        setSharing(false);
        return;
      } catch {}
    }
    // 3) Fallback: unduh JPG + salin teks
    if (file) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    try { await navigator.clipboard.writeText(text); } catch {}
    setSharing(false);
  }

  async function downloadImage() {
    const file = await buildReceiptFile();
    if (!file) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center print:static print:bg-white print:p-0">
      <div className="w-full max-w-md">
        <div id="receipt" className="rounded-t-2xl bg-white p-6 print:rounded-none">
          <div className="text-center">
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-512.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
            <h2 className="text-lg font-extrabold">{settings?.nama_kantin || "Kantin Digital"}</h2>
            {settings?.alamat && <p className="text-xs text-ink-soft">{settings.alamat}</p>}
            <span className="badge mt-2 bg-green-100 text-green-700">LUNAS</span>
          </div>

          <div className="my-4 border-t border-dashed border-gray-300" />

          <div className="space-y-1 text-sm">
            <Row l="Kode" r={order.kode_pesanan} />
            <Row l="Tanggal" r={fmtDateTime(order.created_at)} />
            <Row l="Nama" r={order.nama_pelanggan} />
            <Row l="Metode" r="QRIS" />
          </div>

          <div className="my-4 border-t border-dashed border-gray-300" />

          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex justify-between text-sm">
                <span className="text-ink-soft">{it.jumlah}× {it.nama_produk}</span>
                <span className="font-semibold">{rupiah(it.harga * it.jumlah)}</span>
              </div>
            ))}
          </div>

          <div className="my-4 border-t border-dashed border-gray-300" />

          <div className="flex justify-between text-base font-extrabold">
            <span>TOTAL</span><span className="text-primary">{rupiah(order.total)}</span>
          </div>

          <p className="mt-4 text-center text-xs text-ink-soft">
            Terima kasih! Tunjukkan kode <b>{order.kode_pesanan}</b> saat mengambil pesanan.
          </p>
        </div>

        <div className="flex gap-2 rounded-b-2xl bg-white p-4 print:hidden">
          <button onClick={onClose} className="btn-outline flex-1">Tutup</button>
          <button onClick={downloadImage} className="btn-outline flex-1">Simpan JPG</button>
          <button onClick={share} disabled={sharing} className="btn-primary flex-1">
            {sharing ? "Menyiapkan..." : "Bagikan"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #receipt, #receipt * { visibility: visible; }
          #receipt { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

function Row({ l, r }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{l}</span>
      <span className="font-medium">{r}</span>
    </div>
  );
}
