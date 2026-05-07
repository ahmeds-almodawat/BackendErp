import type { MasterDataValidationFinding, MasterDataValidationSummary } from "./masterDataTypes";

function required(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function summarize(findings: MasterDataValidationFinding[]): MasterDataValidationSummary {
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount,
    findings,
  };
}

export function validateBranch(input: { code?: string; name_en?: string; name_ar?: string }): MasterDataValidationSummary {
  const findings: MasterDataValidationFinding[] = [];

  if (!required(input.code)) {
    findings.push({
      severity: "critical",
      field: "code",
      message: "Branch code is required.",
      action: "Add a unique branch code before saving.",
    });
  }

  if (!required(input.name_en) || !required(input.name_ar)) {
    findings.push({
      severity: "critical",
      field: "name",
      message: "Branch English and Arabic names are required.",
      action: "Complete bilingual branch naming.",
    });
  }

  return summarize(findings);
}

export function validateStore(input: { code?: string; name_en?: string; name_ar?: string; branch_id?: string }): MasterDataValidationSummary {
  const findings: MasterDataValidationFinding[] = [];

  if (!required(input.code)) findings.push({ severity: "critical", field: "code", message: "Store code is required.", action: "Add a unique store code." });
  if (!required(input.branch_id)) findings.push({ severity: "critical", field: "branch_id", message: "Store must belong to a branch.", action: "Select the owning branch." });
  if (!required(input.name_en) || !required(input.name_ar)) findings.push({ severity: "critical", field: "name", message: "Store English and Arabic names are required.", action: "Complete bilingual store naming." });

  return summarize(findings);
}

export function validateSupplier(input: { supplier_code?: string; name?: string; vat_number?: string }): MasterDataValidationSummary {
  const findings: MasterDataValidationFinding[] = [];

  if (!required(input.supplier_code)) findings.push({ severity: "critical", field: "supplier_code", message: "Supplier code is required.", action: "Add a unique supplier code." });
  if (!required(input.name)) findings.push({ severity: "critical", field: "name", message: "Supplier name is required.", action: "Add the supplier legal/trade name." });

  if (input.vat_number && !/^[0-9]{15}$/.test(String(input.vat_number))) {
    findings.push({
      severity: "warning",
      field: "vat_number",
      message: "Saudi VAT number usually contains 15 digits.",
      action: "Verify the supplier VAT number.",
    });
  }

  return summarize(findings);
}

export function validateItem(input: {
  sku?: string;
  name_en?: string;
  name_ar?: string;
  purchase_unit?: string;
  consumption_unit?: string;
  conversion_factor?: number;
}): MasterDataValidationSummary {
  const findings: MasterDataValidationFinding[] = [];

  if (!required(input.sku)) findings.push({ severity: "critical", field: "sku", message: "Item SKU is required.", action: "Add a unique item SKU." });
  if (!required(input.name_en) || !required(input.name_ar)) findings.push({ severity: "critical", field: "name", message: "Item English and Arabic names are required.", action: "Complete bilingual item naming." });
  if (!required(input.purchase_unit)) findings.push({ severity: "critical", field: "purchase_unit", message: "Purchase unit is required.", action: "Select purchase unit." });
  if (!required(input.consumption_unit)) findings.push({ severity: "critical", field: "consumption_unit", message: "Consumption unit is required.", action: "Select consumption unit." });

  if (!Number.isFinite(input.conversion_factor) || Number(input.conversion_factor) <= 0) {
    findings.push({
      severity: "critical",
      field: "conversion_factor",
      message: "Conversion factor must be positive.",
      action: "Set a valid purchase-to-consumption conversion factor.",
    });
  }

  return summarize(findings);
}

export function validateChartAccount(input: {
  account_code?: string;
  name_en?: string;
  name_ar?: string;
  account_type?: string;
  normal_balance?: string;
  allow_posting?: boolean;
}): MasterDataValidationSummary {
  const findings: MasterDataValidationFinding[] = [];

  if (!required(input.account_code)) findings.push({ severity: "critical", field: "account_code", message: "Account code is required.", action: "Add a unique account code." });
  if (!required(input.name_en) || !required(input.name_ar)) findings.push({ severity: "critical", field: "name", message: "Account English and Arabic names are required.", action: "Complete bilingual account naming." });
  if (!required(input.account_type)) findings.push({ severity: "critical", field: "account_type", message: "Account type is required.", action: "Select account type." });
  if (!required(input.normal_balance)) findings.push({ severity: "critical", field: "normal_balance", message: "Normal balance is required.", action: "Select debit or credit normal balance." });

  if (input.allow_posting === false) {
    findings.push({
      severity: "warning",
      field: "allow_posting",
      message: "This account is marked as non-posting.",
      action: "Use non-posting accounts only as parent/control accounts.",
    });
  }

  return summarize(findings);
}
