import path from "node:path";
import {
  buildRepositoryEvidenceWorklist,
  readJson,
} from "./progressive-verification-lib.mjs";

function parseArgs(argv) {
  const values = {
    verification: [],
    registry: "public/content/source-intake/progressive-support.json",
    evidenceRoot: "public/content/evidence/progressive",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--verification=")) {
      values.verification.push(token.slice("--verification=".length));
    } else if (token === "--verification") {
      values.verification.push(argv[++index]);
    } else if (token.startsWith("--registry=")) {
      values.registry = token.slice("--registry=".length);
    } else if (token === "--registry") {
      values.registry = argv[++index];
    } else if (token.startsWith("--evidence-root=")) {
      values.evidenceRoot = token.slice("--evidence-root=".length);
    } else if (token === "--evidence-root") {
      values.evidenceRoot = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
if (args.verification.length === 0 || args.verification.some((value) => !value)) {
  console.error(
    "Usage: node scripts/plan-progressive-repository-evidence.mjs --verification <file> [--verification <file> ...] [--registry <file>] [--evidence-root <repository-relative-dir>]",
  );
  process.exit(2);
}

const repoRoot = process.cwd();
const registry = readJson(path.resolve(args.registry));
const bundles = args.verification.map((verificationPath) =>
  readJson(path.resolve(verificationPath)),
);

const worklist = buildRepositoryEvidenceWorklist(bundles, registry, {
  candidateRepoRoot: repoRoot,
  evidenceRepoRoot: repoRoot,
  evidenceRoot: args.evidenceRoot,
});
console.log(JSON.stringify(worklist, null, 2));
