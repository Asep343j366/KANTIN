"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";
import { storePath } from "@/lib/slug";
import { compressImage } from "@/lib/compressImage";
import Receipt from "@/components/Receipt";
import { useAmountQris } from "@/lib/qrisDynamic";
import PayPanel from "@/components/store/PayPanel";
import { TopBar, Icon, Confetti, tintFor } from "@/components/store/fx";
import { reorder } from "@/components/store/reorder";

export default function OrderStatus() {
  const { code, slug } = useParams();
  const router = useRouter();
  const [reBusy, setReBusy] = useState(false);
  const [reMsg, setReMsg] = useState("");
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [qrImg, setQrImg] = useState("");
  const [buktiBusy, setBuktiBusy] = useState(false);
  const [buktiMsg, setBuktiMsg] = useState("");
  const [buktiErr, setBuktiErr] = useState("");
  // Order manual (tanpa QR Casaku) yang masih menunggu: QRIS statis diisi nominal otomatis.
  const manualPending = !!order && !order.qr_string && order.status !== "selesai" && order.status !== "dibatalkan";
  const { qr: manualQr, loading: qrLoading } = useAmountQris(settings?.qris_image_url, order?.total, manualPending);

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
      const { error: upErr } = await supabase.storage.from("payments").upload(path, up, { upsert: true, cacheControl: "31536000", contentType: "image/jpeg" });
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
          duplicate_proof: "bukti ini sudah pernah dipakai untuk pesanan lain",
          no_image: "foto tak terbaca",
        }[d.reason] || "perlu dicek admin";
        setBuktiMsg(`Bukti sudah diterima (${why}). Pembayaran akan segera diverifikasi admin.`);
      }
    } catch (err) {
      setBuktiErr("Gagal mengunggah bukti: " + (err.message || err));
    }
    setBuktiBusy(false);
  }

  async function onReorder() {
    if (!order) return;
    setReBusy(true); setReMsg("");
    try {
      const r = await reorder(order.id, items);
      if (r.added) router.push(storePath(slug, "/cart"));
      else setReMsg("Menu di pesanan ini sedang habis semua.");
    } catch { setReMsg("Gagal memuat ulang pesanan. Coba lagi."); }
    setReBusy(false);
  }

  if (loading) return (
    <main className="container-app space-y-3 pt-6">
      <div className="zk-shimmer h-44 rounded-[28px]" />
      <div className="zk-shimmer h-28 rounded-[1.1rem]" />
    </main>
  );
  if (!order) return (
    <main className="container-app pb-28">
      <TopBar title="Pesanan" onBack={() => router.push(storePath(slug, "/order"))} />
      <div className="zk-up pt-14 text-center">
        <p className="font-bold text-[#14213d]">Pesanan <b>{code}</b> tidak ditemukan</p>
        <Link href={storePath(slug, "/order")} className="zk-cta zk-press mt-5 inline-flex rounded-2xl px-6 py-3 text-sm font-extrabold">Coba lagi</Link>
      </div>
    </main>
  );

  const paid = order.status === "selesai";
  const failed = order.status === "dibatalkan" || order.payment_status === "failed";
  // Nominal UNIK yang wajib dibayar (Casaku menyisipkan kode unik ke amount_charged).
  const charged = Number(order.amount_charged || 0);
  const hasUnique = charged > 0 && charged !== Number(order.total || 0);
  const payQr = qrImg || manualQr || settings?.qris_image_url || "";
  const payLoading = !qrImg && (qrLoading || !!order?.qr_string);
  // Rayakan (konfeti) hanya bila baru saja lunas (≤ 3 menit).
  const freshPaid = paid && order.paid_at && Date.now() - new Date(order.paid_at).getTime() < 3 * 60 * 1000;

  return (
    <main className="container-app pb-28">
      {!paid && (
        <TopBar title={failed ? "Pesanan" : "Pembayaran"} onBack={() => router.push(storePath(slug, "/order"))} />
      )}

      {paid && (
        <div className="relative -mx-4 mb-4">
          <div className="relative overflow-hidden rounded-b-[32px] bg-gradient-to-br from-[#1f9d63] via-[#137a4a] to-[#0d5c37] px-4 pb-16 pt-10 text-center text-white">
            <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/[0.08]" />
            <span className="pointer-events-none absolute -left-6 bottom-4 h-24 w-24 rounded-full bg-white/[0.06]" />
            {freshPaid && <Confetti />}
            <div className="relative mx-auto grid h-20 w-20 place-items-center">
              <span className="zk-ripple absolute inset-0 rounded-full bg-white/30" />
              <span className="zk-check relative grid h-16 w-16 place-items-center rounded-full bg-white text-[#1f9d63] shadow-xl">{Icon.check(30)}</span>
            </div>
            <p className="zk-up relative mt-4 text-lg font-extrabold" style={{ animationDelay: ".2s" }}>Pembayaran berhasil</p>
            <p className="zk-up relative text-sm text-[#c9f2db]" style={{ animationDelay: ".28s" }}>Terima kasih, {order.nama_pelanggan}</p>
          </div>
        </div>
      )}

      {!paid && !failed && (
        <PayPanel
          kode={order.kode_pesanan}
          amount={hasUnique ? charged : Number(order.total || 0)}
          exact={hasUnique}
          qrSrc={payQr}
          qrLoading={payLoading}
          autoAmount={!qrImg && !!manualQr}
          onDownload={() => downloadQris(payQr)}
          infoRekening={settings?.info_rekening}
          storeName={settings?.nama_kantin || ""}
          onUpload={onUploadBukti}
          buktiBusy={buktiBusy}
          buktiMsg={buktiMsg}
          buktiErr={buktiErr}
        />
      )}

      {failed && (
        <div className="zk-up rounded-[24px] bg-gradient-to-br from-[#fdeaea] to-[#fbd5d5] p-5 text-center">
          <p className="font-extrabold text-red-700">Pesanan dibatalkan</p>
          <p className="mt-1 text-sm text-red-700/80">Silakan pesan ulang dari menu.</p>
        </div>
      )}

      {/* Struk ringkas */}
      <div className={`zk-card zk-up relative p-5 ${paid ? "-mt-14" : "mt-4"}`} style={{ animationDelay: paid ? ".3s" : ".05s" }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-[#6b7591]">Kode pesanan</p>
            <p className="text-base font-extrabold tracking-wide text-[#14213d]">{order.kode_pesanan}</p>
            <p className="mt-0.5 text-xs text-[#6b7591]">{fmtDateTime(order.created_at)}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${paid ? "bg-emerald-50 text-emerald-700" : failed ? "bg-red-50 text-red-600" : "bg-[#fff3e0] text-[#a35a0a]"}`}>
            {paid ? "Lunas · QRIS" : failed ? "Dibatalkan" : "Menunggu"}
          </span>
        </div>
        <div className="my-3.5 border-t border-dashed border-[#d9dfec]" />
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2.5 text-sm">
              <span className={`h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br ${tintFor(it.product_id)}`} />
              <span className="min-w-0 flex-1 truncate text-[#14213d]"><b>{it.jumlah}×</b> {it.nama_produk}{it.catatan ? ` (${it.catatan})` : ""}</span>
              <span className="font-bold text-[#14213d]">{rupiah(it.harga * it.jumlah)}</span>
            </div>
          ))}
        </div>
        <div className="my-3.5 border-t border-dashed border-[#d9dfec]" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-[#6b7591]">Total</span>
          <span className="text-xl font-extrabold text-[#0f2a5c]">{rupiah(order.total)}</span>
        </div>
        {hasUnique && !paid && !failed && (
          <div className="mt-1 flex justify-between text-sm font-semibold text-[#a35a0a]">
            <span>Nominal bayar (unik)</span><span>{rupiah(charged)}</span>
          </div>
        )}
        <div className="mt-3 rounded-2xl bg-[#f8f9fc] px-3.5 py-2.5 text-xs text-[#6b7591]">
          <p><b className="text-[#14213d]">{order.nama_pelanggan}</b> · {order.no_hp}</p>
          {order.catatan && <p className="mt-0.5">Catatan: {order.catatan}</p>}
        </div>
      </div>

      {reMsg && <p className="mt-3 rounded-2xl bg-[#fff3e0] px-4 py-3 text-center text-sm font-semibold text-[#a35a0a]">{reMsg}</p>}

      {paid ? (
        <div className="zk-up mt-4 grid grid-cols-2 gap-3" style={{ animationDelay: ".4s" }}>
          <button onClick={() => setShowReceipt(true)} className="zk-card zk-press flex items-center justify-center gap-1.5 py-3.5 text-sm font-extrabold text-[#0f2a5c]">
            {Icon.receipt(17)} Lihat struk
          </button>
          <button onClick={onReorder} disabled={reBusy} className="zk-cta zk-press flex items-center justify-center gap-1.5 rounded-[1.1rem] py-3.5 text-sm font-extrabold disabled:opacity-70">
            {Icon.refresh(15)} {reBusy ? "Memuat…" : "Pesan lagi"}
          </button>
        </div>
      ) : (
        <Link href={storePath(slug)} className="mt-4 block py-2 text-center text-xs font-bold text-[#9aa3b8]">Kembali ke menu</Link>
      )}

      {showReceipt && (
        <Receipt order={order} items={items} settings={settings} onClose={() => setShowReceipt(false)} />
      )}
    </main>
  );
}
