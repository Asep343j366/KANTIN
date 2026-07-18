"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCart, cartTotal, clearCart } from "@/lib/cart";
import { rupiah, orderCode } from "@/lib/format";

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [step, setStep] = useState(1); // 1 = data, 2 = pembayaran
  const [nama, setNama] = useState("");
  const [hp, setHp] = useState("");
  const [catatan, setCatatan] = useState("");
  const [bukti, setBukti] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(getCart());
    supabase.from("settings").select("*").eq("id", 1).single()
      .then(({ data }) => setSettings(data));
    // Autofill dari transaksi terakhir (pelanggan yang sama)
    try {
      const last = JSON.parse(localStorage.getItem("kantin_last_customer") || "null");
      if (last) { setNama(last.nama || ""); setHp(last.hp || ""); }
    } catch {}
  }, []);

  const total = cartTotal(items);

  function nextStep() {
    setError("");
    if (!nama.trim()) return setError("Nama wajib diisi.");
    if (!/^0[0-9]{8,13}$/.test(hp.trim())) return setError("Nomor HP tidak valid (contoh: 08123456789).");
    setStep(2);
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type))
      return setError("File harus JPG/PNG/WebP.");
    if (f.size > 5 * 1024 * 1024) return setError("Ukuran maksimal 5 MB.");
    setError("");
    setBukti(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submitOrder() {
    setError("");
    if (!bukti) return setError("Silakan unggah bukti pembayaran QRIS.");
    setSubmitting(true);
    try {
      const kode = orderCode();
      // 1) upload bukti
      const ext = bukti.name.split(".").pop();
      const path = `${kode}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payments").upload(path, bukti);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("payments").getPublicUrl(path);

      // 2) buat pesanan
      const { data: order, error: oErr } = await supabase.from("orders").insert({
        kode_pesanan: kode,
        nama_pelanggan: nama.trim(),
        no_hp: hp.trim(),
        catatan: catatan.trim() || null,
        total,
        status: "selesai",
        bukti_bayar_url: pub.publicUrl,
      }).select().single();
      if (oErr) throw oErr;

      // 3) simpan item
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

      clearCart();
      try {
        localStorage.setItem("kantin_last_customer", JSON.stringify({ nama: nama.trim(), hp: hp.trim() }));
      } catch {}
      router.push(`/order/${kode}?new=1`);
    } catch (e) {
      setError("Gagal membuat pesanan: " + (e.message || e));
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
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
          <button onClick={nextStep} className="btn-primary w-full">Lanjut ke Pembayaran</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-4 text-center">
            <h2 className="font-bold">Scan & Bayar via QRIS</h2>
            <p className="mt-1 text-sm text-ink-soft">Total yang harus dibayar</p>
            <p className="text-2xl font-extrabold text-primary">{rupiah(total)}</p>
            <div className="mx-auto mt-4 w-56 overflow-hidden rounded-2xl border border-gray-100">
              {settings?.qris_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.qris_image_url} alt="QRIS" className="w-full" />
              ) : (
                <div className="grid aspect-square place-items-center bg-surface text-xs text-ink-soft">
                  QRIS belum diatur admin
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Scan QRIS di atas dengan aplikasi m-banking / e-wallet, bayar sesuai nominal,
              lalu unggah bukti pembayaran.
            </p>
          </div>

          <div className="card p-4">
            <h3 className="mb-2 font-bold">Unggah Bukti Pembayaran</h3>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-6 text-center">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="bukti" className="max-h-48 rounded-lg" />
              ) : (
                <>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.6"><path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="mt-2 text-sm text-ink-soft">Ketuk untuk pilih foto (JPG/PNG, maks 5MB)</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-outline flex-1">Kembali</button>
            <button onClick={submitOrder} disabled={submitting} className="btn-primary flex-1 disabled:opacity-60">
              {submitting ? "Mengirim..." : "Kirim Pesanan"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function StepDot({ n, active, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${active ? "bg-primary text-white" : "bg-gray-200 text-ink-soft"}`}>{n}</span>
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
