"use client";

// Logo teks aplikasi sesuai pengaturan gaya (Kelola Store → Pengaturan Landing).
// Ukuran mengikuti font-size konteks (className/style), aksen relatif dalam em.
export default function BrandLogo({ brand, className = "", style }) {
  const s = brand.style;
  const name = brand.name;
  const n = Math.min(s.accentCount, name.length);
  const head = name.slice(0, n);
  const tail = name.slice(n);

  const base = {
    display: "inline-flex",
    alignItems: "baseline",
    whiteSpace: "nowrap",
    lineHeight: 1.1,
    fontWeight: s.weight,
    letterSpacing: `${s.tracking}em`,
    textTransform: s.uppercase ? "uppercase" : "none",
    ...(s.textColor ? { color: s.textColor } : {}),
    ...style,
  };

  let headEl = null;
  if (head) {
    const size = { fontSize: `${s.accentScale}em`, lineHeight: 1 };
    if (s.accentStyle === "box" || s.accentStyle === "circle") {
      headEl = (
        <span style={{
          ...size, alignSelf: "center", background: s.accentColor, color: s.accentTextColor,
          borderRadius: s.accentStyle === "circle" ? "999px" : ".22em",
          padding: s.accentStyle === "circle" ? ".14em .34em" : ".08em .22em", marginRight: ".14em",
        }}>{head}</span>
      );
    } else if (s.accentStyle === "underline") {
      headEl = <span style={{ ...size, color: s.accentColor, borderBottom: ".12em solid currentColor" }}>{head}</span>;
    } else {
      headEl = <span style={{ ...size, color: s.accentColor }}>{head}</span>;
    }
  }

  return (
    <span className={className} style={base} aria-label={name}>
      {headEl}
      {tail ? <span>{tail}</span> : null}
    </span>
  );
}
