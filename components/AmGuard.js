"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyAm, clearAmCache } from "@/lib/am";
import AmShell from "@/components/AmShell";
import Button from "@/components/Button";

// Guard area AM: butuh sesi login + terdaftar di am_accounts.
// State: loading | no_session | not_am | ok
export default function AmGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState("loading");
  const isLogin = pathname === "/am/login";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setState("no_session");
        if (!isLogin) router.replace("/am/login");
        return;
      }
      const am = await getMyAm({ force: true });
      if (!am) { setState("not_am"); return; } // sesi milik akun lain (mis. admin store)
      if (isLogin) { router.replace("/am/area"); return; }
      setState("ok");
    })();
  }, [pathname]);

  // Sesi ada tapi bukan AM → jangan redirect (bisa loop). Minta logout dulu.
  if (state === "not_am") return <NotAmScreen router={router} />;

  if (isLogin && state === "no_session") return <main className="min-h-screen bg-surface">{children}</main>;
  if (state !== "ok") return <div className="grid min-h-screen place-items-center text-ink-soft">Memuat...</div>;
  return <AmShell>{children}</AmShell>;
}

function NotAmScreen({ router }) {
  const [email, setEmail] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email || ""));
  }, []);

  async function logout() {
    setLoggingOut(true);
    clearAmCache();
    await supabase.auth.signOut();
    router.replace("/am/login");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <div className="card w-full max-w-sm p-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-600">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
        </div>
        <h1 className="text-lg font-extrabold text-ink">Bukan Akun Area Manager</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Anda sedang login sebagai <b>{email || "akun lain"}</b>. Untuk masuk sebagai Area Manager, logout dulu lalu masuk dengan akun AM.
        </p>
        <div className="mt-5">
          <Button variant="primary" loading={loggingOut} onClick={logout} className="btn-block">
            Logout & Masuk sebagai AM
          </Button>
        </div>
      </div>
    </div>
  );
}
