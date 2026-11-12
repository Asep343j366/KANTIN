"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";
import { useSlug, storePath } from "@/lib/slug";
import { useStore } from "../StoreProvider";
import { Icon } from "@/components/store/fx";
import { reorder } from "@/components/store/reorder";

export default function OrderLookup() {
  const slug = useSlug();
  const store = useStore();
  const [kode, setKode] = useState("");
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!store?.id) return;
    let last = null;
    try { last = JSON.parse(localStorage.getItem("kantin_last_customer") || "null"); } catch {}
    setCustomer(last);
    if (last?.nama) {
      supabase.from("orders").select("*")
        .eq("store_id", store.id)
        .in("status", ["selesai", "menunggu_pembayaran"])
        .eq("nama_pelanggan", last.nama)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          // Utamakan yang no HP-nya cocok bila ada
          let rows = data || [];
          if (last.hp) {
            const match = rows.filter((r) => r.no_hp === last.hp);
            if (match.length) rows = match;
          }
          setHistory(rows);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [store?.id]);

  async function onReorder(e, o) {
    e.preventDefault(); e.stopPropagation();
    setBusyId(o.id); setMsg("");
    try {
      const r = await reorder(o.id);
      if (r.added) router.push(storePath(slug, "/cart"));
      else setMsg("Menu di pesanan itu sedang habis semua.");
    } catch { setMsg("Gagal memuat ulang pesanan. Coba lagi."); }
    setBusyId(null);
  }

  return (
    <main className="pb-28">
      <header className="zk-hero relative overflow-hidden rounded-b-[28px] px-4 pb-14 pt-6 text-white">
        <span className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/[0.07]" />
        <div className="container-app relative px-0">
          <h1 className="zk-up text-2xl font-extrabold">Pesanan saya</h1>
          <p className="zk-up text-sm text-[#b8c4dd]" style={{ animationDelay: ".05s" }}>
            {customer?.nama ? <>Riwayat a.n. <b className="text-white">{customer.nama}</b></> : "Riwayat & lacak pesananmu"}
          </p>
        </div>
      </header>

      <div className="container-app relative z-10 -mt-8">
        {/* Lacak via kode */}
        <form onSubmit={(e) => { e.preventDefault(); kode.trim() && router.push(storePath(slug, `/order/${kode.trim()}`)); }}
          className="zk-card zk-up flex items-center gap-2 p-2 pl-4" style={{ animationDelay: ".08s" }}>
          <span className="text-[#6b7591]">{Icon.search()}</span>
          <input value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} placeholder="Lacak kode KTN-XXXXXX-XXXX"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#14213d] outline-none placeholder:text-[#9aa3b8]" />
          <button className="zk-navy zk-press shrink-0 rounded-xl px-4 py-2.5 text-xs font-extrabold">Lacak</button>
        </form>

        {msg && <p className="mt-3 rounded-2xl bg-[#fff3e0] px-4 py-3 text-center text-sm font-semibold text-[#a35a0a]">{msg}</p>}

        <div className="mt-5 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="zk-shimmer h-28 rounded-[1.1rem]" />)
          ) : !customer?.nama || history.length === 0 ? (
            <div className="zk-up py-12 text-center">
              <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-[#e1e8f6] text-[#0f2a5c]">{Icon.receipt(32)}</div>
              <p className="font-extrabold text-[#14213d]">Belum ada pesanan</p>
              <p className="mt-1 text-sm text-[#6b7591]">Riwayat muncul di sini setelah transaksi pertamamu.</p>
              <Link href={storePath(slug)} className="zk-cta zk-press mt-5 inline-flex rounded-2xl px-6 py-3 text-sm font-extrabold">Lihat menu</Link>
            </div>
          ) : (
            history.map((o, i) => {
              const done = o.payment_status === "paid" || o.status === "selesai";
              return (
                <Link key={o.id} href={storePath(slug, `/order/${o.kode_pesanan}`)}
                  className="zk-card zk-up zk-press block p-4" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-extrabold text-[#14213d]">{o.kode_pesanan}</span>
                    {done ? (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Selesai</span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#fff3e0] px-2.5 py-0.5 text-[11px] font-bold text-[#a35a0a]">
                        <span className="zk-pulse h-1.5 w-1.5 rounded-full bg-[#ffb36b]" />Menunggu
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#6b7591]">{fmtDateTime(o.created_at)}</p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-base font-extrabold text-[#0f2a5c]">{rupiah(o.total)}</span>
                    {done ? (
                      <button onClick={(e) => onReorder(e, o)} disabled={busyId === o.id}
                        className="flex items-center gap-1 rounded-xl bg-[#e1e8f6] px-3 py-1.5 text-xs font-extrabold text-[#0f2a5c] disabled:opacity-60">
                        {Icon.refresh(13)} {busyId === o.id ? "Memuat…" : "Pesan lagi"}
                      </button>
                    ) : (
                      <span className="text-xs font-extrabold text-[#c2560f]">Bayar sekarang →</span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
