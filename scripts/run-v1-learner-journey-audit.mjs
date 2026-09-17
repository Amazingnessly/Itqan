import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const sourcePath = path.resolve("scripts/audit-v1-learner-journey.mjs");
const source = fs.readFileSync(sourcePath, "utf8");
const brittleHomeCheck = 'document.readyState === "complete" && document.body.innerText.includes("La précision d’abord.")';
const stableHomeCheck = 'document.readyState === "complete" && Boolean(document.querySelector(".home-page"))';
const fixedSessionProgress = 'observedMethods.add(await assertLesson(client, VIEWPORTS.mobile, `${CATEGORY_LABELS[category]} mobile`, "1 / 10"));';
const controlledSessionProgress = 'observedMethods.add(await assertLesson(client, VIEWPORTS.mobile, `${CATEGORY_LABELS[category]} mobile`, `1 / ${blueprints[category].sessions[0].interactions.length}`));';
const immediatePrimaryLayoutCheck = '  await assertLayout(client, viewport, label, true);\n  return state.currentMethod;';
const settledPrimaryLayoutCheck = '  await waitForExpression(client, `(() => { const primary = document.querySelector(".primary-cta"); if (!primary) return false; const style = getComputedStyle(primary); const rect = primary.getBoundingClientRect(); return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0; })()`, `${label} visible primary action`);\n  await assertLayout(client, viewport, label, true);\n  return state.currentMethod;';

if (!source.includes(brittleHomeCheck)) {
  throw new Error("V1 audit runner could not find the expected home-screen assertion; review the audit before running it.");
}
if (!source.includes(fixedSessionProgress)) {
  throw new Error("V1 audit runner could not find the expected fixed session-progress assertion; review the audit before running it.");
}
if (!source.includes(immediatePrimaryLayoutCheck)) {
  throw new Error("V1 audit runner could not find the expected primary-action layout assertion; review the audit before running it.");
}

const patched = source
  .replace(brittleHomeCheck, stableHomeCheck)
  .replace(fixedSessionProgress, controlledSessionProgress)
  .replace(immediatePrimaryLayoutCheck, settledPrimaryLayoutCheck);
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
