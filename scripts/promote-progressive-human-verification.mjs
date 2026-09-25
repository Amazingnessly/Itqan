import fs from "node:fs";
import path from "node:path";
import { promoteVerification, readJson } from "./progressive-verification-lib.mjs";

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
if (!args.verification || !args.evidence || !args.out) {
  console.error("Usage: node scripts/promote-progressive-human-verification.mjs --verification <file> --evidence <file> --out <file> [--registry <file>]");
  process.exit(2);
}

const repoRoot = process.cwd();
const registryPath = path.resolve(args.registry ?? "public/content/source-intake/progressive-support.json");
const outputPath = path.resolve(args.out);
const promotedRoot = path.resolve(repoRoot, "public/content/source-intake/promoted");
if (!(outputPath === promotedRoot || outputPath.startsWith(promotedRoot + path.sep))) {
  throw new Error("Promotion output must remain under public/content/source-intake/promoted/ until controlled-manifest review is complete.");
}

const promoted = promoteVerification({
  verification: readJson(path.resolve(args.verification)),
  evidenceMap: readJson(path.resolve(args.evidence)),
  registry: readJson(registryPath),
  repoRoot,
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(promoted, null, 2) + "\n", "utf8");
console.log(`OK: wrote inactive controlled-manifest candidate with ${promoted.items.length} item(s) to ${path.relative(repoRoot, outputPath)}.`);
