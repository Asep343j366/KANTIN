"use client";
// Kumpulan chart SVG ringan untuk Dashboard AM (konsisten dgn Laporan store).
import { rupiah } from "@/lib/format";

export const PALETTE = ["#1B6FEB", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#14B8A6", "#EC4899", "#6366F1", "#0EA5E9", "#F97316"];

export function Kpi({ c = "#1B6FEB", label, value, sub }) {
  return (
    <div className="card relative overflow-hidden p-3">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: c }} />
      <p className="text-[11px] font-semibold text-ink-soft">{label}</p>
      <p className="mt-1 text-base font-extrabold" style={{ color: "#1E2A3A" }}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-ink-soft">{sub}</p>}
    </div>
  );
}

// Bar horizontal peringkat (leaderboard). items: [{label, value}]
export function BarRank({ items, fmt = (v) => v, unit = "" }) {
  if (!items?.length) return <p className="text-sm text-ink-soft">Belum ada data.</p>;
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.key ?? i} className="flex items-center gap-3 text-xs">
          <span className="w-4 shrink-0 font-bold text-ink-soft">{i + 1}</span>
          <span className="w-28 shrink-0 truncate font-semibold" title={it.label}>{it.label}</span>
          <span className="h-4 flex-1 overflow-hidden rounded bg-surface">
            <span className="block h-full rounded" style={{ width: `${(it.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
          </span>
          <span className="w-24 shrink-0 text-right font-bold">{fmt(it.value)}{unit}</span>
        </div>
      ))}
    </div>
  );
}

// Donut kontribusi. items: [{label, value}]
export function Donut({ items, fmt = rupiah }) {
  const data = (items || []).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="text-sm text-ink-soft">Belum ada data.</p>;
  const R = 60, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = data.map((d, i) => {
    const frac = d.value / total;
    const seg = { color: PALETTE[i % PALETTE.length], dash: frac * C, offset, label: d.label, value: d.value, pct: frac * 100 };
    offset += frac * C;
    return seg;
  });
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width="150" height="150" viewBox="0 0 150 150" className="shrink-0">
        <g transform="translate(75,75) rotate(-90)">
          <circle r={R} fill="none" stroke="#EEF2F7" strokeWidth="20" />
          {segs.map((s, i) => (
            <circle key={i} r={R} fill="none" stroke={s.color} strokeWidth="20"
              strokeDasharray={`${s.dash} ${C - s.dash}`} strokeDashoffset={-s.offset} />
          ))}
        </g>
        <text x="75" y="72" textAnchor="middle" fontSize="10" fill="#94A3B8">Total</text>
        <text x="75" y="88" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1E2A3A">{data.length} store</text>
      </svg>
      <div className="min-w-0 flex-1 space-y-1">
        {segs.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="w-24 shrink-0 truncate font-semibold" title={s.label}>{s.label}</span>
            <span className="flex-1 text-right text-ink-soft">{fmt(s.value)}</span>
            <span className="w-12 shrink-0 text-right font-bold">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Trend bar harian. trend: [{date:'YYYY-MM-DD', omzet}]
export function TrendBars({ trend }) {
  if (!trend?.length) return <p className="text-sm text-ink-soft">Belum ada data.</p>;
  const totalOmzet = trend.reduce((s, t) => s + t.omzet, 0);
  const h = 170, pad = 26, bw = 16, gap = 8;
  const w = Math.max(320, pad * 2 + trend.length * (bw + gap));
  const max = Math.max(...trend.map((t) => t.omzet)) || 1;
  const baseY = h - pad;
  return (
    <div className="no-scrollbar overflow-x-auto">
      {totalOmzet === 0 && <p className="mb-2 text-xs text-ink-soft">Belum ada penjualan pada rentang ini.</p>}
      <svg width={w} height={h}>
        <line x1={pad} y1={baseY} x2={w - pad} y2={baseY} stroke="#E5E9F0" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={w - pad} y2={pad} stroke="#F1F4F8" strokeWidth="1" />
        <defs>
          <linearGradient id="amBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E86FF" />
            <stop offset="100%" stopColor="#1657C0" />
          </linearGradient>
        </defs>
        {trend.map((t, i) => {
          const x = pad + i * (bw + gap);
          const barH = t.omzet > 0 ? Math.max(3, (t.omzet / max) * (h - pad * 2)) : 0;
          const y = baseY - barH;
          const showLabel = i === 0 || i === trend.length - 1 || i % 5 === 0;
          return (
            <g key={t.date}>
              {barH > 0 && <rect x={x} y={y} width={bw} height={barH} rx="3" fill="url(#amBarGrad)" />}
              {showLabel && <text x={x + bw / 2} y={h - 8} textAnchor="middle" fontSize="8" fill="#94A3B8">{t.date.slice(5)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
