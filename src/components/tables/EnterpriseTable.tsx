import { EmptyState } from "../common/EmptyState";
import { LoadingState } from "../common/LoadingState";
import type { EnterpriseTableProps } from "./EnterpriseTableTypes";

export function EnterpriseTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = "No records",
  emptyMessage = "No data is available for the selected filters.",
  stickyHeader = true,
  density = "comfortable",
  paginationSummary,
}: EnterpriseTableProps<T>) {
  if (loading) {
    return <LoadingState title="Loading table" compact />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className={`bg-slate-50 ${stickyHeader ? "sticky top-0 z-10" : ""}`}>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-4 py-3 text-${column.align ?? "left"} font-semibold text-slate-600`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50">
                {columns.map((column) => (
                  <td key={column.key} className={`${density === "compact" ? "px-4 py-2" : "px-4 py-3"} text-${column.align ?? "left"} text-slate-700`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginationSummary ? <div className="border-t bg-slate-50 px-4 py-2 text-xs text-slate-500">{paginationSummary}</div> : null}
    </div>
  );
}
