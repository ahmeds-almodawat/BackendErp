import { listDefaultMappingProfiles } from "./importMappingProfiles";

const CUT_RULES = [
  "Mapping profile is required before validation or cutover.",
  "Rows with critical validation errors cannot be cut over.",
  "Only approved imports can be posted to production cutover.",
  "Posted imports cannot be edited; use rollback/correction flows.",
  "Duplicate imports are detected using file hash, source type, branch, and business date.",
];

const ROLL_RULES = [
  "Only posted cutover work can request rollback.",
  "Rollback requires a documented reason.",
  "Corrections use reversal/correction records—never silent delete.",
  "Cancelled or rolled_back staging files cannot be rolled back again.",
];

export default function ImportStagingPanel() {
  const profiles = listDefaultMappingProfiles();

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 20,
        background: "#fafafa",
        display: "grid",
        gap: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div>
        <h3 style={{ margin: 0 }}>Import staging (v312)</h3>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
          AppShell-visible control panel for staging, mapping profiles, cutover, and rollback rules.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        <div style={{ padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <strong>Staging status model</strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#475569" }}>
            uploaded → mapped → validated → approved → posted (or rolled_back / cancelled)
          </p>
        </div>
        <div style={{ padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <strong>{profiles.length}</strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#475569" }}>Default mapping profiles</p>
        </div>
      </div>

      <div>
        <h4 style={{ margin: "0 0 8px" }}>Cutover rules</h4>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
          {CUT_RULES.map((rule) => (
            <li key={rule} style={{ marginBottom: 4 }}>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 style={{ margin: "0 0 8px" }}>Rollback rules</h4>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
          {ROLL_RULES.map((rule) => (
            <li key={rule} style={{ marginBottom: 4 }}>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 style={{ margin: "0 0 8px" }}>Next backend tasks</h4>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14 }}>
          <li>Apply `20260505231200_v312_import_staging_cutover.sql` when ready.</li>
          <li>Wire Edge Functions or RPCs for validate → approve → cutover → rollback.</li>
          <li>Persist `import_file_hash_locks` on upload with SHA-256 and business metadata.</li>
        </ol>
      </div>
    </section>
  );
}
