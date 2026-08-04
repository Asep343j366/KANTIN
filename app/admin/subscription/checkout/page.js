"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { clearStoreCache } from "@/lib/store";
import Button from "@/components/Button";

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}
const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

export default function CheckoutLanggananPage() {
  const [state, setState] = useState("loading"); // loading | qris | paid | error
  const [err, setErr] = useState("");
  const [order, setOrder] = useState(null);      // {id, amount, base_amount, durasi_hari}
  const [qrImg, setQrImg] = useState("");
  const [tokenCode, setTokenCode] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  // Buat pesanan + QRIS saat halaman dibuka.
  useEffect(() => {
    (async () => {
      const t = await token();
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "Gagal membuat tagihan."); return setState("error"); }
      setOrder(j);
      try { setQrImg(await QRCode.toDataURL(j.qr_string, { width: 320, margin: 1 })); } catch {}
      setState("qris");
    })();
  }, []);

  // Polling status → cek otomatis ke akun QRIS J366.
  useEffect(() => {
    if (state !== "qris" || !order?.id) return;
    async function poll() {
      const t = await token();
      const res = await fetch(`/api/subscription/checkout?id=${order.id}`, {
        headers: { Authorization: `Bearer ${t}` }, cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (j.status === "paid") {
        setTokenCode(j.token_code || "");
        setState("paid");
        clearStoreCache(); // status langganan berubah → paksa muat ulang data store
        clearInterval(pollRef.current);
      } else if (j.status === "expired" || j.status === "cancel") {
        setErr("Transaksi kedaluwarsa. Silakan ulangi.");
        setState("error");
        clearInterval(pollRef.current);
      }
    }
    pollRef.current = setInterval(poll, 4000);
    poll();
    return () => clearInterval(pollRef.current);
  }, [state, order?.id]);

  async function copyCode() {
    try { await navigator.clipboard.writeText(tokenCode); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3">
        <Link href="/admin/subscription" className="text-sm font-semibold text-primary">← Kembali ke Langganan</Link>
      </div>
      <h1 className="mb-3 text-lg font-extrabold">Pembayaran Langganan</h1>

      {state === "loading" && <div className="card p-8 text-center text-ink-soft">Menyiapkan pembayaran…</div>}

      {state === "error" && (
        <div className="card p-6 text-center">
          <p className="text-danger">{err}</p>
          <Link href="/admin/subscription" className="btn-outline mt-4 inline-flex">Kembali</Link>
        </div>
      )}

      {state === "qris" && order && (
        <div className="card p-5 text-center">
          <p className="text-sm text-ink-soft">Perpanjangan <b>{order.durasi_hari} hari</b></p>
          <p className="mt-1 text-2xl font-extrabold text-primary">{rupiah(order.amount)}</p>
          <p className="text-[11px] text-ink-soft">Bayar PERSIS nominal di atas (ada kode unik agar terverifikasi otomatis).</p>

          {qrImg
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={qrImg} alt="QRIS" className="mx-auto mt-4 h-64 w-64 rounded-xl border border-gray-100" />
            : <div className="mx-auto mt-4 grid h-64 w-64 place-items-center rounded-xl bg-surface text-ink-soft">Memuat QR…</div>}

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-soft">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            Menunggu pembayaran… (cek otomatis)
          </div>
          <p className="mt-3 text-[11px] text-ink-soft">
            Scan dengan aplikasi e-wallet / mobile banking. Setelah bayar, halaman ini otomatis lanjut.
            Jika pembayaran tidak terbaca otomatis, admin akan verifikasi manual — pantau di halaman Langganan.
          </p>
        </div>
      )}

      {state === "paid" && (
        <div className="card p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EAF7EE] text-[#16A34A]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h2 className="mt-3 font-extrabold">Pembayaran berhasil!</h2>
          <p className="mt-1 text-sm text-ink-soft">Langganan kamu sudah otomatis diperpanjang.</p>
          {tokenCode && (
            <div className="mt-4 rounded-xl bg-surface p-3">
              <p className="text-[11px] font-semibold text-ink-soft">Kode voucher (bukti):</p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <code className="text-lg font-extrabold text-primary">{tokenCode}</code>
                <button onClick={copyCode} className="rounded-lg bg-primary-light px-2 py-1 text-xs font-semibold text-primary">{copied ? "✓" : "Salin"}</button>
              </div>
            </div>
          )}
          <a href="/admin/subscription" className="btn-primary btn-block mt-4 text-center">Lihat Status Langganan</a>
        </div>
      )}
    </div>
  );
}
