import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Pemanggil harus admin login + owner store. Kembalikan store_id & role.
async function requireOwner(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: mem } = await admin()
    .from("store_members")
    .select("store_id, role")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  if (!mem?.store_id) return null;
  return { user: data.user, store_id: mem.store_id, role: mem.role };
}

export async function GET(request) {
  const me = await requireOwner(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await admin()
    .from("store_payment_config")
    .select("*")
    .eq("store_id", me.store_id)
    .maybeSingle();

  const { data: st } = await admin().from("stores").select("is_platform_admin").eq("id", me.store_id).maybeSingle();
  const is_platform = !!st?.is_platform_admin;

  if (data) return Response.json({ config: data, is_platform });

  // Belum ada baris di DB tapi ENV Casaku ada → server MEMANG memakai ENV untuk
  // store ini (lihat lib/paymentConfig.js). Tampilkan nilainya agar form tidak
  // menyesatkan ("manual"), dan sekali "Simpan" → pindah permanen ke database.
  if (process.env.CASAKU_LICENSE_KEY) {
    return Response.json({
      is_platform,
      from_env: true,
      config: {
        store_id: me.store_id,
        mode: "casaku",
        license_key: process.env.CASAKU_LICENSE_KEY,
        qr_id: process.env.CASAKU_QR_ID || "",
        webhook_secret: process.env.CASAKU_WEBHOOK_SECRET || "",
        package_ids: process.env.CASAKU_PACKAGE_IDS || "id.dana",
        expire_minutes: Number(process.env.CASAKU_EXPIRE_MINUTES) || 1440,
        base_url: process.env.CASAKU_BASE_URL || "https://api.casaku.id",
        active: true,
      },
    });
  }

  return Response.json({ config: { store_id: me.store_id, mode: "manual", active: true }, is_platform });
}

export async function POST(request) {
  const me = await requireOwner(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (me.role !== "owner") return Response.json({ error: "Hanya owner yang boleh mengubah pembayaran." }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const mode = b.mode === "casaku" ? "casaku" : "manual";

  if (mode === "casaku") {
    if (!b.license_key || !b.qr_id || !b.webhook_secret) {
      return Response.json({ error: "Mode Casaku butuh License Key, QR ID, dan Webhook Secret." }, { status: 400 });
    }
  }

  // Mode manual: kredensial Casaku yang sudah tersimpan TIDAK dihapus bila form
  // mengirim kosong (dipakai lagi saat kembali ke Casaku, dan oleh store platform
  // untuk menagih langganan store lain).
  const { data: prev } = await admin()
    .from("store_payment_config").select("*").eq("store_id", me.store_id).maybeSingle();
  const keep = (k) => b[k] || (mode === "manual" ? prev?.[k] : null) || null;

  const payload = {
    store_id: me.store_id,
    mode,
    license_key: keep("license_key"),
    qr_id: keep("qr_id"),
    webhook_secret: keep("webhook_secret"),
    package_ids: b.package_ids || prev?.package_ids || "id.dana",
    expire_minutes: parseInt(b.expire_minutes) || 1440,
    base_url: b.base_url || prev?.base_url || "https://api.casaku.id",
    active: b.active !== false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin()
    .from("store_payment_config")
    .upsert(payload, { onConflict: "store_id" });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
