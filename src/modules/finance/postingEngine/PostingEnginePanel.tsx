import { POSTING_CONTRACTS } from "./postingContracts";
import { validatePostingBatch } from "./postingValidation";
import type {
  PostingBatchInput,
  PostingValidationContext,
} from "./postingTypes";

type PostingEnginePanelProps = {
  batch?: PostingBatchInput;
  context?: PostingValidationContext;
  title?: string;
};

const sampleBatch: PostingBatchInput = {
  batchNo: "V311-SAMPLE-001",
  sourceType: "manual_journal",
  sourceDocumentId: "MJ-2026-0001",
  sourceDocumentNo: "MJ-2026-0001",
  sourceModule: "Finance",
  branchId: "branch-demo",
  fiscalPeriodId: "period-2026-05",
  postingDate: "2026-05-05",
  status: "draft",
  direction: "normal",
  description: "v311 sample posting batch",
  lines: [
    { lineNo: 1, accountCode: "1100", debit: 2500, credit: 0, description: "Cash" },
    { lineNo: 2, accountCode: "4100", debit: 0, credit: 2500, description: "Revenue" },
  ],
};

function toneColor(tone: "critical" | "warning" | "ok"): string {
  if (tone === "critical") return "#991b1b";
  if (tone === "warning") return "#92400e";
  return "#166534";
}

function toneBackground(tone: "critical" | "warning" | "ok"): string {
  if (tone === "critical") return "#fee2e2";
  if (tone === "warning") return "#fef3c7";
  return "#dcfce7";
}

export function PostingEnginePanel({
  batch = sampleBatch,
  context,
  title = "Finance Posting Engine",
}: PostingEnginePanelProps) {
  const summary = validatePostingBatch(batch, context);

  return (
    <section
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 16,
        padding: 20,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
        <p style={{ margin: "8px 0 0", color: "#475569" }}>
          Standalone v311 dashboard panel for contracts, validation, and reversal readiness.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ padding: 12, borderRadius: 12, background: "#eff6ff" }}>
          <strong>{POSTING_CONTRACTS.length}</strong>
          <div style={{ color: "#475569", marginTop: 4 }}>Posting contracts</div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, background: "#fef3c7" }}>
          <strong>{summary.warningCount}</strong>
          <div style={{ color: "#475569", marginTop: 4 }}>Validation warnings</div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, background: "#fee2e2" }}>
          <strong>{summary.criticalCount}</strong>
          <div style={{ color: "#475569", marginTop: 4 }}>Critical findings</div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, background: "#dcfce7" }}>
          <strong>{summary.ok ? "Ready" : "Needs work"}</strong>
          <div style={{ color: "#475569", marginTop: 4 }}>Posting readiness</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Contract coverage</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {POSTING_CONTRACTS.map((contract) => (
            <span
              key={contract.sourceType}
              style={{
                borderRadius: 999,
                padding: "6px 10px",
                background: "#e2e8f0",
                color: "#0f172a",
                fontSize: 12,
              }}
            >
              {contract.sourceType}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Validation findings</strong>
        {summary.findings.length === 0 ? (
          <div
            style={{
              borderRadius: 12,
              padding: 12,
              background: toneBackground("ok"),
              color: toneColor("ok"),
            }}
          >
            No findings. This sample batch is balanced and structurally ready.
          </div>
        ) : (
          summary.findings.map((finding) => (
            <div
              key={`${finding.code}-${finding.message}`}
              style={{
                borderRadius: 12,
                padding: 12,
                background: toneBackground(finding.severity),
                color: toneColor(finding.severity),
              }}
            >
              <strong>{finding.code}</strong>
              <div style={{ marginTop: 4 }}>{finding.message}</div>
              {finding.action ? (
                <div style={{ marginTop: 6, color: "#334155" }}>{finding.action}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default PostingEnginePanel;
