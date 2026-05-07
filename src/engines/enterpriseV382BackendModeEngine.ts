export type V382RuntimeMode = 'local-demo' | 'staging' | 'production';
export type V382GateStatus = 'safe-local' | 'staging-watch' | 'staging-ready' | 'production-blocked' | 'production-ready' | 'unsafe';
export type V382CheckStatus = 'pass' | 'watch' | 'fail';

export interface V382BackendEnv {
  VITE_RUNTIME_MODE?: string;
  VITE_BACKEND_MODE?: string;
  VITE_APP_MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_REQUIRE_AUTH?: string;
  VITE_REQUIRE_BRANCH_SCOPE?: string;
  VITE_ALLOW_DEMO_DATA?: string;
  VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_SERVICE_KEY?: string;
  VITE_SUPABASE_SECRET_KEY?: string;
  [key: string]: string | undefined;
}

export interface V382GateCheck {
  key: string;
  label: string;
  status: V382CheckStatus;
  severity: 'info' | 'warning' | 'critical';
  evidence: string;
  action: string;
}

export interface V382BackendModeSnapshot {
  version: string;
  generatedAt: string;
  runtimeMode: V382RuntimeMode;
  backendConfigured: boolean;
  productionRequested: boolean;
  authRequired: boolean;
  branchScopeRequired: boolean;
  demoDataAllowed: boolean;
  serviceRoleExposure: boolean;
  gateStatus: V382GateStatus;
  gateScore: number;
  findings: V382GateCheck[];
  envRecipe: string;
  nextAction: string;
  redactedEnvironment: Record<string, string>;
}

function readFrontendEnv(): V382BackendEnv {
  return (((import.meta as unknown as { env?: V382BackendEnv }).env ?? {}) as V382BackendEnv);
}

function normalizeRuntimeMode(value?: string): V382RuntimeMode {
  const normalized = String(value || 'local-demo').trim().toLowerCase();
  if (normalized === 'production') return 'production';
  if (['staging', 'supabase', 'backend'].includes(normalized)) return 'staging';
  return 'local-demo';
}

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function redact(value: string | undefined): string {
  if (!value) return 'not set';
  if (value.length <= 12) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function add(checks: V382GateCheck[], check: V382GateCheck) {
  checks.push(check);
}

export function buildV382BackendModeSnapshot(env: V382BackendEnv = readFrontendEnv()): V382BackendModeSnapshot {
  const runtimeMode = normalizeRuntimeMode(env.VITE_RUNTIME_MODE || env.VITE_BACKEND_MODE || env.VITE_APP_MODE);
  const backendConfigured = Boolean(env.VITE_SUPABASE_URL?.trim() && env.VITE_SUPABASE_ANON_KEY?.trim());
  const productionRequested = runtimeMode === 'production';
  const authRequired = productionRequested ? true : boolEnv(env.VITE_REQUIRE_AUTH, false);
  const branchScopeRequired = productionRequested ? true : boolEnv(env.VITE_REQUIRE_BRANCH_SCOPE, false);
  const demoDataAllowed = productionRequested ? false : boolEnv(env.VITE_ALLOW_DEMO_DATA, true);
  const serviceRoleExposure = Boolean(env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_SECRET_KEY);
  const checks: V382GateCheck[] = [];

  add(checks, {
    key: 'runtime-mode',
    label: 'Runtime mode selected intentionally',
    status: runtimeMode === 'local-demo' ? 'watch' : 'pass',
    severity: runtimeMode === 'production' ? 'critical' : 'warning',
    evidence: `runtimeMode=${runtimeMode}`,
    action: runtimeMode === 'local-demo' ? 'Use local-demo only for trials. Set VITE_RUNTIME_MODE=staging before Supabase UAT.' : 'Runtime mode is explicit.',
  });

  add(checks, {
    key: 'backend-configured',
    label: 'Supabase URL and anon key configured',
    status: backendConfigured ? 'pass' : productionRequested ? 'fail' : 'watch',
    severity: productionRequested ? 'critical' : 'warning',
    evidence: backendConfigured ? 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present.' : 'Frontend Supabase variables are not configured.',
    action: backendConfigured ? 'Keep keys in .env.local only and never commit them.' : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before staging/production backend use.',
  });

  add(checks, {
    key: 'service-role-not-exposed',
    label: 'No service-role key exposed to frontend',
    status: serviceRoleExposure ? 'fail' : 'pass',
    severity: 'critical',
    evidence: serviceRoleExposure ? 'A VITE_ service/secret key variable was detected.' : 'No VITE_ service role key detected.',
    action: serviceRoleExposure ? 'Remove service role keys from every frontend/VITE environment variable immediately.' : 'Keep service role keys only in Supabase secrets or server-side runtime.',
  });

  add(checks, {
    key: 'auth-required',
    label: 'Authentication requirement matches runtime',
    status: authRequired ? 'pass' : productionRequested ? 'fail' : 'watch',
    severity: productionRequested ? 'critical' : 'warning',
    evidence: `requireAuth=${authRequired}`,
    action: authRequired ? 'Auth gate is enabled for this runtime.' : 'Enable VITE_REQUIRE_AUTH=true before real user testing.',
  });

  add(checks, {
    key: 'branch-scope-required',
    label: 'Branch/store scope requirement matches runtime',
    status: branchScopeRequired ? 'pass' : productionRequested ? 'fail' : 'watch',
    severity: productionRequested ? 'critical' : 'warning',
    evidence: `requireBranchScope=${branchScopeRequired}`,
    action: branchScopeRequired ? 'Branch scope is required.' : 'Enable VITE_REQUIRE_BRANCH_SCOPE=true before multi-branch staging.',
  });

  add(checks, {
    key: 'demo-data-blocked',
    label: 'Demo data blocked in production',
    status: productionRequested && demoDataAllowed ? 'fail' : demoDataAllowed ? 'watch' : 'pass',
    severity: productionRequested ? 'critical' : 'warning',
    evidence: `allowDemoData=${demoDataAllowed}`,
    action: demoDataAllowed ? 'Use demo data only in local mode. Disable it for staging rehearsals and production.' : 'Demo data is disabled for this runtime.',
  });

  const failCount = checks.filter((check) => check.status === 'fail').length;
  const watchCount = checks.filter((check) => check.status === 'watch').length;
  let gateStatus: V382GateStatus = 'safe-local';

  if (serviceRoleExposure) gateStatus = 'unsafe';
  else if (productionRequested && failCount > 0) gateStatus = 'production-blocked';
  else if (productionRequested) gateStatus = 'production-ready';
  else if (runtimeMode === 'staging' && backendConfigured && failCount === 0) gateStatus = watchCount ? 'staging-watch' : 'staging-ready';
  else if (runtimeMode === 'staging') gateStatus = 'staging-watch';

  const gateScore = Math.max(0, Math.min(100, Math.round(100 - failCount * 25 - watchCount * 8 + (backendConfigured ? 8 : 0) - (serviceRoleExposure ? 40 : 0))));

  const envRecipe = [
    '# .env.local example for staging backend mode',
    'VITE_RUNTIME_MODE=staging',
    'VITE_SUPABASE_URL=http://127.0.0.1:54321',
    'VITE_SUPABASE_ANON_KEY=<paste local/staging anon key only>',
    'VITE_REQUIRE_AUTH=true',
    'VITE_REQUIRE_BRANCH_SCOPE=true',
    'VITE_ALLOW_DEMO_DATA=false',
    '',
    '# Never add VITE_SUPABASE_SERVICE_ROLE_KEY to frontend env files.',
  ].join('\n');

  const nextAction = gateStatus === 'unsafe'
    ? 'Remove exposed frontend service keys immediately before continuing.'
    : gateStatus === 'production-blocked'
      ? 'Production is intentionally blocked. Configure Supabase, auth, branch scope, and demo-data settings first.'
      : gateStatus === 'production-ready'
        ? 'Run migration reset, RLS smoke tests, backup restore drill, and UAT before live use.'
        : gateStatus === 'staging-ready'
          ? 'Proceed with staging UAT against Supabase and record evidence.'
          : gateStatus === 'staging-watch'
            ? 'Close warning items before calling staging safe.'
            : 'Local demo is safe for UI trials only. Configure staging when ready.';

  return {
    version: 'v382 Backend Mode Cutover Gate',
    generatedAt: new Date().toISOString(),
    runtimeMode,
    backendConfigured,
    productionRequested,
    authRequired,
    branchScopeRequired,
    demoDataAllowed,
    serviceRoleExposure,
    gateStatus,
    gateScore,
    findings: checks,
    envRecipe,
    nextAction,
    redactedEnvironment: {
      VITE_RUNTIME_MODE: runtimeMode,
      VITE_SUPABASE_URL: redact(env.VITE_SUPABASE_URL),
      VITE_SUPABASE_ANON_KEY: redact(env.VITE_SUPABASE_ANON_KEY),
      VITE_REQUIRE_AUTH: String(authRequired),
      VITE_REQUIRE_BRANCH_SCOPE: String(branchScopeRequired),
      VITE_ALLOW_DEMO_DATA: String(demoDataAllowed),
    },
  };
}

export function v382ChecksToRows(snapshot: V382BackendModeSnapshot) {
  return snapshot.findings.map((check) => ({
    key: check.key,
    label: check.label,
    status: check.status,
    severity: check.severity,
    evidence: check.evidence,
    action: check.action,
  }));
}
