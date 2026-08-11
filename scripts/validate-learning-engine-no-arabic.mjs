import fs from "node:fs";
import path from "node:path";
const target = process.argv[2] ?? "src/learning";
const arabic = /[\u0600-\u06FF]/u;
let failures = 0;
for (const entry of fs.readdirSync(target)) {
  if (!entry.endsWith(".ts")) continue;
  const file = path.join(target, entry);
  if (arabic.test(fs.readFileSync(file, "utf8"))) {
    failures += 1;
    console.error(`FAIL ${file}: Arabic literal found inside learning engine`);
  }
}
if (failures) process.exit(1);
console.log("OK: learning engine contains no hard-coded Arabic strings.");
