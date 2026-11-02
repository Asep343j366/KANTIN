"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyStore } from "@/lib/store";
import { compressAudio } from "@/lib/compressAudio";
import { confirmDialog } from "@/lib/confirmDialog";
import Button from "@/components/Button";

export default function MusikTVPage() {
  const [storeId, setStoreId] = useState(null);
  const [slug, setSlug] = useState("");
  const [list, setList] = useState([]);
  const [aktif, setAktif] = useState(true);
  const [volume, setVolume] = useState(55);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const audioRef = useRef(null);

  async function load() {
    const st = await getMyStore();
    if (!st?.store_id) { setLoading(false); return; }
    setStoreId(st.store_id);
    setSlug(st.store?.slug || "");
    const [{ data: musik }, { data: set }] = await Promise.all([
      supabase.from("tv_musik").select("*").eq("store_id", st.store_id).order("urutan"),
      supabase.from("settings").select("musik_aktif, musik_volume").eq("store_id", st.store_id).maybeSingle(),
    ]);
    setList(musik || []);
    if (set) { setAktif(set.musik_aktif ?? true); setVolume(set.musik_volume ?? 55); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function saveSetting(next) {
    if (!storeId) return;
    await supabase.from("settings").upsert({ store_id: storeId, ...next }, { onConflict: "store_id" });
  }

  async function onUpload(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !storeId) return;
    setErr(""); setMsg(""); setBusy("Mengompres & mengunggah…");
    try {
      // Kompres ke MP3 96kbps; bila format tak bisa di-decode, upload apa adanya.
      let blob, ext = "mp3", ctype = "audio/mpeg";
      try {
        blob = await compressAudio(f, 96);
      } catch {
        setBusy("Mengunggah (tanpa kompres)…");
        blob = f;
        ext = (f.name.split(".").pop() || "mp3").toLowerCase();
        ctype = f.type || "audio/mpeg";
      }
      const path = `musik-${storeId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("kantin-musik").upload(path, blob, {
        upsert: true, contentType: ctype,
      });
      if (upErr) throw upErr;
      const url = supabase.storage.from("kantin-musik").getPublicUrl(path).data.publicUrl;
      const nama = f.name.replace(/\.[^.]+$/, "");
      const urutan = (list.reduce((m, x) => Math.max(m, x.urutan), 0) || 0) + 1;
      const { error: insErr } = await supabase.from("tv_musik").insert({ store_id: storeId, nama, url, urutan });
      if (insErr) throw insErr;
      setMsg(`Lagu "${nama}" ditambahkan.`);
      load();
    } catch (e2) {
      setErr("Gagal: " + (e2.message || e2));
    }
    setBusy("");
  }

  async function hapus(row) {
    if (!(await confirmDialog({
      title: "Hapus Lagu",
      message: `Hapus "${row.nama || "lagu ini"}" dari playlist?`,
      confirmLabel: "Ya, Hapus", danger: true,
    }))) return;
    try {
      const path = row.url.split("/kantin-musik/")[1];
      if (path) await supabase.storage.from("kantin-musik").remove([path]);
    } catch {}
    await supabase.from("tv_musik").delete().eq("id", row.id);
    load();
  }

  async function geser(row, arah) {
    const i = list.findIndex((x) => x.id === row.id);
    const j = i + arah;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    await Promise.all([
      supabase.from("tv_musik").update({ urutan: b.urutan }).eq("id", a.id),
      supabase.from("tv_musik").update({ urutan: a.urutan }).eq("id", b.id),
    ]);
    load();
  }

  function preview(url) {
    if (!audioRef.current) return;
    if (audioRef.current.src === url && !audioRef.current.paused) { audioRef.current.pause(); return; }
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
  }

  if (loading) return <p className="text-ink-soft">Memuat...</p>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const tvUrl = `${origin}/s/${slug || "<slug>"}/tv`;
  const chromeCmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --autoplay-policy=no-user-gesture-required --kiosk --app=${tvUrl}`;

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">Musik TV</h1>
      <p className="mb-4 text-sm text-ink-soft">
        Lagu yang diputar sebagai musik latar di layar Kantin TV (<code>/s/&lt;slug&gt;/tv</code>),
        berurutan &amp; berulang sepanjang hari. File otomatis dikompres agar ringan.
      </p>

      <div className="card mb-4 space-y-3 p-4">
        <label className="flex items-center justify-between">
          <span className="font-semibold">Putar musik di Kantin TV</span>
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={aktif}
            onChange={(e) => { setAktif(e.target.checked); saveSetting({ musik_aktif: e.target.checked }); }} />
        </label>
        <div>
          <div className="mb-1 flex justify-between text-sm font-semibold">
            <span>Volume</span><span>{volume}%</span>
          </div>
          <input type="range" min="0" max="100" value={volume} className="w-full accent-primary"
            onChange={(e) => setVolume(parseInt(e.target.value))}
            onMouseUp={(e) => saveSetting({ musik_volume: parseInt(e.target.value) })}
            onTouchEnd={(e) => saveSetting({ musik_volume: parseInt(e.target.value) })} />
        </div>
      </div>

      <div className="card mb-4 p-4">
        <label className={`btn-primary inline-flex cursor-pointer items-center gap-2 ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy || "+ Tambah Lagu"}
          <input type="file" accept="audio/*,audio/mpeg,.mp3,.mpeg,.m4a,.aac,.wav,.ogg" className="hidden" onChange={onUpload} disabled={!!busy} />
        </label>
        {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      </div>

      <details className="card mb-4 p-4">
        <summary className="cursor-pointer font-bold">🔊 Setting autoplay suara otomatis (opsional)</summary>
        <p className="mt-2 text-sm text-ink-soft">
          Browser memblokir suara otomatis, jadi di TV biasanya perlu <b>sekali sentuh/klik</b> tombol
          "Nyalakan musik". Agar benar-benar otomatis tanpa disentuh (mode kiosk), atur browser:
        </p>

        <p className="mt-3 text-sm font-bold">Google Chrome (Windows)</p>
        <p className="text-xs text-ink-soft">
          Buat shortcut Chrome, klik kanan → Properties → kolom <b>Target</b> isi persis seperti ini
          (jalankan via shortcut itu):
        </p>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-surface p-3 text-xs">{chromeCmd}</pre>
        <p className="mt-1 text-xs text-ink-soft">
          Kunci: flag <code>--autoplay-policy=no-user-gesture-required</code>. Tutup semua Chrome dulu sebelum menjalankan shortcut ini.
        </p>

        <p className="mt-3 text-sm font-bold">Mozilla Firefox</p>
        <p className="text-xs text-ink-soft">
          Ketik <code>about:config</code> di address bar → terima risiko → cari{" "}
          <code>media.autoplay.default</code> → ubah nilainya jadi <b>0</b> (Allow audio and video).
          Lalu buka halaman TV dan reload. (Opsional: <code>media.autoplay.blocking_policy</code> = <b>0</b>.)
        </p>

        <p className="mt-3 text-xs text-ink-soft">Alamat layar TV kantin ini:</p>
        <code className="block break-all text-xs font-semibold text-primary">{tvUrl}</code>
      </details>

      {list.length === 0 ? (
        <p className="text-ink-soft">Belum ada lagu. Tambahkan minimal satu agar musik berputar.</p>
      ) : (
        <div className="space-y-2">
          {list.map((row, i) => (
            <div key={row.id} className="card flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold">{i + 1}</span>
                <span className="truncate font-semibold">{row.nama || "Lagu"}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => preview(row.url)} className="btn-outline btn-xs">▶︎/⏸</button>
                <button onClick={() => geser(row, -1)} disabled={i === 0} className="text-ink-soft disabled:opacity-30">↑</button>
                <button onClick={() => geser(row, 1)} disabled={i === list.length - 1} className="text-ink-soft disabled:opacity-30">↓</button>
                <button onClick={() => hapus(row)} className="text-sm font-semibold text-danger">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
