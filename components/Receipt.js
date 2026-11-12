"use client";
import { useEffect, useState } from "react";
import { rupiah, fmtDateTime } from "@/lib/format";
import { tintFor, Icon } from "@/components/store/fx";
import { useAppLogo } from "@/lib/storeLogo";

// Struk digital (gaya navy premium DKantin). #receipt dirender jadi JPG untuk
// dibagikan/diunduh (html2canvas) — karena itu pakai warna solid/gradien biasa.
export default function Receipt({ order, items, settings, fotos = {}, onClose }) {
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const appLogo = useAppLogo();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Render struk (#receipt) menjadi file JPG untuk dibagikan/diunduh.
  async function buildReceiptFile() {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = document.getElementById("receipt");
      // Gambar JPG berbentuk persegi penuh: sudut lengkung & bayangan dimatikan
      // HANYA pada salinan yang dirender (tampilan di layar tetap melengkung).
      const canvas = await html2canvas(el, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true,
        onclone: (doc) => {
          const r = doc.getElementById("receipt");
          if (r) { r.style.borderRadius = "0"; r.style.boxShadow = "none"; }
          doc.querySelectorAll("[data-notch]").forEach((n) => { n.style.display = "none"; });
        },
      });
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
    setSaving(true);
    const file = await buildReceiptFile();
    setSaving(false);
    if (!file) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const qty = items.reduce((s, it) => s + (it.jumlah || 0), 0);

  return (
    <div className="fixed inset-0 z-[60] print:static">
      <div onClick={onClose} className="zk-fade absolute inset-0 bg-[#0a1d42]/55 backdrop-blur-[2px] print:hidden" />
      <div className="zk-sheet absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] w-full max-w-md flex-col rounded-t-[28px] bg-[#f2f4f9] shadow-[0_-12px_40px_rgba(10,29,66,.3)] print:static print:max-h-none print:rounded-none">
        <div className="shrink-0 pb-1 pt-2.5 print:hidden"><div className="mx-auto h-1.5 w-11 rounded-full bg-[#d9dfec]" /></div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div id="receipt" className="overflow-hidden rounded-[24px] bg-white shadow-[0_6px_20px_rgba(15,42,92,.10)]">
            {/* Kepala struk */}
            <div className="relative overflow-hidden px-5 pb-6 pt-6 text-center text-white"
              style={{ background: "linear-gradient(150deg,#16397a 0%,#0f2a5c 55%,#0a1d42 100%)" }}>
              <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full" style={{ background: "rgba(255,255,255,.07)" }} />
              <div className="relative mx-auto mb-2 grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={appLogo} alt="Logo" crossOrigin="anonymous" className="h-full w-full object-cover" />
              </div>
              <h2 className="relative text-lg font-extrabold">{settings?.nama_kantin || "Kantin Digital"}</h2>
              {settings?.alamat && <p className="relative text-xs" style={{ color: "#b8c4dd" }}>{settings.alamat}</p>}
              {/* Badge sederhana (inline-block + line-height tetap) agar rata juga di JPG */}
              <span className="relative mt-3 inline-block rounded-full text-xs font-extrabold"
                style={{ background: "#22c55e", color: "#fff", padding: "5px 14px 6px", lineHeight: "15px" }}>
                ✓{" "}LUNAS
              </span>
              <p className="relative mt-3 text-[11px]" style={{ color: "#b8c4dd" }}>Total dibayar</p>
              <p className="relative text-[28px] font-extrabold leading-tight">{rupiah(order.total)}</p>
            </div>

            {/* Sobekan */}
            <div className="relative h-4">
              <span data-notch className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-[#f2f4f9]" />
              <span data-notch className="absolute -right-2 top-0 h-4 w-4 rounded-full bg-[#f2f4f9]" />
              <div className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-[#d9dfec]" />
            </div>

            <div className="px-5 pb-5">
              <div className="space-y-1.5 text-sm">
                <Row l="Kode" r={order.kode_pesanan} strong />
                <Row l="Tanggal" r={fmtDateTime(order.created_at)} />
                <Row l="Nama" r={order.nama_pelanggan} />
                <Row l="Metode" r="QRIS" />
              </div>

              <div className="my-4 border-t border-dashed border-[#d9dfec]" />

              <p className="mb-2 text-xs font-bold text-[#6b7591]">{qty} item</p>
              <div className="space-y-2.5">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-2.5 text-sm">
                    {/* Foto sebagai background (cover) — html2canvas tak mendukung object-fit */}
                    <span className={`block h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${tintFor(it.product_id)}`}
                      style={fotos[it.product_id] ? { backgroundImage: `url("${fotos[it.product_id]}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
                    <span className="min-w-0 flex-1 text-[#14213d]">
                      <span className="block font-semibold leading-snug">{it.nama_produk}</span>
                      <span className="block text-xs leading-snug text-[#6b7591]">{it.jumlah} × {rupiah(it.harga)}</span>
                    </span>
                    <span className="font-bold text-[#14213d]">{rupiah(it.harga * it.jumlah)}</span>
                  </div>
                ))}
              </div>

              <div className="my-4 border-t border-dashed border-[#d9dfec]" />

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-extrabold text-[#14213d]">TOTAL</span>
                <span className="text-xl font-extrabold text-[#0f2a5c]">{rupiah(order.total)}</span>
              </div>

              <div className="mt-4 rounded-2xl bg-[#f2f4f9] px-4 py-3 text-center text-xs text-[#6b7591]">
                Tunjukkan kode <b className="text-[#0f2a5c]">{order.kode_pesanan}</b> saat mengambil pesanan.
                <br />Terima kasih sudah jujur &amp; jajan di sini 🙏
              </div>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-[auto_1fr_1fr] gap-2 border-t border-[#e6e9f1] bg-white px-4 pb-5 pt-3 print:hidden">
          <button onClick={onClose} className="zk-press rounded-2xl bg-[#f2f4f9] px-4 py-3.5 text-sm font-bold text-[#6b7591]">Tutup</button>
          <button onClick={downloadImage} disabled={saving}
            className="zk-press flex items-center justify-center gap-1.5 rounded-2xl bg-[#e1e8f6] py-3.5 text-sm font-extrabold text-[#0f2a5c] disabled:opacity-60">
            {Icon.download(15)} {saving ? "Menyimpan…" : "Simpan"}
          </button>
          <button onClick={share} disabled={sharing}
            className="zk-cta zk-press flex items-center justify-center gap-1.5 rounded-2xl py-3.5 text-sm font-extrabold disabled:opacity-70">
            {Icon.upload(15)} {sharing ? "Menyiapkan…" : "Bagikan"}
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

function Row({ l, r, strong }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[#6b7591]">{l}</span>
      <span className={`text-right ${strong ? "font-extrabold tracking-wide text-[#14213d]" : "font-semibold text-[#14213d]"}`}>{r}</span>
    </div>
  );
}
