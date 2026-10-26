"use client";
// Ambil SEMUA baris, melewati batas default Supabase (maks 1000 per request),
// via paginasi .range(). `build` adalah factory yang mengembalikan query baru
// (select + filter + order) setiap dipanggil — WAJIB meng-.order() kolom stabil
// (mis. "id") agar paginasi lengkap & tak dobel.
export async function fetchAllRows(build, pageSize = 1000) {
  let from = 0;
  let out = [];
  for (;;) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error || !data || !data.length) break;
    out = out.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
