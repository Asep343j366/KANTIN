"use client";

// Tombol seragam dengan loader 3 bola melayang saat proses.
// variant: "primary" | "success" | "danger" | "outline" | "ghost"
export default function Button({ loading = false, variant = "primary", className = "", children, disabled, ...props }) {
  const variantClass = {
    primary: "btn-primary",
    success: "btn-success",
    danger: "btn-danger",
    outline: "btn-outline",
    ghost: "btn-ghost",
  }[variant] || "btn-primary";

  return (
    <button {...props} disabled={disabled || loading} className={`${variantClass} ${className}`}>
      <span className={loading ? "invisible" : "inline-flex items-center gap-1.5"}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="dots"><span /><span /><span /></span>
        </span>
      )}
    </button>
  );
}
