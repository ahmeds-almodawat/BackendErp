export interface ReleaseChecklistItem {
  key: string;
  label: string;
  required: boolean;
}

export interface ReleaseChecklistSection {
  key: string;
  title: string;
  items: ReleaseChecklistItem[];
}

export const defaultEnterpriseReleaseChecklist: ReleaseChecklistSection[] = [
  {
    key: "local",
    title: "Local build checks",
    items: [
      { key: "npm_install", label: "npm install completed", required: true },
      { key: "npm_build", label: "npm run build passes", required: true },
      { key: "no_white_screen", label: "No white screen on refresh", required: true },
    ],
  },
  {
    key: "database",
    title: "Database checks",
    items: [
      { key: "backup_before_migration", label: "Backup before migration", required: true },
      { key: "staging_migration", label: "Migration tested on staging", required: true },
    ],
  },
  {
    key: "security",
    title: "Security checks",
    items: [
      { key: "service_role_not_frontend", label: "Service role key is not exposed", required: true },
      { key: "rls_reviewed", label: "RLS reviewed", required: true },
    ],
  },
  {
    key: "rollback",
    title: "Rollback checks",
    items: [
      { key: "rollback_plan", label: "Rollback plan exists", required: true },
      { key: "restore_test", label: "Restore tested", required: true },
    ],
  },
];
