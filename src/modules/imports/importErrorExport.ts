export interface ImportErrorExportRow {
  file_id: string;
  row_number: number | "";
  field_name: string;
  error_code: string;
  error_message: string;
  severity: string;
}

export interface ImportValidationErrorLike {
  fileId: string;
  rowNumber?: number | null;
  fieldName?: string | null;
  errorCode: string;
  errorMessage: string;
  severity: string;
}

export function createImportErrorExportRows(
  errors: ImportValidationErrorLike[],
): ImportErrorExportRow[] {
  return errors.map((e) => ({
    file_id: e.fileId,
    row_number: e.rowNumber ?? "",
    field_name: e.fieldName ?? "",
    error_code: e.errorCode,
    error_message: e.errorMessage,
    severity: e.severity,
  }));
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * RFC-style CSV with header:
 * file_id,row_number,field_name,error_code,error_message,severity
 */
export function exportImportErrorsToCsv(rows: ImportErrorExportRow[]): string {
  const header =
    "file_id,row_number,field_name,error_code,error_message,severity";
  const lines = rows.map((row) =>
    [
      row.file_id,
      row.row_number === "" ? "" : String(row.row_number),
      row.field_name,
      row.error_code,
      row.error_message,
      row.severity,
    ]
      .map((cell) => escapeCsvCell(String(cell)))
      .join(","),
  );
  return [header, ...lines].join("\r\n");
}
