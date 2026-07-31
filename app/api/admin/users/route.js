import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Pastikan pemanggil admin yang sudah login + kembalikan store_id-nya.
async function requireAuth(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  // Resolusi store admin ini (service role → bypass RLS)
  const { data: mem } = await admin()
    .from("store_members")
    .select("store_id")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  if (!mem?.store_id) return null; // admin tanpa store tak boleh kelola user
  return { user: data.user, store_id: mem.store_id };
}

export async function GET(request) {
  const me = await requireAuth(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Anggota store ini saja
  const { data: members } = await admin()
    .from("store_members")
    .select("user_id, role")
    .eq("store_id", me.store_id);
  const ids = new Set((members || []).map((m) => m.user_id));
  const roleMap = {}; (members || []).forEach((m) => (roleMap[m.user_id] = m.role));

  const { data, error } = await admin().auth.admin.listUsers();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const users = data.users
    .filter((u) => ids.has(u.id))
    .map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, role: roleMap[u.id] }));
  return Response.json({ users, meId: me.user.id });
}

export async function POST(request) {
  const me = await requireAuth(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { email, password } = body;
  if (!email || !password || password.length < 6)
    return Response.json({ error: "Email wajib & password minimal 6 karakter." }, { status: 400 });

  const { data, error } = await admin().auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Tautkan admin baru ke store pemanggil sebagai staff
  const { error: mErr } = await admin()
    .from("store_members")
    .insert({ store_id: me.store_id, user_id: data.user.id, role: "staff" });
  if (mErr) {
    // rollback user agar tak menggantung tanpa store
    await admin().auth.admin.deleteUser(data.user.id);
    return Response.json({ error: "Gagal menautkan admin ke store: " + mErr.message }, { status: 400 });
  }
  return Response.json({ user: { id: data.user.id, email: data.user.email } });
}

export async function DELETE(request) {
  const me = await requireAuth(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { id } = body;
  if (!id) return Response.json({ error: "id wajib" }, { status: 400 });
  if (id === me.user.id) return Response.json({ error: "Tidak bisa menghapus akun sendiri." }, { status: 400 });

  // Hanya boleh hapus anggota store yang sama
  const { data: mem } = await admin()
    .from("store_members")
    .select("user_id")
    .eq("store_id", me.store_id)
    .eq("user_id", id)
    .maybeSingle();
  if (!mem) return Response.json({ error: "User bukan anggota store Anda." }, { status: 403 });

  const { error } = await admin().auth.admin.deleteUser(id); // membership ikut terhapus (cascade)
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
