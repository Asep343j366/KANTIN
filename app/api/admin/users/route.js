import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Pastikan pemanggil adalah admin yang sudah login (punya sesi Supabase valid).
async function requireAuth(request) {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function GET(request) {
  const me = await requireAuth(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await admin().auth.admin.listUsers();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const users = data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at }));
  return Response.json({ users, meId: me.id });
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
  return Response.json({ user: { id: data.user.id, email: data.user.email } });
}

export async function DELETE(request) {
  const me = await requireAuth(request);
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { id } = body;
  if (!id) return Response.json({ error: "id wajib" }, { status: 400 });
  if (id === me.id) return Response.json({ error: "Tidak bisa menghapus akun sendiri." }, { status: 400 });
  const { error } = await admin().auth.admin.deleteUser(id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
