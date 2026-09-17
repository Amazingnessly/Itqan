import fs from "node:fs";
import path from "node:path";
import { validateActiveSessionPolicy } from "./active-session-policy.mjs";

const base = process.cwd();
const catalogText = fs.readFileSync(path.join(base, "src/learning/categoryCatalog.ts"), "utf8");
const activation = JSON.parse(fs.readFileSync(path.join(base, "public/content/activation/active-sessions.json"), "utf8"));
const categoryPattern = /(reading_units|vowels_sukun|shaddah|article_al|linking|fluent_reading):\s*\{[\s\S]*?manifestUrl:\s*"([^"]+)"[\s\S]*?blueprintUrl:\s*"([^"]+)"/g;
const resources = [];
let match;
while ((match = categoryPattern.exec(catalogText)) !== null) {
  resources.push({ category: match[1], manifestUrl: match[2], blueprintUrl: match[3] });
}

if (resources.length !== 6) throw new Error(`Expected 6 category resources, found ${resources.length}.`);

for (const { category, manifestUrl, blueprintUrl } of resources) {
  const manifest = JSON.parse(fs.readFileSync(path.join(base, manifestUrl.replace(/^\//, "public/")), "utf8"));
  const blueprint = JSON.parse(fs.readFileSync(path.join(base, blueprintUrl.replace(/^\//, "public/")), "utf8"));
  validateActiveSessionPolicy({ category, blueprint, manifest, activation });
}

console.log("OK: every explicitly active session is sequential, pedagogically scoped and backed only by double-verified controlled items.");
