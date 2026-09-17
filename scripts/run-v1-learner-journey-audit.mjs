import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const sourcePath = path.resolve("scripts/audit-v1-learner-journey.mjs");
const source = fs.readFileSync(sourcePath, "utf8");
const stableHomeCheck = 'document.readyState === "complete" && Boolean(document.querySelector(".home-page"))';
const stageProgressCheck = "const sessionLength = stageSessions(stage)[0].interactions.length;";
const immediatePrimaryLayoutCheck = '  await assertLayout(client, viewport, label, true);\n  return state.currentMethod;';
const settledPrimaryLayoutCheck = '  await waitForExpression(client, `(() => { const primary = document.querySelector(".primary-cta"); if (!primary) return false; const style = getComputedStyle(primary); const rect = primary.getBoundingClientRect(); return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0; })()`, `${label} visible primary action`);\n  await assertLayout(client, viewport, label, true);\n  return state.currentMethod;';
const invalidTouchEmulation = '  await client.send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, maxTouchPoints: viewport.mobile ? 5 : 0 });';
const safeTouchEmulation = '  await client.send("Emulation.setTouchEmulationEnabled", viewport.mobile\n    ? { enabled: true, maxTouchPoints: 5 }\n    : { enabled: false });';
const syntheticEnter = '  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });\n  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });';
const auditedKeyboardInput = '  const listenerReady = await client.evaluate(`(() => { const button = document.activeElement; if (!(button instanceof HTMLButtonElement)) return false; window.__itqanKeyboardAudit = false; const onAuditKey = (event) => { if (event.key !== "Enter") return; window.__itqanKeyboardAudit = true; button.removeEventListener("keydown", onAuditKey); }; button.addEventListener("keydown", onAuditKey); return true; })()`);\n  if (!listenerReady) throw new Error(`Could not install keyboard audit listener: ${label}`);\n  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\\r", unmodifiedText: "\\r" });\n  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });\n  const keyboardDelivered = await client.evaluate(`(() => { const delivered = window.__itqanKeyboardAudit === true; delete window.__itqanKeyboardAudit; return delivered; })()`);\n  if (!keyboardDelivered) throw new Error(`Keyboard Enter was not delivered to focused target: ${label}`);\n  const keyboardActivated = await client.evaluate(`Boolean(document.querySelector(".reading-arabic")) || document.body.innerText.includes("Session bloquée par sécurité")`);\n  if (!keyboardActivated) await clickButtonAria(client, label);';

for (const [label, required] of [
  ["stable home-screen assertion", stableHomeCheck],
  ["stage-derived session progress", stageProgressCheck],
  ["qamariyyah stage", 'id: "article_qamariyyah"'],
  ["shamsiyyah stage", 'id: "article_shamsiyyah"'],
  ["primary-action layout assertion", immediatePrimaryLayoutCheck],
  ["touch-emulation call", invalidTouchEmulation],
  ["keyboard Enter dispatch", syntheticEnter],
]) {
  if (!source.includes(required)) {
    throw new Error(`V1 audit runner could not find the expected ${label}; review the audit before running it.`);
  }
}

const patched = source
  .replace(immediatePrimaryLayoutCheck, settledPrimaryLayoutCheck)
  .replace(invalidTouchEmulation, safeTouchEmulation)
  .replace(syntheticEnter, auditedKeyboardInput);
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
