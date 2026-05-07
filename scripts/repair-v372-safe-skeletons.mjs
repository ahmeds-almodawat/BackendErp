import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function write(file, body) { fs.writeFileSync(path.join(root, file), body); }
function walk(dir, predicate = () => true) {
  const out = [];
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, entry.name);
    const rel = path.relative(root, p).replaceAll(path.sep, "/");
    if (entry.isDirectory()) out.push(...walk(rel, predicate));
    else if (predicate(rel)) out.push(rel);
  }
  return out;
}
const skeletonPattern = /skeleton|placeholder|dry[- ]run|wire .*later|not implemented|TODO/i;
const alreadySafePattern = /productionAllowed\s*:\s*false|devOnly\s*:\s*true/i;
const changed = [];
const skipped = [];
for (const file of walk("supabase/functions", (rel) => rel.endsWith("/index.ts"))) {
  let body = read(file);
  if (!skeletonPattern.test(body)) continue;
  if (alreadySafePattern.test(body)) { skipped.push(file); continue; }
  const before = body;
  body = body.replace(/ok\s*:\s*true\s*,/g, "ok: false,\n      productionAllowed: false,\n      devOnly: true,");
  body = body.replace(/JSON\.stringify\(\{\s*ok\s*:\s*true\s*,/g, "JSON.stringify({ ok: false, productionAllowed: false, devOnly: true,");
  if (body === before && !alreadySafePattern.test(body)) {
    body = body.replace(/(return\s+json\(\{\s*)/m, "$1\n      productionAllowed: false,\n      devOnly: true,\n");
    body = body.replace(/(JSON\.stringify\(\{\s*)/m, "$1 productionAllowed: false, devOnly: true,");
  }
  if (body !== before) { write(file, body); changed.push(file); }
  else skipped.push(file);
}
const report = ["# v372 Safe Skeleton Repair", "", `Generated: ${new Date().toISOString()}`, "", `Changed: ${changed.length}`, `Already safe / skipped: ${skipped.length}`, "", "## Changed files", "", ...changed.map((file) => `- ${file}`), "", "## Already safe or skipped files", "", ...skipped.map((file) => `- ${file}`), "", "Next: run `npm run qa:v372`.", ""].join("\n");
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
write("docs/V372_SAFE_SKELETON_REPAIR.md", report);
console.log(report);
