export type V372EdgeFunctionStatus = "production-ready" | "dev-only" | "skeleton" | "unsafe" | "deprecated";

export interface V372EdgeFunctionAuditInput {
  name: string;
  path: string;
  content: string;
}

export interface V372EdgeFunctionAuditRow {
  name: string;
  path: string;
  status: V372EdgeFunctionStatus;
  productionAllowed: boolean;
  hasSkeletonMarker: boolean;
  returnsMisleadingOk: boolean;
  hasPermissionGuard: boolean;
  hasBackendAuthorityHint: boolean;
  requiredPermissions: string;
  requiredSecrets: string;
  nextStep: string;
  findings: string[];
}

export interface V372EdgeFunctionAuditSummary {
  version: string;
  generatedAt: string;
  total: number;
  productionReady: number;
  devOnly: number;
  skeleton: number;
  unsafe: number;
  deprecated: number;
  misleadingOk: number;
  rows: V372EdgeFunctionAuditRow[];
  nextAction: string;
}

const skeletonPattern = /skeleton|placeholder|dry[- ]run|wire .*later|not implemented|TODO/i;
const serviceRolePattern = /SERVICE_ROLE|service_role|createClient\([^;\n]+service/i;
const permissionPattern = /app_assert_permission|app_current_user_has_permission|authorization|auth\.uid|jwt|permission/i;
const okTruePattern = /ok\s*:\s*true|\{\s*ok:\s*true|JSON\.stringify\(\{\s*ok:\s*true/i;
const deprecatedPattern = /deprecated|do not use/i;
const devOnlyPattern = /devOnly\s*:\s*true|productionAllowed\s*:\s*false|dev[- ]only/i;

function inferPermission(name: string): string {
  if (/finance|journal|period|reconciliation|close|vat|backup/i.test(name)) return "finance.post / finance.admin depending on action";
  if (/inventory|stock|store|movement/i.test(name)) return "inventory.post / inventory.admin depending on action";
  if (/foodics|pos|sales/i.test(name)) return "sales.import / sales.post depending on action";
  if (/approval/i.test(name)) return "approval.manage";
  if (/auth|user|bootstrap/i.test(name)) return "settings.users.manage / system.owner";
  if (/attachment|document|vault|signer/i.test(name)) return "documents.manage with module scope";
  if (/report/i.test(name)) return "reports.generate";
  return "module-specific permission required before production enablement";
}

function inferSecrets(name: string): string {
  const base = "SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY";
  if (/backup|archive/i.test(name)) return `${base},BACKUP_SIGNING_KEY`;
  if (/attachment|vault|signer/i.test(name)) return `${base},ATTACHMENT_SIGNING_KEY`;
  if (/foodics|pos/i.test(name)) return `${base},FOODICS_API_KEY if API pull is enabled`;
  return base;
}

export function auditV372EdgeFunction(input: V372EdgeFunctionAuditInput): V372EdgeFunctionAuditRow {
  const content = input.content || "";
  const hasSkeletonMarker = skeletonPattern.test(content);
  const hasDevOnlyMarker = devOnlyPattern.test(content);
  const hasPermissionGuard = permissionPattern.test(content);
  const hasBackendAuthorityHint = serviceRolePattern.test(content);
  const returnsMisleadingOk = hasSkeletonMarker && okTruePattern.test(content) && !hasDevOnlyMarker;
  const deprecated = deprecatedPattern.test(content);
  const findings: string[] = [];

  let status: V372EdgeFunctionStatus = "production-ready";
  if (deprecated) status = "deprecated";
  else if (hasSkeletonMarker) status = hasDevOnlyMarker ? "dev-only" : "skeleton";
  else if (!hasPermissionGuard || !hasBackendAuthorityHint) status = "unsafe";

  if (hasSkeletonMarker) findings.push("Contains skeleton/dry-run/placeholder marker.");
  if (hasDevOnlyMarker) findings.push("Marked dev-only / productionAllowed:false.");
  if (returnsMisleadingOk) findings.push("Skeleton function appears to return ok:true without a productionAllowed:false/devOnly marker.");
  if (!hasPermissionGuard) findings.push("No clear permission/JWT/auth guard marker detected.");
  if (!hasBackendAuthorityHint) findings.push("No clear service-role/backend authority marker detected.");
  if (deprecated) findings.push("Function is marked deprecated.");

  return {
    name: input.name,
    path: input.path,
    status,
    productionAllowed: status === "production-ready",
    hasSkeletonMarker,
    returnsMisleadingOk,
    hasPermissionGuard,
    hasBackendAuthorityHint,
    requiredPermissions: inferPermission(input.name),
    requiredSecrets: inferSecrets(input.name),
    nextStep:
      status === "production-ready"
        ? "Keep covered by integration tests and permission/RLS proof."
        : status === "dev-only"
          ? "Safe as non-production stub. Replace with transaction logic before production enablement."
          : status === "skeleton"
            ? "Replace placeholder body with permission-checked transaction logic, or mark dev-only and block production calls."
            : status === "unsafe"
              ? "Add explicit JWT, permission, scope, service-role, and audit handling before production use."
              : status === "deprecated"
                ? "Remove from deployment or keep blocked from production routing."
                : "Keep dev-only until production contract is implemented.",
    findings,
  };
}

export function buildV372EdgeFunctionAudit(inputs: V372EdgeFunctionAuditInput[]): V372EdgeFunctionAuditSummary {
  const rows = inputs.map(auditV372EdgeFunction).sort((a, b) => a.name.localeCompare(b.name));
  const count = (status: V372EdgeFunctionStatus) => rows.filter((row) => row.status === status).length;
  const misleadingOk = rows.filter((row) => row.returnsMisleadingOk).length;

  return {
    version: "v372 Production Edge Function Audit",
    generatedAt: new Date().toISOString(),
    total: rows.length,
    productionReady: count("production-ready"),
    devOnly: count("dev-only"),
    skeleton: count("skeleton"),
    unsafe: count("unsafe"),
    deprecated: count("deprecated"),
    misleadingOk,
    rows,
    nextAction: misleadingOk
      ? "Patch skeleton functions so production callers cannot receive misleading ok:true responses."
      : count("skeleton") || count("unsafe")
        ? "Close skeleton/unsafe functions before enabling production backend mode."
        : "Proceed to v373 RLS closure and production policy proof.",
  };
}

export function v372RowsToMarkdown(rows: V372EdgeFunctionAuditRow[]): string {
  const header = [
    "| Function | Status | Production allowed | Skeleton marker | Misleading ok | Required permissions | Required secrets | Next step |",
    "|---|---|---:|---:|---:|---|---|---|",
  ];
  const body = rows.map((row) => [
    row.name,
    row.status,
    row.productionAllowed ? "yes" : "no",
    row.hasSkeletonMarker ? "yes" : "no",
    row.returnsMisleadingOk ? "yes" : "no",
    row.requiredPermissions,
    row.requiredSecrets,
    row.nextStep,
  ].map((value) => String(value).replaceAll("|", "\\|")).join(" | "));

  return [...header, ...body.map((line) => `| ${line} |`)].join("\n");
}
