import fs from "node:fs";
import path from "node:path";
import {
  buildControlledManifestReviewTemplate,
  readJson,
  sha256Bytes,
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
if (!args.annotated || !args.candidate || !args.annotation || !args.out) {
  console.error(
    "Usage: node scripts/prepare-progressive-controlled-manifest-review.mjs --annotated <annotated.json> --candidate <promoted.json> --annotation <annotation.json> --out <review.json> [--registry <file>]",
  );
  process.exit(2);
}

const repoRoot = process.cwd();
const annotatedRoot = path.resolve(repoRoot, "public/content/source-intake/annotated");
const promotedRoot = path.resolve(repoRoot, "public/content/source-intake/promoted");
const annotationRoot = path.resolve(repoRoot, "public/content/source-intake/annotations");
const reviewRoot = path.resolve(repoRoot, "public/content/source-intake/reviews");

const annotatedPath = path.resolve(args.annotated);
const candidatePath = path.resolve(args.candidate);
const annotationPath = path.resolve(args.annotation);
const outputPath = path.resolve(args.out);

assert(annotatedPath.startsWith(annotatedRoot + path.sep), "Annotated candidate input must remain under public/content/source-intake/annotated/.");
assert(candidatePath.startsWith(promotedRoot + path.sep), "Promoted candidate input must remain under public/content/source-intake/promoted/.");
assert(annotationPath.startsWith(annotationRoot + path.sep), "Feature annotation input must remain under public/content/source-intake/annotations/.");
assert(outputPath.startsWith(reviewRoot + path.sep), "Controlled-manifest review output must remain under public/content/source-intake/reviews/.");

for (const [label, filePath] of [
  ["Annotated candidate", annotatedPath],
  ["Promoted candidate", candidatePath],
  ["Feature annotation", annotationPath],
]) {
  assert(fs.existsSync(filePath) && fs.statSync(filePath).isFile(), `${label} input does not exist.`);
}

const annotatedBytes = fs.readFileSync(annotatedPath);
const candidateBytes = fs.readFileSync(candidatePath);
const annotationBytes = fs.readFileSync(annotationPath);
const annotatedCandidate = JSON.parse(annotatedBytes.toString("utf8"));
const originalCandidate = JSON.parse(candidateBytes.toString("utf8"));
const featureAnnotation = JSON.parse(annotationBytes.toString("utf8"));
const registry = readJson(path.resolve(args.registry ?? "public/content/source-intake/progressive-support.json"));

const template = buildControlledManifestReviewTemplate(
  {
    annotatedCandidate,
    originalCandidate,
    featureAnnotation,
    registry,
  },
  {
    annotatedCandidateManifestSha256: sha256Bytes(annotatedBytes),
    candidateManifestSha256: sha256Bytes(candidateBytes),
    featureAnnotationManifestSha256: sha256Bytes(annotationBytes),
    evidenceRepoRoot: repoRoot,
    candidateRepoRoot: repoRoot,
    policyRepoRoot: repoRoot,
  },
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(template, null, 2) + "\n", "utf8");
console.log(
  `OK: wrote pending controlled-manifest review with ${template.items.length} item(s) to ${path.relative(repoRoot, outputPath)}.`,
);
