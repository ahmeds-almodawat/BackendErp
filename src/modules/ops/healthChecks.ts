import type { ProductionReadinessCheck } from "./productionReadinessTypes";

export const defaultHealthChecks: ProductionReadinessCheck[] = [
  { key: "build_passes", area: "deployment", label: "npm run build passes", requiredForGoLive: true, status: "not_checked" },
  { key: "env_configured", area: "deployment", label: "Environment variables configured", requiredForGoLive: true, status: "not_checked" },
  { key: "supabase_url", area: "database", label: "Supabase URL configured", requiredForGoLive: true, status: "not_checked" },
  { key: "supabase_anon", area: "database", label: "Supabase anon key configured", requiredForGoLive: true, status: "not_checked" },
  { key: "service_role_safe", area: "security", label: "Service role key not exposed to frontend", requiredForGoLive: true, status: "not_checked" },
  { key: "migrations_reviewed", area: "database", label: "Migrations reviewed", requiredForGoLive: true, status: "not_checked" },
  { key: "rls_enabled", area: "access_control", label: "RLS enabled on production tables", requiredForGoLive: true, status: "not_checked" },
  { key: "posting_validation", area: "posting", label: "Posting validation exists", requiredForGoLive: true, status: "ready" },
  { key: "import_staging", area: "imports", label: "Import staging exists", requiredForGoLive: true, status: "ready" },
  { key: "backup_plan", area: "backup", label: "Backup plan exists", requiredForGoLive: true, status: "not_checked" },
  { key: "restore_test", area: "backup", label: "Restore test completed", requiredForGoLive: true, status: "not_checked" },
  { key: "error_logging", area: "observability", label: "Error logging exists", requiredForGoLive: true, status: "ready" },
  { key: "activity_logging", area: "observability", label: "Activity logging exists", requiredForGoLive: true, status: "ready" },
  { key: "release_checklist", area: "documentation", label: "Release checklist exists", requiredForGoLive: true, status: "ready" },
];
