import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const sourcePath = path.resolve("scripts/audit-v1-learner-journey.mjs");
const source = fs.readFileSync(sourcePath, "utf8");
const brittleHomeCheck = 'document.readyState === "complete" && document.body.innerText.includes("La précision d’abord.")';
const stableHomeCheck = 'document.readyState === "complete" && Boolean(document.querySelector(".home-page"))';

if (!source.includes(brittleHomeCheck)) {
  throw new Error("V1 audit runner could not find the expected home-screen assertion; review the audit before running it.");
}

const patched = source.replace(brittleHomeCheck, stableHomeCheck);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "itqan-v1-audit-runner-"));
const tempScript = path.join(tempDir, "audit-v1-learner-journey.mjs");
fs.writeFileSync(tempScript, patched, "utf8");

const child = spawn(process.execPath, [tempScript], {
  cwd: process.cwd(),
  stdio: "inherit",
});

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal) reject(new Error(`V1 audit terminated by ${signal}.`));
    else resolve(code ?? 1);
  });
});

fs.rmSync(tempDir, { recursive: true, force: true });
process.exitCode = exitCode;
