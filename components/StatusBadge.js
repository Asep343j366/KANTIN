import { STATUS } from "@/lib/format";

const tones = {
  warning: "bg-amber-100 text-amber-700",
  primary: "bg-primary-light text-primary",
  success: "bg-green-100 text-green-700",
  ink: "bg-gray-100 text-ink",
  danger: "bg-red-100 text-red-600",
};

export default function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: "ink" };
  return <span className={`badge ${tones[s.tone]}`}>{s.label}</span>;
}
