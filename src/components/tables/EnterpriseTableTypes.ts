export type EnterpriseTableDensity = "compact" | "comfortable";

export interface EnterpriseColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
}

export interface EnterpriseTableSort {
  key: string;
  direction: "asc" | "desc";
}

export interface EnterpriseTableFilter {
  key: string;
  value: string;
}

export interface EnterpriseTableProps<T> {
  columns: EnterpriseColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  stickyHeader?: boolean;
  density?: EnterpriseTableDensity;
  paginationSummary?: string;
}
