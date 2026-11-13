"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { getCart, cartTotal, clearCart, setCart } from "@/lib/cart";
import { loadActivePromos, discountedPrice, allocateBundle } from "@/lib/promo";
import { compressImage } from "@/lib/compressImage";
import { rupiah, orderCode } from "@/lib/format";
import { useSlug, storePath } from "@/lib/slug";
import { useStore } from "../StoreProvider";
import PayPanel from "@/components/store/PayPanel";
import { TopBar, StepBar, Icon, RollingRupiah, tintFor } from "@/components/store/fx";
import { useAmountQris } from "@/lib/qrisDynamic";

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
  // Mode manual: QRIS statis toko diisi nominal otomatis (fallback gambar asli bila gagal).
  const { qr: manualQr, loading: qrLoading } = useAmountQris(settings?.qris_image_url, amount, step === 2 && payMode !== "casaku");

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
    supabase.from("settings").select("qris_image_url, info_rekening, nama_kantin").eq("store_id", store.id).maybeSingle()
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
      // 0) Validasi ulang harga promo (promo bisa berakhir/berubah sejak masuk keranjang).
      const hasPromo = items.some((i) => i.promo_id || i.bundle);
      let fixed = items;
      if (hasPromo) {
        const { list } = await loadActivePromos(store.id);
        const byId = Object.fromEntries(list.map((p) => [p.id, p]));
        const ended = [];
        fixed = items.flatMap((i) => {
          if (i.bundle) {
            const p = byId[i.promo_id];
            if (!p) { ended.push(i.nama); return []; }
            return [{ ...i, harga: p.harga_paket }];
          }
          if (i.promo_id) {
            const p = byId[i.promo_id];
            const still = p && p.jenis === "diskon" && (p.items || []).some((x) => x.product_id === i.id);
            const harga = still ? discountedPrice(i.harga_normal ?? i.harga, p) : (i.harga_normal ?? i.harga);
            return [{ ...i, harga, promo_id: still ? i.promo_id : null }];
          }
          return [i];
        });
        const changed = ended.length || fixed.some((x, k) => x.harga !== items[k]?.harga);
        if (changed) {
          setCart(fixed);
          setItems(fixed);
          setProcessing(false);
          return setError(ended.length
            ? `Promo ${ended.join(", ")} sudah berakhir dan dihapus dari keranjang. Cek lagi totalnya, lalu tekan Bayar.`
            : "Harga promo sudah berubah. Total sudah diperbarui — cek lagi, lalu tekan Bayar.");
        }
      }

      // Rincian item: paket bundling dipecah per menu (harga proporsional) agar
      // stok tiap menu berkurang & laporan per produk tetap akurat.
      const lines = fixed.flatMap((i) => {
        if (!i.bundle) return [{ product_id: i.id, nama_produk: i.nama, harga: i.harga, jumlah: i.qty, catatan: i.note || null, promo_id: i.promo_id || null }];
        return allocateBundle(i.harga, i.components || []).map((c) => ({
          product_id: c.product_id, nama_produk: c.nama, harga: c.harga, jumlah: c.qty * i.qty,
          catatan: `Paket: ${i.nama}`, promo_id: i.promo_id,
        }));
      });
      const orderTotal = lines.reduce((s, l) => s + l.harga * l.jumlah, 0);

      const code = orderCode();

      // 1) Buat order (menunggu pembayaran) + item
      const { data: order, error: oErr } = await supabase.from("orders").insert({
        store_id: store.id,
        kode_pesanan: code,
        nama_pelanggan: nama.trim(),
        no_hp: hp.trim(),
        catatan: catatan.trim() || null,
        total: orderTotal,
        status: "menunggu_pembayaran",
      }).select().single();
      if (oErr) throw oErr;

      const rows = lines.map((l) => ({ store_id: store.id, order_id: order.id, ...l }));
      let { error: iErr } = await supabase.from("order_items").insert(rows);
      // Kolom promo_id belum ada (migrasi v27 belum jalan) → simpan tanpa penanda promo.
      if (iErr && /promo_id/i.test(iErr.message || "")) {
        ({ error: iErr } = await supabase.from("order_items").insert(rows.map(({ promo_id, ...r }) => r)));
      }
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
      setAmount(pay.amount || orderTotal);
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
      const { error: upErr } = await supabase.storage.from("payments").upload(path, up, { upsert: true, cacheControl: "31536000", contentType: "image/jpeg" });
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
          ocr_quota: "kuota pembaca otomatis penuh",
          ocr_error: "pembaca otomatis bermasalah",
          ocr_network: "pembaca otomatis tak terjangkau",
          amount_mismatch: "nominal pada bukti tak cocok",
          not_valid_proof: "bukti terlihat belum berhasil/masih pending",
          duplicate_proof: "bukti ini sudah pernah dipakai untuk pesanan lain",
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
      <main className="container-app pb-28">
        <TopBar title="Checkout" onBack={() => router.push(storePath(slug))} />
        <div className="zk-up pt-16 text-center">
          <p className="font-bold text-[#14213d]">Keranjang kosong</p>
          <p className="mt-1 text-sm text-[#6b7591]">Pilih menu dulu sebelum checkout.</p>
          <Link href={storePath(slug)} className="zk-cta zk-press mt-5 inline-flex rounded-2xl px-6 py-3 text-sm font-extrabold">Lihat menu</Link>
        </div>
      </main>
    );
  }

  const storeName = settings?.nama_kantin || store?.nama || "";
  const payQr = payMode === "casaku" ? qrImg : (manualQr || settings?.qris_image_url || "");
  const payLoading = payMode === "casaku" ? !qrImg : (!!settings?.qris_image_url && qrLoading);

  return (
    <main className="container-app pb-28">
      <TopBar
        title={step === 1 ? "Data pemesan" : "Pembayaran"}
        onBack={() => (step === 1 ? router.push(storePath(slug, "/cart")) : router.push(storePath(slug)))}
        right={<span className="text-xs font-bold text-[#9aa3b8]">{step + 1}/3</span>}
      />
      <StepBar step={step + 1} />

      {step === 1 && (
        <div className="space-y-4">
          <div className="zk-card zk-up space-y-3.5 p-4">
            <Field icon={Icon.user()} label="Nama">
              <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama kamu" autoComplete="name"
                className="w-full bg-transparent text-sm text-[#14213d] outline-none placeholder:text-[#9aa3b8]" />
            </Field>
            <Field icon={Icon.phone()} label="No. HP">
              <input value={hp} onChange={(e) => setHp(e.target.value)} placeholder="08xxxxxxxxxx" inputMode="numeric" autoComplete="tel"
                className="w-full bg-transparent text-sm text-[#14213d] outline-none placeholder:text-[#9aa3b8]" />
            </Field>
            <Field icon={Icon.note()} label={<>Catatan <span className="font-medium text-[#9aa3b8]">(opsional)</span></>}>
              <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan untuk kantin"
                className="w-full bg-transparent text-sm text-[#14213d] outline-none placeholder:text-[#9aa3b8]" />
            </Field>
          </div>

          <OrderSummary items={items} total={total} />

          {error && <p className="zk-up rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#6b7591]">
            <span className="text-emerald-600">{Icon.shield()}</span> Pembayaran aman via QRIS
          </p>
          <button onClick={proceedToPayment} disabled={processing}
            className="zk-cta zk-press relative w-full rounded-2xl py-4 text-sm font-extrabold disabled:opacity-80">
            <span className={processing ? "invisible" : ""}>Bayar dengan QRIS · {" "}<RollingRupiah value={total} /></span>
            {processing && <span className="absolute inset-0 flex items-center justify-center"><span className="dots"><span /><span /><span /></span></span>}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <PayPanel
            kode={kode}
            amount={amount}
            exact={payMode === "casaku"}
            qrSrc={payQr}
            qrLoading={payLoading}
            autoAmount={payMode !== "casaku" && !!manualQr}
            onDownload={() => downloadQris(payQr)}
            infoRekening={settings?.info_rekening}
            storeName={storeName}
            onUpload={onUploadBukti}
            buktiBusy={buktiBusy}
            buktiMsg={buktiMsg}
            buktiErr={buktiErr}
          />
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}
          <OrderSummary items={items} total={total} />
          <Link href={storePath(slug)} className="block py-2 text-center text-xs font-bold text-[#9aa3b8]">
            Kembali ke menu (pesanan tersimpan di “Pesanan”)
          </Link>
        </div>
      )}
    </main>
  );
}

function Field({ icon, label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-[#14213d]">{label}</label>
      <div className="flex items-center gap-2.5 rounded-2xl border border-[#e1e6f0] bg-[#f8f9fc] px-3.5 py-3 transition focus-within:border-[#0f2a5c] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(15,42,92,.08)]">
        <span className="text-[#0f2a5c]">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function OrderSummary({ items, total }) {
  return (
    <div className="zk-card zk-up p-4" style={{ animationDelay: ".05s" }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-[#14213d]">Ringkasan pesanan</h2>
        <span className="text-xs font-bold text-[#c2560f]">{items.reduce((s, i) => s + i.qty, 0)} item</span>
      </div>
      <div className="space-y-2.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm">
            <span className={`h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${tintFor(it.id)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.foto_url && <img src={it.foto_url} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[#14213d]"><b>{it.qty}×</b> {it.nama}</span>
            <span className="font-bold text-[#14213d]">{rupiah(it.harga * it.qty)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-[#d9dfec] pt-3">
        <span className="text-sm font-bold text-[#6b7591]">Total</span>
        <span className="text-lg font-extrabold text-[#0f2a5c]">{rupiah(total)}</span>
      </div>
    </div>
  );
}
