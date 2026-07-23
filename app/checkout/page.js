"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { getCart, cartTotal, clearCart } from "@/lib/cart";
import { rupiah, orderCode } from "@/lib/format";
import Button from "@/components/Button";

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [step, setStep] = useState(1); // 1 = data, 2 = bayar QRIS
  const [nama, setNama] = useState("");
  const [hp, setHp] = useState("");
  const [catatan, setCatatan] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // State pembayaran
  const [kode, setKode] = useState("");
  const [qrImg, setQrImg] = useState("");
  const [amount, setAmount] = useState(0);
  const [expiredAt, setExpiredAt] = useState(null);
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    setItems(getCart());
    try {
      const last = JSON.parse(localStorage.getItem("kantin_last_customer") || "null");
      if (last) { setNama(last.nama || ""); setHp(last.hp || ""); }
    } catch {}
  }, []);

  // Hitung mundur masa berlaku QRIS
  useEffect(() => {
    if (!expiredAt) return;
    const tick = () => {
      const ms = new Date(expiredAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiredAt]);

  const total = cartTotal(items);

  async function proceedToPayment() {
    setError("");
    if (!nama.trim()) return setError("Nama wajib diisi.");
    if (!/^0[0-9]{8,13}$/.test(hp.trim())) return setError("Nomor HP tidak valid (contoh: 08123456789).");
    setProcessing(true);
    try {
      const code = orderCode();

      // 1) Buat order (menunggu pembayaran) + item
      const { data: order, error: oErr } = await supabase.from("orders").insert({
        kode_pesanan: code,
        nama_pelanggan: nama.trim(),
        no_hp: hp.trim(),
        catatan: catatan.trim() || null,
        total,
        status: "menunggu_pembayaran",
      }).select().single();
      if (oErr) throw oErr;

      const rows = items.map((i) => ({
        order_id: order.id,
        product_id: i.id,
        nama_produk: i.nama,
        harga: i.harga,
        jumlah: i.qty,
        catatan: i.note || null,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) throw iErr;

      // 2) Minta QRIS ke server (server → Louvin)
      const res = await fetch("/api/pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });
      const pay = await res.json();
      if (!res.ok) throw new Error(pay.error || "Gagal memproses pembayaran.");

      // 3) Render QR string jadi gambar
      const img = await QRCode.toDataURL(pay.qr_string, { width: 280, margin: 1 });

      setKode(code);
      setQrImg(img);
      setAmount(pay.amount || total);
      setExpiredAt(pay.expired_at || null);
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

  if (items.length === 0 && step === 1) {
    return (
      <main className="container-app pt-16 text-center">
        <p className="text-ink-soft">Keranjang kosong.</p>
        <Link href="/" className="btn-primary mt-4 inline-flex">Lihat Menu</Link>
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

            {remaining != null && (
              <p className={`mt-3 text-sm font-semibold ${remaining === 0 ? "text-danger" : "text-ink-soft"}`}>
                {remaining === 0 ? "QRIS kedaluwarsa — ulangi pemesanan." : `Berlaku ${fmtCountdown(remaining)}`}
              </p>
            )}

            <p className="mt-2 text-xs text-ink-soft">
              Scan QRIS di atas pakai aplikasi m-banking / e-wallet apa pun.
              Status pesanan akan otomatis diperbarui setelah pembayaran terkonfirmasi.
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={() => router.push(`/order/${kode}`)} className="btn-block">
            Lihat Status Pesanan
          </Button>
          <Link href="/" className="btn-outline block text-center">Kembali ke Menu</Link>
        </div>
      )}
    </main>
  );
}

function fmtCountdown(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
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
