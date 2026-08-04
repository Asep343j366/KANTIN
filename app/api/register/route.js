import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

const TRIAL_DAYS = 7;

// kode_site otomatis: 'K' + 4 karakter acak (tak mudah bentrok/ditebak).
function genKodeSite() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const rnd = Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  return `K${rnd}`;
}
// slug = kode_site(lower) + '-' + 3 huruf acak (sama pola dgn admin/stores).
function makeSlug(kodeSite) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz";
  const rnd = Array.from({ length: 3 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  return `${kodeSite.toLowerCase().replace(/[^a-z0-9]/g, "")}-${rnd}`;
}

// Pendaftaran self-service dari landing. TANPA konfirmasi email (email_confirm:true).
// Trial 7 hari otomatis, is_trial=true (badge countdown). Pembayaran default manual.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const nama = (b.nama || "").trim();
  const owner_email = (b.owner_email || "").trim().toLowerCase();
  const owner_password = b.owner_password || "";

  if (!nama) return Response.json({ error: "Nama kantin wajib diisi." }, { status: 400 });
  if (!owner_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner_email))
    return Response.json({ error: "Email tidak valid." }, { status: 400 });
  if (owner_password.length < 6)
    return Response.json({ error: "Password minimal 6 karakter." }, { status: 400 });

  const db = admin();

  // kode_site unik (retry beberapa kali kalau bentrok)
  let kode_site = null;
  for (let i = 0; i < 6; i++) {
    const cand = genKodeSite();
    const { data: ex } = await db.from("stores").select("id").eq("kode_site", cand).maybeSingle();
    if (!ex) { kode_site = cand; break; }
  }
  if (!kode_site) return Response.json({ error: "Gagal membuat kode toko, coba lagi." }, { status: 500 });

  const langganan_until = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();

  // 1) Store (aktif selama trial, tandai is_trial)
  const { data: store, error: sErr } = await db
    .from("stores")
    .insert({
      kode_site,
      slug: makeSlug(kode_site),
      nama,
      status: "aktif",
      is_trial: true,
      langganan_until,
    })
    .select()
    .single();
  if (sErr) return Response.json({ error: sErr.message }, { status: 400 });

  // 2) Owner auth user (tanpa konfirmasi email)
  const { data: userRes, error: uErr } = await db.auth.admin.createUser({
    email: owner_email, password: owner_password, email_confirm: true,
  });
  if (uErr) {
    await db.from("stores").delete().eq("id", store.id); // rollback
    const dup = /already|registered|exists/i.test(uErr.message || "");
    return Response.json(
      { error: dup ? "Email sudah terdaftar. Silakan masuk." : "Gagal membuat akun: " + uErr.message },
      { status: 400 }
    );
  }

  // 3) Keanggotaan owner + settings + payment config default (manual)
  const { error: mErr } = await db.from("store_members")
    .insert({ store_id: store.id, user_id: userRes.user.id, role: "owner" });
  if (mErr) {
    await db.auth.admin.deleteUser(userRes.user.id);
    await db.from("stores").delete().eq("id", store.id);
    return Response.json({ error: "Gagal menautkan akun: " + mErr.message }, { status: 400 });
  }
  await db.from("settings").insert({ store_id: store.id, nama_kantin: nama });
  await db.from("store_payment_config").insert({ store_id: store.id, mode: "manual" });

  return Response.json({ ok: true, slug: store.slug, trial_days: TRIAL_DAYS });
}
