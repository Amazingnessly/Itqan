import fs from "node:fs";
import path from "node:path";
import {
  buildFeatureAnnotationTemplate,
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
if (!args.candidate || !args.out) {
  console.error(
    "Usage: node scripts/prepare-progressive-item-feature-annotation.mjs --candidate <promoted.json> --out <annotation.json> [--registry <file>]",
  );
  process.exit(2);
}

const repoRoot = process.cwd();
const promotedRoot = path.resolve(repoRoot, "public/content/source-intake/promoted");
const annotationRoot = path.resolve(repoRoot, "public/content/source-intake/annotations");
const candidatePath = path.resolve(args.candidate);
const outputPath = path.resolve(args.out);

assert(
  candidatePath.startsWith(promotedRoot + path.sep),
  "Feature-annotation input candidate must remain under public/content/source-intake/promoted/.",
);
assert(fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile(), "Promoted candidate input does not exist.");
assert(
  outputPath.startsWith(annotationRoot + path.sep),
  "Feature-annotation template output must remain under public/content/source-intake/annotations/.",
);

const candidateBytes = fs.readFileSync(candidatePath);
const candidate = JSON.parse(candidateBytes.toString("utf8"));
const registry = readJson(path.resolve(args.registry ?? "public/content/source-intake/progressive-support.json"));
const template = buildFeatureAnnotationTemplate(candidate, registry, {
  candidateManifestSha256: sha256Bytes(candidateBytes),
  evidenceRepoRoot: repoRoot,
  candidateRepoRoot: repoRoot,
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(template, null, 2) + "\n", "utf8");
console.log(
  `OK: wrote pending qualified-human feature-annotation template with ${template.items.length} item(s) to ${path.relative(repoRoot, outputPath)}.`,
);
