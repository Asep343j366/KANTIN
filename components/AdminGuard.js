"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminShell from "@/components/AdminShell";

export default function AdminGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const has = !!data.session;
      setAuthed(has);
      setReady(true);
      if (!has && !isLogin) router.replace("/admin/login");
      if (has && isLogin) router.replace("/admin");
    });
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
