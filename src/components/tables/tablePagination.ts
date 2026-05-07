import type { PaginationState } from "../../lib/performance/performanceTypes";

export function createDefaultPagination(totalRows = 0, pageSize = 25): PaginationState {
  return {
    page: 1,
    pageSize,
    totalRows,
  };
}

export function getPageRange(state: PaginationState) {
  const start = state.totalRows === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const end = Math.min(state.totalRows, state.page * state.pageSize);
  return { start, end };
}

export function canGoNext(state: PaginationState): boolean {
  return state.page * state.pageSize < state.totalRows;
}

export function canGoPrevious(state: PaginationState): boolean {
  return state.page > 1;
}

export function summarizePagination(state: PaginationState): string {
  const range = getPageRange(state);
  return `${range.start}-${range.end} of ${state.totalRows}`;
}
