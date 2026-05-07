export type StatusBadgeVariant = "success" | "warning" | "critical" | "neutral" | "info";

export interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  size?: "sm" | "md";
}

const variants: Record<StatusBadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-red-50 text-red-700 border-red-200",
  neutral: "bg-slate-50 text-slate-700 border-slate-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

export function StatusBadge({ label, variant = "neutral", size = "md" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${variants[variant]} ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}>
      {label}
    </span>
  );
}
