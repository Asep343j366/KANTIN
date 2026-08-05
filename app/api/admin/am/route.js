import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Hanya owner platform (J366) yang boleh kelola akun Area Manager.
async function requirePlatformAdmin(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: mems } = await admin()
    .from("store_members")
    .select("stores(is_platform_admin)")
    .eq("user_id", data.user.id);
  const isPlatform = (mems || []).some((m) => m.stores?.is_platform_admin);
  if (!isPlatform) return null;
  return { user: data.user };
}

// Normalisasi input daftar site: string dipisah koma/spasi/baris → array kode_site huruf besar unik.
function parseSites(input) {
  if (Array.isArray(input)) input = input.join(",");
  return String(input || "")
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
}

export async function GET(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = admin();
  const { data: ams } = await db
    .from("am_accounts")
    .select("user_id, email, nama, sites, created_at")
    .order("created_at", { ascending: true });
  return Response.json({ ams: ams || [] });
}

export async function POST(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const email = (b.email || "").trim().toLowerCase();
  const nama = (b.nama || "").trim() || "Area Manager";
  const password = b.password || "";
  const sites = parseSites(b.sites);

  if (!email || password.length < 6)
    return Response.json({ error: "Email & password (min 6) wajib." }, { status: 400 });
  if (!sites.length)
    return Response.json({ error: "Minimal 1 site under AM." }, { status: 400 });

  const db = admin();

  // Cek belum jadi AM
  const { data: existAm } = await db.from("am_accounts").select("user_id").eq("email", email).maybeSingle();
  if (existAm) return Response.json({ error: "Email ini sudah terdaftar sebagai AM." }, { status: 400 });

  // Buat / temukan auth user
  let userId = null;
  const { data: userRes, error: uErr } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (uErr) {
    // Kemungkinan email sudah ada sbg user lain (mis. owner store) → tolak agar tak bentrok peran.
    return Response.json({ error: "Gagal buat akun: " + uErr.message }, { status: 400 });
  }
  userId = userRes.user.id;

  const { error: aErr } = await db.from("am_accounts").insert({ user_id: userId, email, nama, sites });
  if (aErr) {
    await db.auth.admin.deleteUser(userId); // rollback
    return Response.json({ error: "Gagal simpan AM: " + aErr.message }, { status: 400 });
  }

  return Response.json({ am: { user_id: userId, email, nama, sites } });
}

export async function PATCH(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const { user_id, action } = b;
  if (!user_id || !action) return Response.json({ error: "user_id & action wajib." }, { status: 400 });

  const db = admin();
  const { data: am } = await db.from("am_accounts").select("user_id").eq("user_id", user_id).maybeSingle();
  if (!am) return Response.json({ error: "AM tidak ditemukan." }, { status: 404 });

  if (action === "update_sites") {
    const sites = parseSites(b.sites);
    if (!sites.length) return Response.json({ error: "Minimal 1 site." }, { status: 400 });
    const { error } = await db.from("am_accounts").update({ sites }).eq("user_id", user_id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true, sites });
  }

  if (action === "reset_password") {
    const password = b.password || "";
    if (password.length < 6) return Response.json({ error: "Password minimal 6 karakter." }, { status: 400 });
    const { error } = await db.auth.admin.updateUserById(user_id, { password });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Action tidak dikenal." }, { status: 400 });
}

export async function DELETE(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const { user_id } = b;
  if (!user_id) return Response.json({ error: "user_id wajib." }, { status: 400 });

  const db = admin();
  // Hapus mapping AM + akun auth-nya (AM bukan owner store, aman dihapus).
  await db.from("am_accounts").delete().eq("user_id", user_id);
  await db.auth.admin.deleteUser(user_id);
  return Response.json({ ok: true });
}
