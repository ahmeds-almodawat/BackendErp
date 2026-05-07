
import fs from 'node:fs';
import path from 'node:path';
const file = path.join(process.cwd(), 'supabase', 'migrations', '20260506245100_v451_real_pilot_scenario_pack.sql');
if (!fs.existsSync(file)) { console.log('v451 migration not present; no repair needed.'); process.exit(0); }
let text = fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
for (const col of ['step_key','sequence','module','title','actor','expected_backend_proof','expected_reports','pass_criteria','risk_if_failed']) text = text.replace(new RegExp(`(^\\s*)${col}(\\s*,?\\s*$)`, 'gm'), `$1v.${col}$2`);
text = text.replace(/\)\s+as\s+\w+\s*\(\s*step_key\s*,\s*sequence\s*,\s*module\s*,\s*title\s*,\s*actor\s*,\s*expected_backend_proof\s*,\s*expected_reports\s*,\s*pass_criteria\s*,\s*risk_if_failed\s*\)/gi, ') as v(step_key, sequence, module, title, actor, expected_backend_proof, expected_reports, pass_criteria, risk_if_failed)');
fs.writeFileSync(file,text,'utf8');
console.log('v451 seed alias repaired.');
