import { StatusBadge } from "../../components/common/StatusBadge";

export function OperationalBackendCutoverPanel() {
  const modules = [
    "Purchasing/AP",
    "Sales/POS",
    "Production/Recipes",
    "Operational Posting Bridge",
  ];

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Operational Backend Cutover</h3>
        <StatusBadge label="foundation" variant="info" />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        v319-v322 adds backend foundations for purchasing, sales/POS, production, and operational posting links.
      </p>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
        {modules.map((module) => (
          <li key={module}>{module}</li>
        ))}
      </ul>
    </div>
  );
}
