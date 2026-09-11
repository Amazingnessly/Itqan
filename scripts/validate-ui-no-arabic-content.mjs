import fs from "node:fs";
import path from "node:path";

const sourceRoot = "src";
const checkedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const forbidden = /[\u0600-\u06FF]/u;
const targets = [];

function collectSourceFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(entryPath);
      continue;
    }
    if (checkedExtensions.has(path.extname(entry.name))) targets.push(entryPath);
  }
}

collectSourceFiles(sourceRoot);

let failures = 0;
for (const file of targets) {
  const text = fs.readFileSync(file, "utf8");
  if (!forbidden.test(text)) continue;
  console.error(`FAIL ${file}: direct Arabic source content detected. Visible Arabic must resolve from controlled manifests.`);
  failures += 1;
}

if (failures) process.exit(1);
console.log(`OK: ${targets.length} app source files contain no hard-coded Arabic.`);
