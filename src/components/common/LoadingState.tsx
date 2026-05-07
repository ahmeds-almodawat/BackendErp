export interface LoadingStateProps {
  title?: string;
  message?: string;
  compact?: boolean;
}

export function LoadingState({ title = "Loading", message = "Preparing your data...", compact = false }: LoadingStateProps) {
  return (
    <div className={`rounded-2xl border bg-white ${compact ? "p-3" : "p-6"}`}>
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="h-3 w-56 rounded bg-slate-100" />
        {!compact && <div className="h-20 rounded-xl bg-slate-100" />}
      </div>
      <div className="mt-4">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}
