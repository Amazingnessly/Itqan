import path from "node:path";
import { readJson, validateHumanVerificationBundle } from "./progressive-verification-lib.mjs";

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
if (!args.verification) {
  console.error("Usage: node scripts/validate-progressive-human-verification.mjs --verification <file> [--registry <file>]");
  process.exit(2);
}

const verificationPath = path.resolve(args.verification);
const registryPath = path.resolve(args.registry ?? "public/content/source-intake/progressive-support.json");
const verification = readJson(verificationPath);
const registry = readJson(registryPath);
const { module, items } = validateHumanVerificationBundle(verification, registry);

console.log(`OK: ${items.length} human-verified item(s) validated for module ${module.id}; exact UTF-8 hashes and dual visual passes are intact.`);
