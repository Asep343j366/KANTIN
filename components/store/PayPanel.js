"use client";
// Panel pembayaran QRIS premium (navy gelap, QR putih menonjol). Dipakai di
// checkout langkah bayar & halaman status pesanan yang masih menunggu.
// Murni tampilan — semua logika (QR, polling, upload/OCR) tetap di halaman.
import { rupiah } from "@/lib/format";
import { Icon } from "@/components/store/fx";

export default function PayPanel({
  kode, amount, exact = false, qrSrc, qrLoading = false, autoAmount = false,
  onDownload, infoRekening, storeName,
  onUpload, buktiBusy, buktiMsg, buktiErr,
}) {
  const hasQr = !!qrSrc || qrLoading;
  return (
    <div className="space-y-3">
      <div className="zk-hero zk-zoom relative overflow-hidden rounded-[28px] px-5 pb-5 pt-5 text-white shadow-[0_18px_40px_rgba(10,29,66,.35)]">
        <span className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/[0.06]" />
        <span className="pointer-events-none absolute -bottom-10 -right-6 h-32 w-32 rounded-full bg-[#ff8a3d]/10" />

        <div className="relative text-center">
          <p className="text-[11px] font-semibold tracking-wider text-[#b8c4dd]">{kode}</p>
          <p className="mt-2 text-xs text-[#b8c4dd]">{exact ? "Bayar PERSIS sebesar" : "Total pembayaran"}</p>
          <p className="text-[32px] font-extrabold leading-tight">{rupiah(amount)}</p>
          {exact && <p className="mt-0.5 text-[11px] text-[#ffd2a8]">Nominal unik — jangan dibulatkan agar terverifikasi otomatis</p>}
          {autoAmount && (
            <span className="zk-fade mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
              {Icon.check(12)} Nominal terisi otomatis saat scan
            </span>
          )}
        </div>

        {hasQr && (
          <div className="relative mx-auto mt-4 w-full max-w-[264px] rounded-3xl bg-white p-4 text-[#14213d] shadow-[0_14px_30px_rgba(0,0,0,.35)]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-extrabold tracking-[0.2em]">QRIS</span>
              <span className="line-clamp-1 max-w-[150px] text-[#6b7591]">{storeName}</span>
            </div>
            <div className="mt-2 aspect-square overflow-hidden rounded-xl">
              {qrLoading || !qrSrc ? (
                <div className="zk-shimmer grid h-full place-items-center text-xs font-semibold text-[#6b7591]">Menyiapkan QRIS…</div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrSrc} alt="QRIS pembayaran" className="zk-zoom h-full w-full object-contain" />
              )}
            </div>
          </div>
        )}

        {infoRekening && !hasQr && (
          <div className="relative mx-auto mt-4 max-w-xs whitespace-pre-line rounded-2xl bg-white/10 p-3 text-left text-sm">{infoRekening}</div>
        )}
        {!hasQr && !infoRekening && (
          <p className="relative mt-4 text-center text-sm text-[#b8c4dd]">Hubungi kasir untuk instruksi pembayaran.</p>
        )}

        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onDownload} disabled={!qrSrc || qrLoading}
            className="zk-press flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 py-2.5 text-xs font-bold text-white disabled:opacity-40">
            {Icon.download(15)} Simpan QR
          </button>
          <label className={`zk-press flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-white/10 py-2.5 text-xs font-bold text-white ${buktiBusy ? "pointer-events-none opacity-60" : ""}`}>
            {Icon.upload(15)} {buktiBusy ? "Memproses…" : "Upload bukti"}
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={buktiBusy} />
          </label>
        </div>

        <div className="relative mt-3 flex items-center gap-2.5 rounded-2xl border border-[#ffb36b]/35 bg-[#ffb36b]/10 px-3.5 py-3 text-xs text-[#ffd2a8]">
          <span className="zk-pulse h-2.5 w-2.5 shrink-0 rounded-full bg-[#ffb36b]" />
          <span>Menunggu pembayaran… dicek otomatis. Begitu lunas, struk langsung muncul.</span>
        </div>
      </div>

      {(buktiMsg || buktiErr) && (
        <div className={`zk-up rounded-2xl px-4 py-3 text-sm font-semibold ${buktiErr ? "bg-red-50 text-red-600" : "bg-[#e1e8f6] text-[#0f2a5c]"}`}>
          {buktiErr || buktiMsg}
        </div>
      )}
      <p className="px-1 text-center text-[11px] leading-relaxed text-[#9aa3b8]">
        Scan pakai m-banking / e-wallet apa pun. Sudah bayar tapi status belum berubah? Upload screenshot bukti bayar.
      </p>
    </div>
  );
}
