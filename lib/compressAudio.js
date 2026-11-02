"use client";
// Kompres file audio apa pun → MP3 mono (default 96kbps) di browser, pakai
// lamejs (dimuat dari CDN). Dipakai saat upload musik Kantin TV agar file ringan.

let _lame = null;
function loadLame() {
  if (typeof window !== "undefined" && window.lamejs) return Promise.resolve(window.lamejs);
  if (!_lame) {
    _lame = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";
      s.onload = () => res(window.lamejs);
      s.onerror = () => rej(new Error("Gagal memuat encoder audio."));
      document.head.appendChild(s);
    });
  }
  return _lame;
}

export async function compressAudio(file, kbps = 96) {
  const lame = await loadLame();
  const arr = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const audio = await ctx.decodeAudioData(arr);

  // Mixdown ke mono (hemat ukuran, cukup untuk musik latar).
  const ch = audio.numberOfChannels;
  const len = audio.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += d[i] / ch;
  }
  const samples = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const sr = [48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000].includes(audio.sampleRate)
    ? audio.sampleRate : 44100;
  const enc = new lame.Mp3Encoder(1, sr, kbps);
  const block = 1152;
  const chunks = [];
  for (let i = 0; i < samples.length; i += block) {
    const buf = enc.encodeBuffer(samples.subarray(i, i + block));
    if (buf.length) chunks.push(new Int8Array(buf));
  }
  const end = enc.flush();
  if (end.length) chunks.push(new Int8Array(end));
  try { ctx.close(); } catch {}
  return new Blob(chunks, { type: "audio/mpeg" });
}
