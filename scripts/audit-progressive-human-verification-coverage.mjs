import path from "node:path";
import {
  auditHumanVerificationCoverage,
  readJson,
} from "./progressive-verification-lib.mjs";

function parseArgs(argv) {
  const values = {
    verification: [],
    registry: "public/content/source-intake/progressive-support.json",
    requireComplete: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--require-complete") {
      values.requireComplete = true;
      continue;
    }
    if (token.startsWith("--verification=")) {
      values.verification.push(token.slice("--verification=".length));
      continue;
    }
    if (token === "--verification") {
      values.verification.push(argv[++index]);
      continue;
    }
    if (token.startsWith("--registry=")) {
      values.registry = token.slice("--registry=".length);
      continue;
    }
    if (token === "--registry") {
      values.registry = argv[++index];
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return values;
}

const args = parseArgs(process.argv.slice(2));
if (args.verification.length === 0 || args.verification.some((value) => !value)) {
  console.error(
    "Usage: node scripts/audit-progressive-human-verification-coverage.mjs --verification <file> [--verification <file> ...] [--registry <file>] [--require-complete]",
  );
  process.exit(2);
}

const repoRoot = process.cwd();
const registry = readJson(path.resolve(args.registry));
const bundles = args.verification.map((verificationPath) =>
  readJson(path.resolve(verificationPath)),
);

const audit = auditHumanVerificationCoverage(bundles, registry, {
  candidateRepoRoot: repoRoot,
});

console.log(JSON.stringify(audit, null, 2));

if (args.requireComplete && !audit.registeredCandidateCoverageComplete) {
  console.error(
    `Coverage incomplete for ${audit.moduleId}: ${audit.verifiedItemCount}/${audit.registeredCandidateCount} registered candidate positions verified.`,
  );
  process.exitCode = 1;
}
