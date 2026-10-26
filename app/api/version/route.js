// Mengembalikan identitas versi deploy saat ini. Dipakai client (PWARegister)
// untuk mendeteksi deploy baru → menampilkan banner "Muat Ulang".
// Vercel otomatis mengisi VERCEL_GIT_COMMIT_SHA / VERCEL_DEPLOYMENT_ID tiap deploy.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const v =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    "dev";
  return new Response(JSON.stringify({ v }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
