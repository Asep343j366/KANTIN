"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
import Button from "@/components/Button";

export default function AdminPayment() {
  const [cfg, setCfg] = useState(null);
  const [store, setStore] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  useEffect(() => {
    (async () => {
      setStore(await getMyStore());
      const t = await token();
      const res = await fetch("/api/admin/payment-config", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
      const j = await res.json();
      if (res.ok) setCfg(j.config);
      else setErr(j.error || "Gagal memuat config.");
    })();
  }, []);

  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    const t = await token();
    const res = await fetch("/api/admin/payment-config", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(cfg),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal menyimpan.");
    setMsg("Pengaturan pembayaran tersimpan.");
  }

  if (!cfg) return <p className="text-ink-soft">Memuat...</p>;

  const webhookUrl =
    typeof window !== "undefined" && store?.store_id
      ? `${window.location.origin}/api/pay/webhook/${store.store_id}`
      : "";

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">Pembayaran</h1>
      <p className="mb-4 text-sm text-ink-soft">Pilih cara store ini menerima pembayaran QRIS dari pelanggan.</p>

      {/* Pilih mode */}
      <div className="card mb-4 p-4">
        <label className="mb-2 block text-sm font-semibold">Mode Pembayaran</label>
        <div className="flex gap-2">
          <button
            onClick={() => set("mode", "manual")}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold ${cfg.mode !== "casaku" ? "bg-gradient-to-br from-[#2E86FF] to-[#1657C0] text-white" : "border border-gray-200"}`}>
            Manual
          </button>
          <button
            onClick={() => set("mode", "casaku")}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold ${cfg.mode === "casaku" ? "bg-gradient-to-br from-[#2E86FF] to-[#1657C0] text-white" : "border border-gray-200"}`}>
            Casaku (Otomatis)
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          {cfg.mode === "casaku"
            ? "Pembayaran terverifikasi otomatis via HP Android + app Casaku. Nominal unik per transaksi."
            : "Pelanggan bayar ke QRIS statis / rekening, lalu Anda tandai lunas di menu \"Menunggu\". QRIS statis & info rekening diatur di halaman Pengaturan."}
        </p>
      </div>

      {/* Field Casaku */}
      {cfg.mode === "casaku" && (
        <div className="card mb-4 space-y-3 p-4">
          <h2 className="font-bold">Kredensial Casaku</h2>
          <Field label="License Key">
            <input className="input" value={cfg.license_key || ""} onChange={(e) => set("license_key", e.target.value)} placeholder="x-license-key Casaku" />
          </Field>
          <Field label="QR ID (UUID QRIS merchant)">
            <input className="input" value={cfg.qr_id || ""} onChange={(e) => set("qr_id", e.target.value)} />
          </Field>
          <Field label="Webhook Secret">
            <input className="input" value={cfg.webhook_secret || ""} onChange={(e) => set("webhook_secret", e.target.value)} placeholder="Untuk verifikasi HMAC" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Package IDs">
              <input className="input" value={cfg.package_ids || "id.dana"} onChange={(e) => set("package_ids", e.target.value)} placeholder="id.dana" />
            </Field>
            <Field label="Expire (menit)">
              <input className="input" type="number" value={cfg.expire_minutes ?? 1440} onChange={(e) => set("expire_minutes", e.target.value)} />
            </Field>
          </div>

          <div className="rounded-xl bg-surface p-3">
            <p className="text-xs font-semibold">URL Webhook (daftarkan di dashboard Casaku):</p>
            <code className="mt-1 block break-all text-xs text-primary">{webhookUrl}</code>
          </div>
        </div>
      )}

      {msg && <p className="mb-2 text-sm text-success">{msg}</p>}
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <Button onClick={save} loading={saving} className="btn-block">Simpan Pembayaran</Button>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="mb-1 block text-sm font-semibold">{label}</label>{children}</div>;
}
