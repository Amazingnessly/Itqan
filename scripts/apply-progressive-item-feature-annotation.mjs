import fs from "node:fs";
import path from "node:path";
import {
  applyFeatureAnnotation,
  readJson,
  sha256Bytes,
  validateAnnotatedCandidate,
} from "./progressive-verification-lib.mjs";

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const args = parseArgs(process.argv.slice(2));
if (!args.candidate || !args.annotation || !args.out) {
  console.error(
    "Usage: node scripts/apply-progressive-item-feature-annotation.mjs --candidate <promoted.json> --annotation <annotation.json> --out <annotated.json> [--registry <file>]",
  );
  process.exit(2);
}

const repoRoot = process.cwd();
const promotedRoot = path.resolve(repoRoot, "public/content/source-intake/promoted");
const annotationRoot = path.resolve(repoRoot, "public/content/source-intake/annotations");
const annotatedRoot = path.resolve(repoRoot, "public/content/source-intake/annotated");
const candidatePath = path.resolve(args.candidate);
const annotationPath = path.resolve(args.annotation);
const outputPath = path.resolve(args.out);

assert(candidatePath.startsWith(promotedRoot + path.sep), "Feature-annotation candidate input must remain under public/content/source-intake/promoted/.");
assert(annotationPath.startsWith(annotationRoot + path.sep), "Feature-annotation artifact must remain under public/content/source-intake/annotations/.");
assert(outputPath.startsWith(annotatedRoot + path.sep), "Annotated candidate output must remain under public/content/source-intake/annotated/.");
assert(fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile(), "Promoted candidate input does not exist.");
assert(fs.existsSync(annotationPath) && fs.statSync(annotationPath).isFile(), "Feature-annotation artifact does not exist.");

const candidateBytes = fs.readFileSync(candidatePath);
const candidate = JSON.parse(candidateBytes.toString("utf8"));
const annotation = readJson(annotationPath);
const registry = readJson(path.resolve(args.registry ?? "public/content/source-intake/progressive-support.json"));
const options = {
  candidateManifestSha256: sha256Bytes(candidateBytes),
  evidenceRepoRoot: repoRoot,
  candidateRepoRoot: repoRoot,
};

const annotated = applyFeatureAnnotation(candidate, annotation, registry, options);
validateAnnotatedCandidate(annotated, candidate, annotation, registry, options);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(annotated, null, 2) + "\n", "utf8");
console.log(
  `OK: wrote inactive human-annotated candidate with ${annotated.items.length} item(s) to ${path.relative(repoRoot, outputPath)}.`,
);
