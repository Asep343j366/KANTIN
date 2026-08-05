"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyAm } from "@/lib/am";
import AmShell from "@/components/AmShell";

// Guard area AM: butuh sesi login + terdaftar di am_accounts.
export default function AmGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState("loading"); // loading | denied | ok
  const isLogin = pathname === "/am/login";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setState("denied");
        if (!isLogin) router.replace("/am/login");
        return;
      }
      if (isLogin) { router.replace("/am/area"); return; }
      const am = await getMyAm({ force: true });
      if (!am) { setState("denied"); router.replace("/am/login"); return; }
      setState("ok");
    })();
  }, [pathname]);

  if (isLogin) return <main className="min-h-screen bg-surface">{children}</main>;
  if (state !== "ok") return <div className="grid min-h-screen place-items-center text-ink-soft">Memuat...</div>;
  return <AmShell>{children}</AmShell>;
}
