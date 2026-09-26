import fs from "node:fs";
import path from "node:path";
import {
  buildRepositoryEvidenceMapFromVerification,
  readJson,
} from "./progressive-verification-lib.mjs";

function parseArgs(argv) {
  const values = {
    registry: "public/content/source-intake/progressive-support.json",
    evidenceRoot: "public/content/evidence/progressive",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--verification=")) {
      values.verification = token.slice("--verification=".length);
    } else if (token === "--verification") {
      values.verification = argv[++index];
    } else if (token.startsWith("--out=")) {
      values.out = token.slice("--out=".length);
    } else if (token === "--out") {
      values.out = argv[++index];
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
if (!args.verification || !args.out) {
  console.error(
    "Usage: node scripts/build-progressive-repository-evidence-map.mjs --verification <file> --out <file> [--registry <file>] [--evidence-root <repository-relative-dir>]",
  );
  process.exit(2);
}

const repoRoot = process.cwd();
const outputPath = path.resolve(args.out);
const evidenceRootAbsolute = path.resolve(repoRoot, "public/content/evidence");
if (!outputPath.startsWith(evidenceRootAbsolute + path.sep)) {
  throw new Error("Evidence-map output must remain under public/content/evidence/.");
}

const registry = readJson(path.resolve(args.registry));
const verification = readJson(path.resolve(args.verification));
const evidenceMap = buildRepositoryEvidenceMapFromVerification(
  verification,
  registry,
  repoRoot,
  { evidenceRoot: args.evidenceRoot },
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(evidenceMap, null, 2) + "\n", "utf8");
console.log(
  `OK: wrote repository evidence map with ${evidenceMap.items.length} item(s) to ${path.relative(repoRoot, outputPath)}.`,
);
