export type UatScenarioStatus = "not_started" | "running" | "passed" | "failed" | "blocked";

export interface UatScenarioStep {
  stepNo: number;
  action: string;
  expectedResult: string;
}

export interface UatScenario {
  key: string;
  title: string;
  module: string;
  status: UatScenarioStatus;
  critical: boolean;
  steps: UatScenarioStep[];
}

export const enterpriseUatScenarios: UatScenario[] = [
  {
    key: "master_data_cutover",
    title: "Master data cutover",
    module: "setup",
    status: "not_started",
    critical: true,
    steps: [
      { stepNo: 1, action: "Import chart of accounts", expectedResult: "Accounts validate with no critical errors" },
      { stepNo: 2, action: "Import items and suppliers", expectedResult: "Items and suppliers become available for transactions" },
    ],
  },
  {
    key: "purchase_to_payment",
    title: "Purchase invoice to supplier payment",
    module: "purchasing",
    status: "not_started",
    critical: true,
    steps: [
      { stepNo: 1, action: "Post purchase invoice", expectedResult: "AP, VAT, and inventory/expense posting created" },
      { stepNo: 2, action: "Post supplier payment", expectedResult: "AP balance decreases and bank/cash entry posts" },
    ],
  },
  {
    key: "pos_to_finance",
    title: "POS sales to finance",
    module: "sales",
    status: "not_started",
    critical: true,
    steps: [
      { stepNo: 1, action: "Import POS batch", expectedResult: "Sales, tax, discounts, refunds, and payments validate" },
      { stepNo: 2, action: "Post POS batch", expectedResult: "Revenue, VAT, payment clearing, and COGS post" },
    ],
  },
  {
    key: "production_batch",
    title: "Production and recipes",
    module: "production",
    status: "not_started",
    critical: true,
    steps: [
      { stepNo: 1, action: "Create production batch", expectedResult: "Ingredients and output items validate" },
      { stepNo: 2, action: "Post production batch", expectedResult: "Ingredient consumption and output stock movements post" },
    ],
  },
  {
    key: "period_close",
    title: "Period close",
    module: "finance",
    status: "not_started",
    critical: true,
    steps: [
      { stepNo: 1, action: "Run bank/VAT/reconciliation checks", expectedResult: "No critical close blockers remain" },
      { stepNo: 2, action: "Request period close", expectedResult: "Period closes only if all gates pass" },
    ],
  },
];

export function summarizeUatScenarios(scenarios: UatScenario[] = enterpriseUatScenarios) {
  return {
    scenarioCount: scenarios.length,
    criticalCount: scenarios.filter((scenario) => scenario.critical).length,
    passed: scenarios.filter((scenario) => scenario.status === "passed").length,
    failed: scenarios.filter((scenario) => scenario.status === "failed").length,
    blocked: scenarios.filter((scenario) => scenario.status === "blocked").length,
  };
}
