// Dialog konfirmasi custom (pengganti window.confirm) agar tampilan profesional
// & konsisten dengan brand. Berbasis Promise<boolean>; render vanilla DOM jadi
// bisa dipanggil dari mana saja tanpa provider.
//
// Pakai:  if (!(await confirmDialog({ title, message, confirmLabel, danger }))) return;
export function confirmDialog(opts = {}) {
  const o = typeof opts === "string" ? { message: opts } : opts;
  const {
    title = "Konfirmasi",
    message = "",
    confirmLabel = "Ya, Lanjutkan",
    cancelLabel = "Batal",
    danger = false,
  } = o;

  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(false);

    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:10000;background:rgba(15,27,52,.5);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Plus Jakarta Sans',system-ui,sans-serif";

    const box = document.createElement("div");
    box.style.cssText =
      "background:#fff;border-radius:16px;max-width:400px;width:100%;padding:22px 22px 18px;box-shadow:0 20px 50px rgba(0,0,0,.28)";

    const h = document.createElement("div");
    h.style.cssText = "font-size:18px;font-weight:800;color:#1B2E54;margin-bottom:8px";
    h.textContent = title;

    const p = document.createElement("div");
    p.style.cssText =
      "font-size:14px;color:#52607A;line-height:1.55;white-space:pre-line;margin-bottom:20px";
    p.textContent = message;

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;justify-content:flex-end";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = cancelLabel;
    cancel.style.cssText =
      "padding:10px 18px;border-radius:10px;border:1.5px solid #E2E8F2;background:#fff;color:#52607A;font-weight:700;font-size:14px;cursor:pointer";

    const ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = confirmLabel;
    ok.style.cssText =
      "padding:10px 18px;border-radius:10px;border:none;color:#fff;font-weight:700;font-size:14px;cursor:pointer;background:" +
      (danger ? "#C0392B" : "#1B6FEB");

    function close(val) {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(val);
    }
    function onKey(e) {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    }
    cancel.onclick = () => close(false);
    ok.onclick = () => close(true);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
    document.addEventListener("keydown", onKey);

    row.append(cancel, ok);
    box.append(h, p, row);
    overlay.append(box);
    document.body.append(overlay);
    ok.focus();
  });
}
