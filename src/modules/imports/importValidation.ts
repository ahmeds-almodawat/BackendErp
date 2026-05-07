import type { ImportStagingRow } from "./importStagingTypes";

export interface ImportValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: Array<{
    rowNumber: number;
    message: string;
  }>;
}

export function validateRequiredColumns(
  rows: ImportStagingRow[],
  requiredColumns: string[],
): ImportValidationSummary {
  const errors: ImportValidationSummary["errors"] = [];

  for (const row of rows) {
    for (const column of requiredColumns) {
      const value = row.mappedData?.[column] ?? row.rawData?.[column];

      if (value === undefined || value === null || value === "") {
        errors.push({
          rowNumber: row.rowNumber,
          message: `Missing required column: ${column}`,
        });
      }
    }
  }

  const rowsWithErrors = new Set(errors.map((error) => error.rowNumber));

  return {
    totalRows: rows.length,
    validRows: rows.length - rowsWithErrors.size,
    errorRows: rowsWithErrors.size,
    errors,
  };
}

export function hasBlockingImportErrors(summary: ImportValidationSummary): boolean {
  return summary.errorRows > 0;
}
