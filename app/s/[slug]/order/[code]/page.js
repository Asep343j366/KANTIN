"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";
import { storePath } from "@/lib/slug";
import { compressImage } from "@/lib/compressImage";
import Receipt from "@/components/Receipt";

export default function OrderStatus() {
  const { code, slug } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [qrImg, setQrImg] = useState("");
  const [buktiBusy, setBuktiBusy] = useState(false);
  const [buktiMsg, setBuktiMsg] = useState("");
  const [buktiErr, setBuktiErr] = useState("");

  async function loadOrder() {
    const { data: o } = await supabase.from("orders").select("*").eq("kode_pesanan", code).single();
    if (o) {
      const [{ data: its }, { data: set }] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", o.id),
        supabase.from("settings").select("*").eq("store_id", o.store_id).maybeSingle(),
      ]);
      setItems(its || []);
      setSettings(set || null);
    }
    setOrder(o || null);
    setLoading(false);
  }

  useEffect(() => {
    loadOrder();
    // Realtime: begitu webhook Casaku menandai order lunas, layar ikut berubah
    const ch = supabase
      .channel(`order-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `kode_pesanan=eq.${code}` },
        (payload) => setOrder(payload.new)
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [code]);

  // Polling ke Casaku: cadangan bila webhook gagal/telat terbaca. Setiap 5 detik
  // tanya status langsung ke Casaku; kalau paid → server settle + reload order.
  // Berhenti otomatis begitu order tak lagi menunggu pembayaran.
  useEffect(() => {
    if (!order) return;
    const settled = order.status === "selesai" || order.status === "dibatalkan" || order.payment_status === "paid";
    if (settled || !order.payment_ref) return;

    let stop = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/pay/status?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const d = await res.json();
        if (!stop && (d.status === "paid" || d.status === "cancel" || d.status === "expired")) {
          loadOrder();
        }
      } catch {}
    }, 5000);
    return () => { stop = true; clearInterval(id); };
  }, [code, order?.status, order?.payment_status, order?.payment_ref]);

  // Render ulang QRIS dinamis (Casaku) dari qr_string tersimpan, selama pending.
  useEffect(() => {
    if (!order || order.status === "selesai" || order.status === "dibatalkan") { setQrImg(""); return; }
    if (order.qr_string) QRCode.toDataURL(order.qr_string, { width: 280, margin: 1 }).then(setQrImg).catch(() => {});
    else setQrImg("");
  }, [order?.qr_string, order?.status]);

  async function downloadQris(src) {
    if (!src) return;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `qris-${code}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { window.open(src, "_blank"); }
  }

  async function onUploadBukti(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !order?.id) return;
    setBuktiErr(""); setBuktiMsg(""); setBuktiBusy(true);
    try {
      const up = await compressImage(f);
      const path = `bukti-${code}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("payments").upload(path, up, { upsert: true });
      if (upErr) throw upErr;
      const bukti_url = supabase.storage.from("payments").getPublicUrl(path).data.publicUrl;
      setBuktiMsg("Memeriksa bukti pembayaran…");
      const res = await fetch("/api/pay/verify-proof", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, bukti_url }),
      });
      const d = await res.json();
      if (d.status === "auto" || d.status === "already_paid") {
        setBuktiMsg("Pembayaran terverifikasi!");
        loadOrder();
      } else {
        const why = {
          no_key: "verifikasi otomatis belum aktif",
          ocr_quota: "kuota pembaca otomatis penuh",
          ocr_error: "pembaca otomatis bermasalah",
          ocr_network: "pembaca otomatis tak terjangkau",
          amount_mismatch: "nominal pada bukti tak cocok",
          not_valid_proof: "bukti terlihat belum berhasil/masih pending",
          no_image: "foto tak terbaca",
        }[d.reason] || "perlu dicek admin";
        setBuktiMsg(`Bukti sudah diterima (${why}). Pembayaran akan segera diverifikasi admin.`);
      }
    } catch (err) {
      setBuktiErr("Gagal mengunggah bukti: " + (err.message || err));
    }
    setBuktiBusy(false);
  }

  if (loading) return <div className="container-app pt-10 text-center text-ink-soft">Memuat...</div>;
  if (!order) return (
    <main className="container-app pt-16 text-center">
      <p className="text-ink-soft">Pesanan <b>{code}</b> tidak ditemukan.</p>
      <Link href={storePath(slug, "/order")} className="btn-primary mt-4 inline-flex">Coba Lagi</Link>
    </main>
  );

  const paid = order.status === "selesai";
  const failed = order.status === "dibatalkan" || order.payment_status === "failed";
  // Nominal UNIK yang wajib dibayar (Casaku menyisipkan kode unik ke amount_charged).
  // Wajib ditampilkan persis agar pembayaran terverifikasi otomatis.
  const charged = Number(order.amount_charged || 0);
  const hasUnique = charged > 0 && charged !== Number(order.total || 0);

  return (
    <main className="container-app pb-10 pt-5">
      {paid && (
        <div className="card mb-4 border-l-4 border-success bg-green-50 p-4 text-center">
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#34D26A] to-[#16A34A] text-2xl font-black text-white">✓</div>
          <p className="font-bold text-green-700">Pembayaran berhasil! 🎉</p>
          <p className="text-sm text-green-700">Terima kasih, pesananmu sudah kami terima.</p>
        </div>
      )}
      {!paid && !failed && (
        <div className="card mb-4 border-l-4 border-amber-400 bg-amber-50 p-4 text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
          <p className="font-bold text-amber-700">Menunggu pembayaran…</p>
          {hasUnique ? (
            <>
              <p className="mt-1 text-sm text-amber-700">Bayar PERSIS sebesar</p>
              <p className="text-2xl font-extrabold text-amber-800">{rupiah(charged)}</p>
              <p className="mt-0.5 text-xs text-amber-700">
                Jangan dibulatkan — nominal ini mengandung kode unik agar pembayaran terverifikasi otomatis.
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-700">Status akan otomatis diperbarui setelah pembayaran QRIS terkonfirmasi.</p>
          )}
        </div>
      )}

      {!paid && !failed && (qrImg || settings?.qris_image_url || settings?.info_rekening) && (
        <div className="card mb-4 p-4 text-center">
          <h2 className="font-bold">Scan & Bayar via QRIS</h2>
          {(qrImg || settings?.qris_image_url) && (
            <>
              <div className="mx-auto mt-3 w-64 overflow-hidden rounded-2xl border border-gray-100 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImg || settings.qris_image_url} alt="QRIS Pembayaran" className="w-full" />
              </div>
              <button type="button" onClick={() => downloadQris(qrImg || settings.qris_image_url)}
                className="btn-outline mx-auto mt-3 inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Download QRIS
              </button>
            </>
          )}
          {settings?.info_rekening && !qrImg && (
            <div className="mx-auto mt-3 max-w-xs whitespace-pre-line rounded-xl bg-surface p-3 text-left text-sm">
              {settings.info_rekening}
            </div>
          )}
        </div>
      )}

      {!paid && !failed && (
        <div className="card mb-4 p-4">
          <h2 className="font-bold">Sudah bayar? Upload bukti</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Jika sudah transfer / scan QRIS tetapi status belum berubah, unggah screenshot bukti pembayaran.
            Bukti yang valid & nominalnya cocok akan otomatis lunas; selain itu diverifikasi admin.
          </p>
          <label className={`btn-outline mt-3 inline-flex cursor-pointer items-center gap-2 ${buktiBusy ? "pointer-events-none opacity-60" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            {buktiBusy ? "Memproses…" : "Upload Bukti Pembayaran"}
            <input type="file" accept="image/*" className="hidden" onChange={onUploadBukti} disabled={buktiBusy} />
          </label>
          {buktiMsg && <p className="mt-2 text-sm font-semibold text-primary">{buktiMsg}</p>}
          {buktiErr && <p className="mt-2 text-sm text-danger">{buktiErr}</p>}
        </div>
      )}

      {failed && (
        <div className="card mb-4 border-l-4 border-danger bg-red-50 p-4 text-center">
          <p className="font-bold text-red-700">Pembayaran gagal / kedaluwarsa</p>
          <p className="text-sm text-red-700">Silakan pesan ulang dari menu.</p>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-soft">Kode Pesanan</p>
            <p className="text-lg font-extrabold tracking-wide">{order.kode_pesanan}</p>
          </div>
          <span className={`badge ${paid ? "bg-green-100 text-green-700" : failed ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            {paid ? "Selesai" : failed ? "Gagal" : "Menunggu Pembayaran"}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">{fmtDateTime(order.created_at)}</p>
      </div>

      <div className="card mt-4 p-5">
        <h2 className="mb-3 font-bold">Detail Pesanan</h2>
        {items.map((it) => (
          <div key={it.id} className="flex justify-between py-1 text-sm">
            <span className="text-ink-soft">{it.jumlah}× {it.nama_produk}{it.catatan ? ` (${it.catatan})` : ""}</span>
            <span className="font-semibold">{rupiah(it.harga * it.jumlah)}</span>
          </div>
        ))}
        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-bold">
          <span>Total</span><span className="text-primary">{rupiah(order.total)}</span>
        </div>
        {hasUnique && !paid && !failed && (
          <div className="mt-1 flex justify-between text-sm font-semibold text-amber-700">
            <span>Nominal bayar (unik)</span><span>{rupiah(charged)}</span>
          </div>
        )}
        <div className="mt-2 text-sm text-ink-soft">
          <p>Nama: {order.nama_pelanggan}</p>
          <p>HP: {order.no_hp}</p>
          {order.catatan && <p>Catatan: {order.catatan}</p>}
        </div>
      </div>

      {paid && (
        <button onClick={() => setShowReceipt(true)} className="btn-primary mt-4 w-full">
          Lihat Struk Digital
        </button>
      )}
      <Link href={storePath(slug)} className="btn-outline mt-3 w-full">Kembali ke Menu</Link>

      {showReceipt && (
        <Receipt order={order} items={items} settings={settings} onClose={() => setShowReceipt(false)} />
      )}
    </main>
  );
}
