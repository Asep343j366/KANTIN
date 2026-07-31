import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Cron harian: setel status store (aktif/grace/nonaktif) berdasarkan langganan_until.
// Vercel Cron otomatis mengirim header Authorization: Bearer <CRON_SECRET> bila
// CRON_SECRET diset di environment. Tolak selain itu.
async function run(request) {
  const secret = process.env.CRON_SECRET;
  const authz = request.headers.get("authorization") || "";
  if (secret && authz !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { error } = await supabaseAdmin().rpc("refresh_subscription_status");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, at: new Date().toISOString() });
}

export async function GET(request) { return run(request); }
export async function POST(request) { return run(request); }
