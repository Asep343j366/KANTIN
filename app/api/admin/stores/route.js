import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function requirePlatformAdmin(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: mem } = await admin()
    .from("store_members")
    .select("stores(is_platform_admin)")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  if (!mem?.stores?.is_platform_admin) return null;
  return { user: data.user };
}

// slug = kode_site(lower) + '-' + 3 huruf acak (biar tak mudah ditebak store lain)
function makeSlug(kodeSite) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz";
  const rnd = Array.from({ length: 3 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  return `${kodeSite.toLowerCase().replace(/[^a-z0-9]/g, "")}-${rnd}`;
}

export async function GET(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = admin();
  const { data: stores } = await db
    .from("stores")
    .select("id, kode_site, slug, nama, status, is_platform_admin, langganan_until, created_at")
    .order("created_at", { ascending: true });

  // Peta owner email
  const { data: owners } = await db.from("store_members").select("store_id, user_id").eq("role", "owner");
  const { data: userList } = await db.auth.admin.listUsers();
  const emailById = {}; (userList?.users || []).forEach((u) => (emailById[u.id] = u.email));
  const ownerByStore = {}; (owners || []).forEach((o) => { if (!ownerByStore[o.store_id]) ownerByStore[o.store_id] = emailById[o.user_id]; });

  const rows = (stores || []).map((s) => ({ ...s, owner_email: ownerByStore[s.id] || null }));
  return Response.json({ stores: rows });
}

export async function POST(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const kode_site = (b.kode_site || "").trim();
  const nama = (b.nama || "").trim();
  const owner_email = (b.owner_email || "").trim();
  const owner_password = b.owner_password || "";
  const trial_days = parseInt(b.trial_days) || 0;

  if (!kode_site || !nama) return Response.json({ error: "Kode Site & Nama wajib." }, { status: 400 });
  if (!owner_email || owner_password.length < 6)
    return Response.json({ error: "Email owner & password (min 6) wajib." }, { status: 400 });

  const db = admin();

  // Cek kode_site unik
  const { data: exists } = await db.from("stores").select("id").eq("kode_site", kode_site).maybeSingle();
  if (exists) return Response.json({ error: "Kode Site sudah dipakai." }, { status: 400 });

  const langganan_until = trial_days > 0
    ? new Date(Date.now() + trial_days * 86400000).toISOString()
    : null;

  // 1) Buat store
  const { data: store, error: sErr } = await db
    .from("stores")
    .insert({
      kode_site,
      slug: makeSlug(kode_site),
      nama,
      status: trial_days > 0 ? "aktif" : "nonaktif",
      langganan_until,
    })
    .select()
    .single();
  if (sErr) return Response.json({ error: sErr.message }, { status: 400 });

  // 2) Buat owner auth user
  const { data: userRes, error: uErr } = await db.auth.admin.createUser({
    email: owner_email, password: owner_password, email_confirm: true,
  });
  if (uErr) {
    await db.from("stores").delete().eq("id", store.id); // rollback
    return Response.json({ error: "Gagal buat owner: " + uErr.message }, { status: 400 });
  }

  // 3) Keanggotaan owner + settings + payment config default (manual)
  const { error: mErr } = await db.from("store_members")
    .insert({ store_id: store.id, user_id: userRes.user.id, role: "owner" });
  if (mErr) {
    await db.auth.admin.deleteUser(userRes.user.id);
    await db.from("stores").delete().eq("id", store.id);
    return Response.json({ error: "Gagal menautkan owner: " + mErr.message }, { status: 400 });
  }
  await db.from("settings").insert({ store_id: store.id, nama_kantin: nama });
  await db.from("store_payment_config").insert({ store_id: store.id, mode: "manual" });

  return Response.json({ store: { ...store }, owner_email });
}

export async function PATCH(request) {
  const me = await requirePlatformAdmin(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const { store_id, action } = b;
  if (!store_id || !action) return Response.json({ error: "store_id & action wajib." }, { status: 400 });

  const db = admin();
  const { data: store } = await db.from("stores").select("id, is_platform_admin, langganan_until").eq("id", store_id).maybeSingle();
  if (!store) return Response.json({ error: "Store tidak ditemukan." }, { status: 404 });
  if (store.is_platform_admin) return Response.json({ error: "Store platform tak bisa diubah." }, { status: 400 });

  let patch = {};
  if (action === "suspend") patch = { status: "suspended" };
  else if (action === "activate") patch = { status: "aktif" };
  else if (action === "extend") {
    const days = parseInt(b.days) || 0;
    if (days < 1) return Response.json({ error: "Jumlah hari tidak valid." }, { status: 400 });
    const base = store.langganan_until && new Date(store.langganan_until) > new Date()
      ? new Date(store.langganan_until) : new Date();
    patch = { langganan_until: new Date(base.getTime() + days * 86400000).toISOString(), status: "aktif" };
  } else return Response.json({ error: "Action tidak dikenal." }, { status: 400 });

  const { error } = await db.from("stores").update(patch).eq("id", store_id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
