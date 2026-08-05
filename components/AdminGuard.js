"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyAm } from "@/lib/am";
import AdminShell from "@/components/AdminShell";

export default function AdminGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const has = !!data.session;
      if (!has) {
        setAuthed(false); setReady(true);
        if (!isLogin) router.replace("/admin/login");
        return;
      }
      // Akun Area Manager TIDAK boleh masuk panel admin store (hanya area AM).
      // Cegah akses lewat set URL /admin secara manual.
      const am = await getMyAm();
      if (am) { router.replace("/am/area"); return; }

      setAuthed(true); setReady(true);
      if (isLogin) router.replace("/admin");
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, [pathname]);

  if (!ready) return <div className="grid min-h-screen place-items-center text-ink-soft">Memuat...</div>;
  if (isLogin) return <main className="min-h-screen bg-surface">{children}</main>;
  if (!authed) return null;

  return <AdminShell>{children}</AdminShell>;
}
