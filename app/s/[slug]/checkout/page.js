"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { getCart, cartTotal, clearCart } from "@/lib/cart";
import { compressImage } from "@/lib/compressImage";
import { rupiah, orderCode } from "@/lib/format";
import { useSlug, storePath } from "@/lib/slug";
import { useStore } from "../StoreProvider";
import Button from "@/components/Button";

export default function CheckoutPage() {
  const router = useRouter();
  const slug = useSlug();
  const store = useStore();
  const [items, setItems] = useState([]);
  const [step, setStep] = useState(1); // 1 = data, 2 = bayar QRIS
  const [nama, setNama] = useState("");
  const [hp, setHp] = useState("");
  const [catatan, setCatatan] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // State pembayaran
  const [kode, setKode] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [qrImg, setQrImg] = useState("");
  const [amount, setAmount] = useState(0);
  const [payMode, setPayMode] = useState("casaku");
  const [settings, setSettings] = useState(null);

  // State upload bukti
  const [buktiBusy, setBuktiBusy] = useState(false);
  const [buktiMsg, setBuktiMsg] = useState("");
  const [buktiErr, setBuktiErr] = useState("");

  useEffect(() => {
    setItems(getCart());
    try {
      const last = JSON.parse(localStorage.getItem("kantin_last_customer") || "null");
      if (last) { setNama(last.nama || ""); setHp(last.hp || ""); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!store?.id) return;
    supabase.from("settings").select("qris_image_url, info_rekening").eq("store_id", store.id).maybeSingle()
      .then(({ data }) => setSettings(data || null));
  }, [store?.id]);

  const total = cartTotal(items);

  // Verifikasi pembayaran DI TEMPAT (step 2): QR tetap tampil sambil dicek
  // realtime + polling. Begitu lunas → auto lanjut ke nota (/order/<kode>).
  // Mekanisme sama persis dengan halaman /order/[code] (tak ubah server).
  useEffect(() => {
    if (step !== 2 || !kode) return;
    let stopped = false;
    const goPaid = () => {
      if (stopped) return;
      stopped = true;
      router.replace(storePath(slug, `/order/${kode}`));
    };

    // Realtime: webhook Casaku / settle manual admin meng-UPDATE order → selesai.
    const ch = supabase
      .channel(`pay-${kode}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `kode_pesanan=eq.${kode}` },
        (payload) => { if (payload.new?.status === "selesai") goPaid(); }
      )
      .subscribe();

    // Polling andal (tak bergantung realtime yang mungkin belum di-enable):
    // 1) cek status order LANGSUNG ke DB → menangkap settle MANUAL maupun casaku.
    // 2) cadangan casaku: minta server cek ke Casaku (settle bila webhook telat).
    const poll = setInterval(async () => {
      if (stopped) return;
      try {
        const { data: o } = await supabase
          .from("orders").select("status").eq("kode_pesanan", kode).maybeSingle();
        if (!stopped && o?.status === "selesai") return goPaid();
      } catch {}
      try {
        const res = await fetch(`/api/pay/status?code=${encodeURIComponent(kode)}`, { cache: "no-store" });
        const d = await res.json();
        if (!stopped && d.status === "paid") goPaid();
      } catch {}
    }, 4000);

    return () => { stopped = true; supabase.removeChannel(ch); clearInterval(poll); };
  }, [step, kode, slug, router]);

  async function proceedToPayment() {
    setError("");
    if (!store?.id) return setError("Toko tidak dikenali. Muat ulang halaman.");
    if (store.is_demo) return setError("Ini toko demo — transaksi dinonaktifkan.");
    if (!nama.trim()) return setError("Nama wajib diisi.");
    if (!/^0[0-9]{8,13}$/.test(hp.trim())) return setError("Nomor HP tidak valid (contoh: 08123456789).");
    setProcessing(true);
    try {
      const code = orderCode();

      // 1) Buat order (menunggu pembayaran) + item
      const { data: order, error: oErr } = await supabase.from("orders").insert({
        store_id: store.id,
        kode_pesanan: code,
        nama_pelanggan: nama.trim(),
        no_hp: hp.trim(),
        catatan: catatan.trim() || null,
        total,
        status: "menunggu_pembayaran",
      }).select().single();
      if (oErr) throw oErr;

      const rows = items.map((i) => ({
        store_id: store.id,
        order_id: order.id,
        product_id: i.id,
        nama_produk: i.nama,
        harga: i.harga,
        jumlah: i.qty,
        catatan: i.note || null,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) throw iErr;

      // 2) Minta QRIS ke server (server → Casaku)
      const res = await fetch("/api/pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });
      const pay = await res.json();
      if (!res.ok) throw new Error(pay.error || "Gagal memproses pembayaran.");

      setPayMode(pay.mode || "casaku");
      // 3) Mode Casaku: render QR dinamis jadi gambar. Mode manual: pakai QRIS statis/rekening.
      if (pay.mode === "casaku" && pay.qr_string) {
        const img = await QRCode.toDataURL(pay.qr_string, { width: 280, margin: 1 });
        setQrImg(img);
      }

      setKode(code);
      setOrderId(order.id);
      setAmount(pay.amount || total);
      clearCart();
      try {
        localStorage.setItem("kantin_last_customer", JSON.stringify({ nama: nama.trim(), hp: hp.trim() }));
      } catch {}
      setStep(2);
    } catch (e) {
      setError("Gagal: " + (e.message || e));
    }
    setProcessing(false);
  }

  // Simpan gambar QRIS ke galeri/berkas tanpa perlu screenshot.
  // Mendukung data-URL (QR dinamis Casaku) & URL storage (QRIS statis manual).
  async function downloadQris(src) {
    if (!src) return;
    const filename = `qris-${kode || "pembayaran"}.png`;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // fallback: buka gambar di tab baru agar bisa disimpan manual
      window.open(src, "_blank");
    }
  }

  // Upload + analisa bukti pembayaran. Auto-lunas bila AI yakin & nominal cocok;
  // selain itu bukti tersimpan → masuk antrean verifikasi manual admin.
  async function onUploadBukti(e) {
    const f = e.target.files?.[0];
    e.target.value = ""; // reset agar bisa pilih file sama lagi
    if (!f || !orderId) return;
    setBuktiErr(""); setBuktiMsg(""); setBuktiBusy(true);
    try {
      const up = await compressImage(f);
      const path = `bukti-${kode}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("payments").upload(path, up, { upsert: true });
      if (upErr) throw upErr;
      const bukti_url = supabase.storage.from("payments").getPublicUrl(path).data.publicUrl;

      setBuktiMsg("Memeriksa bukti pembayaran…");
      const res = await fetch("/api/pay/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, bukti_url }),
      });
      const d = await res.json();
      if (d.status === "auto" || d.status === "already_paid") {
        setBuktiMsg("Pembayaran terverifikasi! Mengalihkan ke struk…");
        router.replace(storePath(slug, `/order/${kode}`));
      } else {
        const why = {
          no_key: "verifikasi otomatis belum aktif",
          ai_quota: "kuota pembaca otomatis penuh",
          amount_mismatch: d.detected != null ? `nominal terbaca Rp${Number(d.detected).toLocaleString("id-ID")}, seharusnya Rp${Number(d.expected || 0).toLocaleString("id-ID")}` : "nominal tak cocok",
          not_valid_proof: "foto belum terbaca sebagai bukti berhasil",
          no_image: "foto tak terbaca",
        }[d.reason] || "perlu dicek admin";
        setBuktiMsg(`Bukti sudah diterima (${why}). Pembayaran akan segera diverifikasi admin — kamu boleh menunggu di halaman ini.`);
      }
    } catch (err) {
      setBuktiErr("Gagal mengunggah bukti: " + (err.message || err));
    }
    setBuktiBusy(false);
  }

  if (items.length === 0 && step === 1) {
    return (
      <main className="container-app pt-16 text-center">
        <p className="text-ink-soft">Keranjang kosong.</p>
        <Link href={storePath(slug)} className="btn-primary mt-4 inline-flex">Lihat Menu</Link>
      </main>
    );
  }

  return (
    <main className="container-app pb-28 pt-5">
      <div className="mb-5 flex items-center gap-2">
        <StepDot n={1} active={step >= 1} label="Data" />
        <div className="h-0.5 flex-1 bg-gray-200" />
        <StepDot n={2} active={step >= 2} label="Bayar" />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-3 font-bold">Data Pengambilan</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">Nama</label>
                <input value={nama} onChange={(e) => setNama(e.target.value)} className="input" placeholder="Nama kamu" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Nomor HP</label>
                <input value={hp} onChange={(e) => setHp(e.target.value)} className="input" placeholder="08xxxxxxxxxx" inputMode="numeric" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Catatan (opsional)</label>
                <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className="input" placeholder="Catatan untuk kantin" />
              </div>
            </div>
          </div>
          <OrderSummary items={items} total={total} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={proceedToPayment} loading={processing} className="btn-block">
            Lanjut ke Pembayaran
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {payMode === "casaku" ? (
            <div className="card p-4 text-center">
              <h2 className="font-bold">Scan & Bayar via QRIS</h2>
              <p className="mt-1 text-sm text-ink-soft">Bayar PERSIS sebesar</p>
              <p className="text-2xl font-extrabold text-primary">{rupiah(amount)}</p>
              <p className="mt-0.5 text-xs text-ink-soft">Nominal unik — jangan dibulatkan agar terverifikasi otomatis</p>

              <div className="mx-auto mt-4 w-64 overflow-hidden rounded-2xl border border-gray-100 p-2">
                {qrImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrImg} alt="QRIS Pembayaran" className="w-full" />
                ) : (
                  <div className="grid aspect-square place-items-center bg-surface text-xs text-ink-soft">
                    Memuat QRIS...
                  </div>
                )}
              </div>

              {qrImg && (
                <button type="button" onClick={() => downloadQris(qrImg)}
                  className="btn-outline mx-auto mt-3 inline-flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  Download QRIS
                </button>
              )}

              <p className="mt-2 text-xs text-ink-soft">
                Scan QRIS di atas pakai aplikasi m-banking / e-wallet apa pun.
                Status pesanan akan otomatis diperbarui setelah pembayaran terkonfirmasi.
              </p>
            </div>
          ) : (
            <div className="card p-4 text-center">
              <h2 className="font-bold">Selesaikan Pembayaran</h2>
              <p className="mt-1 text-sm text-ink-soft">Bayar sebesar</p>
              <p className="text-2xl font-extrabold text-primary">{rupiah(amount)}</p>

              {settings?.qris_image_url && (
                <>
                  <div className="mx-auto mt-4 w-64 overflow-hidden rounded-2xl border border-gray-100 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={settings.qris_image_url} alt="QRIS" className="w-full" />
                  </div>
                  <button type="button" onClick={() => downloadQris(settings.qris_image_url)}
                    className="btn-outline mx-auto mt-3 inline-flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Download QRIS
                  </button>
                </>
              )}
              {settings?.info_rekening && (
                <div className="mx-auto mt-3 max-w-xs whitespace-pre-line rounded-xl bg-surface p-3 text-left text-sm">
                  {settings.info_rekening}
                </div>
              )}
              {!settings?.qris_image_url && !settings?.info_rekening && (
                <p className="mt-3 text-sm text-ink-soft">Hubungi kasir untuk instruksi pembayaran.</p>
              )}

              <p className="mt-3 text-xs text-ink-soft">
                Setelah membayar, pesananmu akan dikonfirmasi oleh kasir. Status akan
                diperbarui otomatis begitu pembayaran diverifikasi.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="card flex items-center justify-center gap-3 border-l-4 border-amber-400 bg-amber-50 p-4">
            <span className="h-6 w-6 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
            <div className="text-left">
              <p className="text-sm font-bold text-amber-700">Menunggu pembayaran…</p>
              <p className="text-xs text-amber-700">Jangan tutup halaman ini. Status dicek otomatis — begitu lunas kamu langsung diarahkan ke struk.</p>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-bold">Sudah bayar? Upload bukti</h3>
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

          <OrderSummary items={items} total={total} />

          <p className="text-center text-xs text-ink-soft">Kode pesanan: <b>{kode}</b></p>
          <Link href={storePath(slug)} className="btn-outline block text-center">Batalkan / Kembali ke Menu</Link>
        </div>
      )}
    </main>
  );
}

function StepDot({ n, active, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${active ? "bg-gradient-to-br from-[#2E86FF] to-[#1657C0] text-white" : "bg-gray-200 text-ink-soft"}`}>{n}</span>
      <span className={`text-sm font-semibold ${active ? "text-ink" : "text-ink-soft"}`}>{label}</span>
    </div>
  );
}

function OrderSummary({ items, total }) {
  return (
    <div className="card p-4">
      <h2 className="mb-3 font-bold">Ringkasan Pesanan</h2>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-ink-soft">{it.qty}× {it.nama}</span>
            <span className="font-semibold">{rupiah(it.harga * it.qty)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-bold">
        <span>Total</span><span className="text-primary">{rupiah(total)}</span>
      </div>
    </div>
  );
}
