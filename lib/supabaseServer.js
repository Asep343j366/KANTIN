import { createClient } from "@supabase/supabase-js";

// Client server-side dengan service role (bypass RLS) — HANYA dipakai di route handler / server.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
