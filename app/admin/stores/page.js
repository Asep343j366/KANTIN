"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import { compressImage } from "@/lib/compressImage";
import { fetchAllRows } from "@/lib/sbPaginate";
import { confirmDialog } from "@/lib/confirmDialog";
import { refreshBrand, useBrand } from "@/lib/brand";
import { normalizeBrand, DEFAULT_STYLE } from "@/lib/brandDefaults";
import BrandLogo from "@/components/BrandLogo";
import Button from "@/components/Button";
import { DEFAULT_LOGO } from "@/lib/storeLogo";
import { toSquarePng } from "@/lib/squareImage";

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

const empty = { kode_site: "", nama: "", nama_store: "", owner_email: "", owner_password: "", trial_days: 0, is_demo: false };

export default function StoresPage() {
  const [allowed, setAllowed] = useState(null);
  const [stores, setStores] = useState([]);
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [resetFor, setResetFor] = useState(null);
  const [optMsg, setOptMsg] = useState("");
  const [optBusy, setOptBusy] = useState(false);

  // Optimalkan foto produk SEMUA kantin (platform-admin): perkecil 640px +
  // cache 1 tahun, timpa objek yang sama (bust CDN cache) → hemat cached egress.
  // Bisa dijalankan J366 tanpa login ke toko lain (produk public-read; bucket
  // products boleh ditulis user login).
  async function reoptimizeAll() {
    const prods = await fetchAllRows(() =>
      supabase.from("products").select("id, foto_url").not("foto_url", "is", null).order("id", { ascending: true })
    );
    const withFoto = prods.filter((p) => p.foto_url && p.foto_url.includes("/products/"));
    if (!withFoto.length) { setOptMsg("Tidak ada foto untuk dioptimalkan."); return; }
    if (!(await confirmDialog({
      title: "Optimalkan Foto Semua Kantin",
      message: `Perkecil & cache ${withFoto.length} foto produk dari SEMUA kantin? Jalan sekali, aman (foto tetap sama, hanya lebih ringan). Bisa makan beberapa menit.`,
      confirmLabel: "Ya, Optimalkan Semua",
    }))) return;
    setOptBusy(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < withFoto.length; i++) {
      const p = withFoto[i];
      setOptMsg(`Mengoptimalkan ${i + 1}/${withFoto.length}… (${ok} ok)`);
      try {
        const path = p.foto_url.split("/products/")[1].split("?")[0];
        const res = await fetch(p.foto_url, { cache: "no-store" });
        const blob = await res.blob();
        const small = await compressImage(new File([blob], "f.jpg", { type: blob.type || "image/jpeg" }), { maxWidth: 640, maxHeight: 640, quality: 0.6 });
        const { error } = await supabase.storage.from("products").upload(path, small, { upsert: true, cacheControl: "31536000", contentType: "image/jpeg" });
        if (error) throw error;
        ok++;
      } catch { fail++; }
    }
    setOptBusy(false);
    setOptMsg(`Selesai: ${ok} foto dioptimalkan${fail ? `, ${fail} gagal` : ""}.`);
  }

  useEffect(() => {
    getMyStore().then((s) => {
      setAllowed(!!s?.is_platform_admin);
      if (s?.is_platform_admin) load();
    });
  }, []);

  async function load() {
    const t = await token();
    const res = await fetch("/api/admin/stores", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const j = await res.json();
    if (res.ok) setStores(j.stores || []);
  }

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function create() {
    setSaving(true); setMsg(""); setErr("");
    const t = await token();
    const res = await fetch("/api/admin/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(f),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal membuat store.");
    setMsg(`Store "${j.store.nama}" dibuat. Slug: /s/${j.store.slug}`);
    setF(empty);
    load();
  }

  async function action(store_id, act, days) {
    const t = await token();
    const res = await fetch("/api/admin/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ store_id, action: act, days }),
    });
    const j = await res.json();
    if (!res.ok) return setErr(j.error || "Gagal.");
    load();
  }

  if (allowed === null) return <p className="text-ink-soft">Memuat...</p>;
  if (!allowed) return <p className="text-ink-soft">Halaman ini hanya untuk admin platform.</p>;

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">Kelola Store</h1>
      <p className="mb-4 text-sm text-ink-soft">Tambah store baru & kelola langganan/suspend semua store.</p>

      <LandingSettings />
      <AppLogoEditor />

      {/* Optimasi egress: perkecil & cache foto produk semua kantin */}
      <div className="card mb-4 p-4">
        <h2 className="font-bold">⚡ Optimalkan Foto Semua Kantin</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Perkecil &amp; cache foto produk SEMUA kantin sekaligus untuk memangkas cached egress Supabase.
          Jalankan sekali (dan ulangi bila banyak foto baru). Foto tetap sama, hanya lebih ringan.
        </p>
        <button onClick={reoptimizeAll} disabled={optBusy} className="btn-outline text-sm disabled:opacity-60">
          {optBusy ? (optMsg || "Memproses…") : "Optimalkan Sekarang"}
        </button>
        {!optBusy && optMsg && <p className="mt-2 text-sm text-success">{optMsg}</p>}
      </div>

      {/* Form tambah */}
      <div className="card mb-4 space-y-3 p-4">
        <h2 className="font-bold">Tambah Store Baru</h2>
        <div className="grid grid-cols-2 gap-3">
          <F label="Kode Site"><input className="input" value={f.kode_site} onChange={(e) => set("kode_site", e.target.value)} placeholder="Cth: A812" /></F>
          <F label="Nama Kantin (tampil ke pembeli)"><input className="input" value={f.nama} onChange={(e) => set("nama", e.target.value)} placeholder="Kantin ..." /></F>
        </div>
        <F label="Nama Store (sesuai kode site)"><input className="input" value={f.nama_store} onChange={(e) => set("nama_store", e.target.value)} placeholder="Cth: INFORMA BIG MALL SAMARINDA" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Email Owner"><input className="input" type="email" value={f.owner_email} onChange={(e) => set("owner_email", e.target.value)} /></F>
          <F label="Password Owner"><input className="input" value={f.owner_password} onChange={(e) => set("owner_password", e.target.value)} placeholder="min 6 karakter" /></F>
        </div>
        <F label="Trial (hari, 0 = langsung nonaktif)">
          <input className="input" type="number" min="0" value={f.trial_days} onChange={(e) => set("trial_days", parseInt(e.target.value) || 0)} />
        </F>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.is_demo} onChange={(e) => set("is_demo", e.target.checked)} />
          Jadikan toko demo (bisa dilihat publik, tanpa transaksi, selalu aktif)
        </label>
        {msg && <p className="text-sm text-success">{msg}</p>}
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button onClick={create} loading={saving} className="btn-block">Buat Store</Button>
      </div>

      {/* Daftar */}
      <h2 className="mb-2 font-bold">Semua Store ({stores.length})</h2>
      <div className="space-y-2">
        {stores.map((s) => {
          const until = s.langganan_until ? new Date(s.langganan_until) : null;
          const badge = s.status === "aktif" ? "bg-green-100 text-green-700"
            : s.status === "grace" ? "bg-amber-100 text-amber-700"
            : s.status === "suspended" ? "bg-gray-200 text-ink"
            : "bg-red-100 text-red-700";
          return (
            <div key={s.id} className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{s.nama} {s.is_platform_admin && <span className="text-[10px] text-primary">(platform)</span>} {s.is_demo && <span className="badge bg-amber-100 text-amber-700">demo</span>}</p>
                  <p className="text-xs font-semibold text-[#0F4575]">Site {s.kode_site} · {s.nama_store || <span className="font-normal italic text-ink-soft">nama store belum diisi</span>}</p>
                  <p className="text-xs text-ink-soft">/s/{s.slug} · {s.owner_email || "—"}</p>
                  <p className="text-xs text-ink-soft">Aktif s/d: {until ? fmtDateTime(until.toISOString()) : "—"}</p>
                </div>
                <span className={`badge ${badge}`}>{s.status}</span>
              </div>
              {!s.is_platform_admin && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => action(s.id, "extend", 7)} className="rounded-lg bg-primary-light px-2 py-1 text-xs font-semibold text-primary">+7 hari</button>
                  <button onClick={() => action(s.id, "extend", 30)} className="rounded-lg bg-primary-light px-2 py-1 text-xs font-semibold text-primary">+30 hari</button>
                  <button onClick={() => action(s.id, "extend", 365)} className="rounded-lg bg-primary-light px-2 py-1 text-xs font-semibold text-primary">+1 tahun</button>
                  {s.status === "suspended"
                    ? <button onClick={() => action(s.id, "activate")} className="rounded-lg bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">Aktifkan</button>
                    : <button onClick={() => action(s.id, "suspend")} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold">Suspend</button>}
                  {s.is_demo
                    ? <button onClick={() => action(s.id, "demo_off")} className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Batal Demo</button>
                    : <button onClick={() => action(s.id, "demo_on")} className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold">Jadikan Demo</button>}
                  <button onClick={() => setResetFor(resetFor === s.id ? null : s.id)} className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold">Reset PW Owner</button>
                </div>
              )}
              <NamaStoreEdit store={s} onSaved={load} />
              {resetFor === s.id && <ResetOwnerPassword store_id={s.id} email={s.owner_email} onDone={() => setResetFor(null)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// SATU logo aplikasi untuk SEMUA site (khusus admin platform). Upload ke bucket
// qris lalu simpan lewat API server (cek admin platform + service role).
function AppLogoEditor() {
  const brand = useBrand();
  const current = brand.logo;
  const [file, setFile] = useState(null);
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const shown = prev || current || DEFAULT_LOGO;

  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(""); setMsg("");
    try { const png = await toSquarePng(f); setFile(png); setPrev(URL.createObjectURL(png)); }
    catch { setErr("Gambar tidak bisa dibaca. Coba file PNG/JPG lain."); }
  }

  async function persist(logo_url) {
    const t = await token();
    const res = await fetch("/api/admin/app-logo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ logo_url }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Gagal menyimpan logo.");
    refreshBrand();
  }

  async function save() {
    if (!file) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const path = `logo-app-${Date.now()}.png`;
      const { error } = await supabase.storage.from("qris").upload(path, file, { upsert: true, cacheControl: "31536000", contentType: "image/png" });
      if (error) throw error;
      await persist(supabase.storage.from("qris").getPublicUrl(path).data.publicUrl);
      setFile(null); setPrev(null);
      setMsg("Logo tersimpan & berlaku untuk semua site.");
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }

  async function reset() {
    if (!(await confirmDialog({ title: "Kembalikan logo bawaan?", message: "Logo SEMUA site akan kembali ke logo bawaan.", confirmLabel: "Kembalikan" }))) return;
    setBusy(true); setErr(""); setMsg("");
    try { await persist(null); setFile(null); setPrev(null); setMsg("Logo dikembalikan ke bawaan."); }
    catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }

  return (
    <div className="card mb-4 p-4">
      <h2 className="font-bold">🖼️ Logo Aplikasi (semua site)</h2>
      <p className="mb-3 text-xs text-ink-soft">
        Satu logo untuk SEMUA kantin: header toko, struk, admin, halaman login/landing, dan ikon aplikasi di HP pelanggan.
        Gunakan gambar persegi min. 512×512 px (PNG); non-persegi otomatis dipotong di tengah.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="Logo" className="h-16 w-16 rounded-[18px] object-contain" style={{ background: "repeating-conic-gradient(#eef1f6 0% 25%, #fff 0% 50%) 50% / 12px 12px" }} />
          <p className="mt-1 text-[10px] text-ink-soft">Ikon aplikasi</p>
        </div>
        <div className="w-52 overflow-hidden rounded-xl text-white" style={{ background: "linear-gradient(150deg,#16397a,#0f2a5c 55%,#0a1d42)" }}>
          <div className="flex items-center gap-2 px-3 pt-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="" className="h-7 w-7 object-contain" />
            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/80">Header toko</span>
          </div>
          <p className="px-3 pb-2.5 pt-1.5 text-xs font-extrabold">Nama Kantin</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="btn-outline cursor-pointer">
          Pilih gambar
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
        </label>
        <Button onClick={save} loading={busy} disabled={!file}>Simpan logo</Button>
        {current && <button onClick={reset} disabled={busy} className="btn-ghost text-danger">Kembalikan bawaan</button>}
      </div>
      {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
    </div>
  );
}

// Ubah nama store resmi (sesuai kode site) — beda dari nama kantin untuk pembeli.
function NamaStoreEdit({ store, onSaved }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(store.nama_store || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setBusy(true); setErr("");
    const t = await token();
    const res = await fetch("/api/admin/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ store_id: store.id, action: "set_nama_store", nama_store: val }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(j.error || "Gagal menyimpan.");
    setOpen(false); onSaved();
  }
  if (!open) return (
    <button onClick={() => { setVal(store.nama_store || ""); setOpen(true); }} className="mt-2 rounded-lg bg-surface px-2 py-1 text-xs font-semibold">✏️ Nama store</button>
  );
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input className="input max-w-xs py-1.5 text-sm" value={val} onChange={(e) => setVal(e.target.value)} placeholder="INFORMA ..." />
      <Button onClick={save} loading={busy} className="btn-xs">Simpan</Button>
      <button onClick={() => setOpen(false)} className="btn-ghost btn-xs">Batal</button>
      {err && <p className="w-full text-xs text-danger">{err}</p>}
    </div>
  );
}

function F({ label, children }) {
  return <div><label className="mb-1 block text-xs font-semibold">{label}</label>{children}</div>;
}

// Platform-admin reset password OWNER sebuah store (manual, tanpa email).
function ResetOwnerPassword({ store_id, email, onDone }) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function save() {
    setErr(""); setMsg("");
    if (pw.length < 6) return setErr("Password minimal 6 karakter.");
    setSaving(true);
    const t = await token();
    const res = await fetch("/api/admin/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ store_id, action: "reset_owner_password", password: pw }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal reset password.");
    setMsg(`Password owner${email ? " (" + email + ")" : ""} berhasil diganti.`);
    setPw("");
    setTimeout(() => onDone?.(), 1500);
  }

  return (
    <div className="mt-2 rounded-xl bg-surface p-3">
      <p className="mb-2 text-xs font-semibold">Set password baru untuk owner {email || "store ini"}:</p>
      <div className="flex gap-2">
        <input className="input flex-1" type="text" placeholder="Password baru (min. 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button onClick={save} loading={saving} className="shrink-0">Simpan</Button>
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
    </div>
  );
}

// Pengaturan landing (nomor WA & harga) — hanya platform-admin.
function LandingSettings() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const t = await token();
      const res = await fetch("/api/admin/platform-settings", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
      const j = await res.json();
      if (res.ok) setS(j.settings || {});
    })();
  }, []);

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    const t = await token();
    const res = await fetch("/api/admin/platform-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(s),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(j.error || "Gagal menyimpan.");
    if (j.warning) setErr(j.warning);
    setMsg("Pengaturan tersimpan.");
    refreshBrand();
  }

  if (!s) return null;

  // Pratinjau logo dari isian form (disaring sama seperti saat disimpan).
  const preview = normalizeBrand({ app_name: s.app_name ?? "DKantin", app_tagline: s.app_tagline ?? "Digital Kantin", app_brand_style: s.app_brand_style });
  const st = preview.style;
  const setStyle = (k, v) => set("app_brand_style", { ...st, [k]: v });

  return (
    <div className="card mb-4 space-y-3 p-4">
      <h2 className="font-bold">Pengaturan Landing Page</h2>
      <p className="-mt-1 text-xs text-ink-soft">Nama aplikasi, nomor WhatsApp & info harga yang tampil di landing dan seluruh aplikasi.</p>

      <div className="space-y-3 rounded-xl bg-surface p-3">
        <div>
          <p className="text-xs font-bold">Nama &amp; Desain Logo Aplikasi</p>
          <p className="text-[11px] text-ink-soft">Tampil di landing, login, sidebar admin &amp; AM, header toko, Kantin TV, judul tab, dan laporan PDF.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Nama aplikasi">
            <input id="brand-name" className="input" maxLength={40} value={s.app_name ?? "DKantin"} onChange={(e) => set("app_name", e.target.value)} placeholder="DKantin" />
          </F>
          <F label="Keterangan / tagline">
            <input id="brand-tagline" className="input" maxLength={60} value={s.app_tagline ?? "Digital Kantin"} onChange={(e) => set("app_tagline", e.target.value)} placeholder="Digital Kantin" />
          </F>
        </div>

        {/* Pratinjau di latar terang & gelap */}
        <div className="grid grid-cols-2 gap-2">
          <div className="grid min-h-[84px] place-items-center rounded-xl border border-gray-100 bg-white p-3 text-center text-ink">
            <div>
              <BrandLogo brand={preview} style={{ fontSize: 28 }} />
              {st.showTagline && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{preview.tagline}</p>}
            </div>
          </div>
          <div className="grid min-h-[84px] place-items-center rounded-xl bg-[#1B2E54] p-3 text-center text-white">
            <div>
              <BrandLogo brand={preview} style={{ fontSize: 28 }} />
              {st.showTagline && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/60">{preview.tagline}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <F label="Huruf depan beraksen">
            <select id="brand-accent-count" className="input" value={st.accentCount} onChange={(e) => setStyle("accentCount", Number(e.target.value))}>
              <option value={0}>Tanpa aksen (polos)</option>
              <option value={1}>1 huruf ({(preview.name || "D").slice(0, 1)})</option>
              <option value={2}>2 huruf ({(preview.name || "DK").slice(0, 2)})</option>
              <option value={3}>3 huruf ({(preview.name || "DKa").slice(0, 3)})</option>
            </select>
          </F>
          <F label="Gaya aksen">
            <select id="brand-accent-style" className="input" value={st.accentStyle} disabled={st.accentCount === 0} onChange={(e) => setStyle("accentStyle", e.target.value)}>
              <option value="plain">Warna saja</option>
              <option value="box">Dalam kotak</option>
              <option value="circle">Dalam bulatan</option>
              <option value="underline">Garis bawah</option>
            </select>
          </F>
          <F label="Warna aksen">
            <input id="brand-accent-color" type="color" className="h-10 w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-1" value={st.accentColor} disabled={st.accentCount === 0} onChange={(e) => setStyle("accentColor", e.target.value)} />
          </F>
          <F label={`Ukuran aksen (×${st.accentScale.toFixed(2)})`}>
            <input id="brand-accent-scale" type="range" min="0.8" max="2" step="0.05" className="w-full accent-primary" value={st.accentScale} disabled={st.accentCount === 0} onChange={(e) => setStyle("accentScale", Number(e.target.value))} />
          </F>
          {(st.accentStyle === "box" || st.accentStyle === "circle") && st.accentCount > 0 && (
            <F label="Warna huruf di kotak/bulatan">
              <input id="brand-accent-text" type="color" className="h-10 w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-1" value={st.accentTextColor} onChange={(e) => setStyle("accentTextColor", e.target.value)} />
            </F>
          )}
          <F label="Warna teks utama">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold">
                <input id="brand-text-auto" type="checkbox" className="h-4 w-4 accent-primary" checked={!st.textColor} onChange={(e) => setStyle("textColor", e.target.checked ? "" : "#14213D")} />
                Ikuti latar
              </label>
              {st.textColor && (
                <input id="brand-text-color" type="color" className="h-10 flex-1 cursor-pointer rounded-lg border border-gray-200 bg-white p-1" value={st.textColor} onChange={(e) => setStyle("textColor", e.target.value)} />
              )}
            </div>
          </F>
          <F label="Ketebalan huruf">
            <select id="brand-weight" className="input" value={st.weight} onChange={(e) => setStyle("weight", Number(e.target.value))}>
              <option value={500}>Normal</option>
              <option value={600}>Agak tebal</option>
              <option value={700}>Tebal</option>
              <option value={800}>Sangat tebal</option>
            </select>
          </F>
          <F label={`Jarak huruf (${st.tracking.toFixed(2)}em)`}>
            <input id="brand-tracking" type="range" min="-0.08" max="0.3" step="0.01" className="w-full accent-primary" value={st.tracking} onChange={(e) => setStyle("tracking", Number(e.target.value))} />
          </F>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input id="brand-upper" type="checkbox" className="h-4 w-4 accent-primary" checked={st.uppercase} onChange={(e) => setStyle("uppercase", e.target.checked)} />
            Huruf kapital semua
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input id="brand-show-tagline" type="checkbox" className="h-4 w-4 accent-primary" checked={st.showTagline} onChange={(e) => setStyle("showTagline", e.target.checked)} />
            Tampilkan tagline
          </label>
          <button type="button" className="text-sm font-semibold text-primary" onClick={() => set("app_brand_style", { ...DEFAULT_STYLE })}>
            Kembalikan gaya default
          </button>
        </div>
      </div>
      <F label="Nomor WhatsApp (format 62xxx)">
        <input className="input" value={s.wa_number || ""} onChange={(e) => set("wa_number", e.target.value)} placeholder="628123456789" />
      </F>
      <div className="grid grid-cols-2 gap-3">
        <F label="Harga (label)">
          <input className="input" value={s.harga_label || ""} onChange={(e) => set("harga_label", e.target.value)} placeholder="Rp50.000" />
        </F>
        <F label="Keterangan harga">
          <input className="input" value={s.harga_note || ""} onChange={(e) => set("harga_note", e.target.value)} placeholder="/4 bulan" />
        </F>
      </div>

      <div className="rounded-xl bg-surface p-3">
        <p className="mb-2 text-xs font-bold">Voucher Langganan Otomatis (QRIS)</p>
        <p className="-mt-1 mb-2 text-[11px] text-ink-soft">Nominal yang ditagih saat store membeli/perpanjang langganan lewat QRIS otomatis (masuk ke akun Casaku Anda).</p>
        <div className="grid grid-cols-2 gap-3">
          <F label="Harga tagih (angka, cth 200000)">
            <input className="input" type="number" min="0" value={s.langganan_harga || ""} onChange={(e) => set("langganan_harga", e.target.value)} placeholder="200000" />
          </F>
          <F label="Durasi voucher (hari)">
            <input className="input" type="number" min="1" value={s.langganan_durasi_hari ?? 120} onChange={(e) => set("langganan_durasi_hari", e.target.value)} placeholder="120" />
          </F>
        </div>
      </div>
      {msg && <p className="text-sm text-success">{msg}</p>}
      {err && <p className="text-sm text-danger">{err}</p>}
      <Button onClick={save} loading={saving} className="btn-block">Simpan Pengaturan</Button>
    </div>
  );
}
