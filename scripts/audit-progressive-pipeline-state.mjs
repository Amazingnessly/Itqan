import path from "node:path";
import { auditProgressivePipelineState } from "./progressive-pipeline-audit-lib.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [key, inline] = token.slice(2).split("=", 2);
    values[key] = inline ?? argv[++index];
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
const audit = auditProgressivePipelineState({
  repoRoot: process.cwd(),
  registryPath: path.normalize(args.registry ?? "public/content/source-intake/progressive-support.json"),
});

console.log(JSON.stringify(audit, null, 2));
if (audit.failures.length > 0) {
  console.error(`Progressive pipeline audit failed for ${audit.failures.length} module(s).`);
  process.exitCode = 1;
}
