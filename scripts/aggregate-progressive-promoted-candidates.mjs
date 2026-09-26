import fs from "node:fs";
import path from "node:path";
import {
  aggregatePromotedCandidates,
  readJson,
  sha256Bytes,
} from "./progressive-verification-lib.mjs";

function parseArgs(argv) {
  const values = { input: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [key, inline] = token.slice(2).split("=", 2);
    const value = inline ?? argv[++index];
    if (key === "input") {
      values.input.push(value);
    } else {
      values[key] = value;
    }
  }
  return values;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const args = parseArgs(process.argv.slice(2));
if (args.input.length < 2 || !args.out) {
  console.error(
    "Usage: node scripts/aggregate-progressive-promoted-candidates.mjs --input <promoted-subset.json> --input <promoted-subset.json> [--input ...] --out <module-candidate.json> [--registry <file>]",
  );
  process.exit(2);
}

const repoRoot = process.cwd();
const promotedRoot = path.resolve(repoRoot, "public/content/source-intake/promoted");

function resolvePromotedPath(rawPath, label, { mustExist }) {
  assert(typeof rawPath === "string" && rawPath.length > 0, `${label} path is missing.`);
  const absolute = path.resolve(rawPath);
  assert(
    absolute.startsWith(promotedRoot + path.sep),
    `${label} must remain under public/content/source-intake/promoted/.`,
  );
  if (mustExist) {
    assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `${label} does not exist: ${rawPath}`);
  }
  return absolute;
}

const outputPath = resolvePromotedPath(args.out, "Aggregation output", { mustExist: false });
const inputPaths = args.input.map((input, index) =>
  resolvePromotedPath(input, `Aggregation input ${index + 1}`, { mustExist: true }),
);
assert(new Set(inputPaths).size === inputPaths.length, "Aggregation inputs must be distinct files.");
assert(!inputPaths.includes(outputPath), "Aggregation output must not overwrite one of its input subset files.");

const registryPath = path.resolve(args.registry ?? "public/content/source-intake/progressive-support.json");
const registry = readJson(registryPath);
const inputBuffers = inputPaths.map((inputPath) => fs.readFileSync(inputPath));
const candidates = inputBuffers.map((buffer) => JSON.parse(buffer.toString("utf8")));
const inputManifests = inputPaths.map((inputPath, index) => ({
  file: path.relative(repoRoot, inputPath).split(path.sep).join("/"),
  sha256: sha256Bytes(inputBuffers[index]),
}));

const aggregated = aggregatePromotedCandidates(candidates, registry, {
  evidenceRepoRoot: repoRoot,
  candidateRepoRoot: repoRoot,
  inputManifests,
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(aggregated, null, 2) + "\n", "utf8");
console.log(
  `OK: aggregated ${aggregated.verificationScope.sourceSubsetCount} promoted subset(s) into ${aggregated.items.length} inactive item(s) at ${path.relative(repoRoot, outputPath)}.`,
);
