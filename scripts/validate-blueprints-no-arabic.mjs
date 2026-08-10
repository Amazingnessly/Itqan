import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? "public/content/blueprints";
const arabic = /[\u0600-\u06FF]/u;
let failures = 0;

for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".json")) continue;
  const text = fs.readFileSync(path.join(dir, name), "utf8");
  if (arabic.test(text)) {
    failures++;
    console.error(`FAIL ${name}: Arabic script found directly inside blueprint.`);
  }
}

if (failures) process.exit(1);
console.log("OK: exercise blueprints contain no generated/direct Arabic strings.");
