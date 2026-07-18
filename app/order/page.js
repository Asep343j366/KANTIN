"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { rupiah, fmtDateTime } from "@/lib/format";

export default function OrderLookup() {
  const [kode, setKode] = useState("");
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let last = null;
    try { last = JSON.parse(localStorage.getItem("kantin_last_customer") || "null"); } catch {}
    setCustomer(last);
    if (last?.nama) {
      supabase.from("orders").select("*")
        .eq("status", "selesai")
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
  }, []);

  return (
    <main className="container-app pb-10 pt-6">
      <h1 className="text-xl font-extrabold">Pesanan Saya</h1>
      <p className="mt-1 text-sm text-ink-soft">Riwayat & lacak pesananmu.</p>

      {/* Lacak via kode */}
      <div className="card mt-4 p-4">
        <label className="mb-1 block text-sm font-semibold">Lacak dengan Kode Pesanan</label>
        <div className="flex gap-2">
          <input value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())}
            placeholder="KTN-XXXXXX-XXXX" className="input" />
          <button
            onClick={() => kode.trim() && router.push(`/order/${kode.trim()}`)}
            className="btn-primary shrink-0">Lihat</button>
        </div>
      </div>

      {/* Riwayat berdasarkan nama tersimpan */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">Riwayat Pesanan</h2>
          {customer?.nama && <span className="text-xs text-ink-soft">a.n. {customer.nama}</span>}
        </div>

        {loading ? (
          <p className="py-8 text-center text-ink-soft">Memuat...</p>
        ) : !customer?.nama ? (
          <div className="card p-6 text-center text-sm text-ink-soft">
            Belum ada riwayat. Riwayat pesanan akan muncul di sini setelah kamu melakukan transaksi pertama.
          </div>
        ) : history.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-soft">
            Belum ada pesanan atas nama <b>{customer.nama}</b>.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((o) => (
              <Link key={o.id} href={`/order/${o.kode_pesanan}`} className="card block p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{o.kode_pesanan}</span>
                  <span className="badge bg-green-100 text-green-700">Selesai</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm text-ink-soft">
                  <span>{fmtDateTime(o.created_at)}</span>
                  <span className="font-semibold text-primary">{rupiah(o.total)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
