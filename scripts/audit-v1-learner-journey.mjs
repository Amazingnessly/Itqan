import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PREVIEW_PORT = 4173;
const DEBUG_PORT = 9223;
const APP_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;
const DEBUG_BASE_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const LEARNER_KEY = "itqan:learner:v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const DELAYED_GAP_MS = 13 * 60 * 60 * 1000;
const INTERACTION_GAP_MS = 60_000;
const CATEGORY_ORDER = [
  "reading_units",
  "vowels_sukun",
  "shaddah",
  "article_al",
  "linking",
  "fluent_reading",
];
const CATEGORY_LABELS = {
  reading_units: "Unités de lecture",
  vowels_sukun: "Voyelles & Sukūn",
  shaddah: "Shaddah",
  article_al: "Article",
  linking: "Enchaînement",
  fluent_reading: "Lecture fluide",
};
const BLUEPRINT_PATHS = {
  reading_units: "public/content/blueprints/units-batch01.json",
  vowels_sukun: "public/content/blueprints/vowels_sukun-batch02.json",
  shaddah: "public/content/blueprints/shaddah-batch02.json",
  article_al: "public/content/blueprints/article_al-batch02.json",
  linking: "public/content/blueprints/linking-batch02.json",
  fluent_reading: "public/content/blueprints/fluent_reading-batch02.json",
};
const VIEWPORTS = {
  mobile: { width: 390, height: 844, mobile: true },
  desktop: { width: 1280, height: 900, mobile: false },
};
const blueprints = Object.fromEntries(
  CATEGORY_ORDER.map((category) => [category, JSON.parse(fs.readFileSync(BLUEPRINT_PATHS[category], "utf8"))]),
);

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const binary = candidates.find((candidate) => fs.existsSync(candidate));
  if (!binary) throw new Error(`No Chrome/Chromium binary found. Checked: ${candidates.join(", ")}`);
  return binary;
}

async function waitForHttp(url, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}.${lastError ? ` Last error: ${String(lastError)}` : ""}`);
}

async function waitForPageTarget(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${DEBUG_BASE_URL}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch {
      // Chrome is still starting.
    }
    await delay(200);
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.runtimeErrors = [];
  }

  async connect() {
    this.ws = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out connecting to Chrome DevTools.")), 10_000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.ws.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Chrome DevTools WebSocket connection failed."));
      }, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result ?? {});
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params?.exceptionDetails;
        this.runtimeErrors.push(details?.exception?.description ?? details?.text ?? "Uncaught runtime exception");
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
        const text = (message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? arg.type).join(" ");
        this.runtimeErrors.push(`console.error: ${text}`);
      }
    });
  }

  send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Chrome DevTools WebSocket is not open."));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? "Browser evaluation failed.");
    }
    return response.result?.value;
  }

  close() {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close();
  }
}

async function waitForExpression(client, expression, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await client.evaluate(expression)) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}.${lastError ? ` Last error: ${String(lastError)}` : ""}`);
}

async function setViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
  });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, maxTouchPoints: viewport.mobile ? 5 : 0 });
}

async function assertLayout(client, viewport, label, requirePrimary = false) {
  const result = await client.evaluate(`(() => {
    const primary = document.querySelector(".primary-cta");
    const rect = primary?.getBoundingClientRect();
    const style = primary ? getComputedStyle(primary) : null;
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      primary: primary ? {
        visible: style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || 1) > 0,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      } : null,
    };
  })()`);
  if (result.innerWidth !== viewport.width) throw new Error(`${label}: expected ${viewport.width}px viewport, got ${result.innerWidth}px.`);
  if (result.scrollWidth > result.clientWidth + 1) throw new Error(`${label}: horizontal overflow (${result.scrollWidth}px in ${result.clientWidth}px).`);
  if (requirePrimary) {
    if (!result.primary?.visible) throw new Error(`${label}: primary action is not visible.`);
    if (result.primary.bottom <= 0 || result.primary.top >= viewport.height || result.primary.right <= 0 || result.primary.left >= viewport.width) {
      throw new Error(`${label}: primary action is outside the viewport.`);
    }
  }
}

async function waitForHome(client) {
  await waitForExpression(
    client,
    `document.readyState === "complete" && document.body.innerText.includes("La précision d’abord.")`,
    "home screen",
  );
}

async function clickButtonText(client, text) {
  const literal = JSON.stringify(text);
  const clicked = await client.evaluate(`(() => {
    const target = ${literal};
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => candidate.textContent?.trim() === target && !candidate.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not click button: ${text}`);
}

async function clickButtonAria(client, label) {
  const literal = JSON.stringify(label);
  const clicked = await client.evaluate(`(() => {
    const target = ${literal};
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => candidate.getAttribute("aria-label") === target && !candidate.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not click button with aria-label: ${label}`);
}

async function activateButtonAriaByKeyboard(client, label) {
  const literal = JSON.stringify(label);
  const focused = await client.evaluate(`(() => {
    const target = ${literal};
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => candidate.getAttribute("aria-label") === target && !candidate.disabled);
    if (!button) return false;
    button.focus();
    return document.activeElement === button;
  })()`);
  if (!focused) throw new Error(`Could not focus keyboard target: ${label}`);
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
}

function generateCategoryAttempts(category, startMs, limit = 60) {
  const blueprint = blueprints[category];
  if (blueprint.category !== category) throw new Error(`${category}: blueprint category mismatch.`);
  const sessions = blueprint.sessions.slice(0, 3);
  if (sessions.length !== 3) throw new Error(`${category}: expected three active sessions.`);
  const attempts = [];
  let cursorMs = startMs;
  for (let cycle = 0; cycle < 2 && attempts.length < limit; cycle += 1) {
    if (cycle === 1) cursorMs += DELAYED_GAP_MS;
    for (const session of sessions) {
      for (const interaction of session.interactions) {
        if (attempts.length >= limit) break;
        attempts.push({
          category,
          sessionId: session.id,
          itemId: interaction.itemId,
          attemptedAt: new Date(cursorMs).toISOString(),
          outcome: "correct",
        });
        cursorMs += INTERACTION_GAP_MS;
      }
      if (attempts.length >= limit) break;
    }
  }
  if (attempts.length !== limit) throw new Error(`${category}: could not generate ${limit} controlled attempts.`);
  return { attempts, endMs: cursorMs };
}

function prerequisiteHistory(targetCategory) {
  const targetIndex = CATEGORY_ORDER.indexOf(targetCategory);
  if (targetIndex < 0) throw new Error(`Unknown category: ${targetCategory}`);
  const attempts = [];
  let cursorMs = Date.now() - (40 * DAY_MS);
  for (const category of CATEGORY_ORDER.slice(0, targetIndex)) {
    const generated = generateCategoryAttempts(category, cursorMs, 60);
    attempts.push(...generated.attempts);
    cursorMs = generated.endMs + (60 * 60 * 1000);
  }
  return { attempts, cursorMs };
}

async function seedAttempts(client, attempts) {
  const serialized = JSON.stringify({ version: 1, attempts });
  await client.evaluate(`(() => {
    localStorage.clear();
    localStorage.setItem(${JSON.stringify(LEARNER_KEY)}, ${JSON.stringify(serialized)});
    return true;
  })()`);
  await client.send("Page.reload", { ignoreCache: true });
  await waitForHome(client);
}

async function openPath(client) {
  await clickButtonText(client, "Parcours");
  await waitForExpression(client, `document.body.innerText.includes("Construis une lecture sûre")`, "path screen");
}

async function openCategoryLesson(client, category, { keyboard = false } = {}) {
  const label = CATEGORY_LABELS[category];
  if (keyboard) await activateButtonAriaByKeyboard(client, label);
  else await clickButtonAria(client, label);
  await waitForExpression(
    client,
    `Boolean(document.querySelector(".reading-arabic")) || document.body.innerText.includes("Session bloquée par sécurité")`,
    `${label} lesson`,
  );
  const blocked = await client.evaluate(`document.body.innerText.includes("Session bloquée par sécurité")`);
  if (blocked) throw new Error(`${label}: lesson entered safety-blocked state.`);
}

async function lessonSnapshot(client) {
  return client.evaluate(`(() => {
    const arabic = document.querySelector(".reading-arabic");
    const method = [...document.querySelectorAll(".method-strip__step")].map((node) => node.textContent?.trim());
    const currentMethod = document.querySelector(".method-strip__step.is-current")?.textContent?.trim() ?? "";
    return {
      arabicLength: arabic?.textContent?.trim().length ?? 0,
      lang: arabic?.getAttribute("lang") ?? "",
      dir: arabic?.getAttribute("dir") ?? "",
      sourceVerified: document.body.innerText.includes("Chaîne vérifiée deux fois sur le scan source."),
      progress: document.querySelector(".lesson-progress-copy strong")?.textContent?.trim() ?? "",
      method,
      currentMethod,
    };
  })()`);
}

async function assertLesson(client, viewport, label, expectedProgress) {
  const state = await lessonSnapshot(client);
  if (state.arabicLength <= 0) throw new Error(`${label}: controlled Arabic did not render.`);
  if (state.lang !== "ar" || state.dir !== "rtl") throw new Error(`${label}: Arabic/RTL semantics are missing.`);
  if (!state.sourceVerified) throw new Error(`${label}: controlled-source marker is missing.`);
  if (state.progress !== expectedProgress) throw new Error(`${label}: expected progress ${expectedProgress}, got ${state.progress}.`);
  const expectedMethod = ["Voir", "Décomposer", "Prononcer", "Fluidifier"];
  if (JSON.stringify(state.method) !== JSON.stringify(expectedMethod)) throw new Error(`${label}: method strip is not canonical.`);
  if (!expectedMethod.includes(state.currentMethod)) throw new Error(`${label}: no canonical current method step.`);
  await assertLayout(client, viewport, label, true);
  return state.currentMethod;
}

async function finishReadingToSelfCheck(client) {
  await clickButtonText(client, "Commencer ma lecture");
  await waitForExpression(client, `document.body.innerText.includes("Lis maintenant, à ton rythme.")`, "reading phase");
  await clickButtonText(client, "J’ai terminé");
  await waitForExpression(client, `document.body.innerText.includes("Ta lecture était-elle exacte ?")`, "manual self-check");
}

async function completeExactInteraction(client) {
  await finishReadingToSelfCheck(client);
  await clickButtonText(client, "Exact");
  await waitForExpression(
    client,
    `Boolean([...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Commencer ma lecture")) || Boolean(document.querySelector(".lesson-complete"))`,
    "next interaction or lesson completion",
  );
}

async function retryThenCompleteExact(client) {
  await finishReadingToSelfCheck(client);
  await clickButtonText(client, "À reprendre");
  await waitForExpression(client, `document.body.innerText.includes("Reprends la même lecture.")`, "retry feedback");
  await clickButtonText(client, "Relire");
  await waitForExpression(client, `Boolean([...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Commencer ma lecture"))`, "retry ready state");
  await completeExactInteraction(client);
}

async function completeLesson(client, observedMethods, maxInteractions = 12) {
  for (let index = 0; index < maxInteractions; index += 1) {
    const complete = await client.evaluate(`Boolean(document.querySelector(".lesson-complete"))`);
    if (complete) return;
    const current = await client.evaluate(`document.querySelector(".method-strip__step.is-current")?.textContent?.trim() ?? ""`);
    if (current) observedMethods.add(current);
    await completeExactInteraction(client);
  }
  const complete = await client.evaluate(`Boolean(document.querySelector(".lesson-complete"))`);
  if (!complete) throw new Error("Lesson did not complete within the controlled interaction bound.");
}

async function assertCompletion(client, viewport, label) {
  await waitForExpression(client, `Boolean(document.querySelector(".lesson-complete"))`, `${label} completion`);
  const summary = await client.evaluate(`(() => ({
    exact: document.body.innerText.includes("Lectures exactes"),
    retries: document.body.innerText.includes("Reprises"),
    precision: document.body.innerText.includes("Il ne remplace jamais l’exactitude."),
  }))()`);
  if (!summary.exact || !summary.retries || !summary.precision) throw new Error(`${label}: completion summary is incomplete.`);
  await assertLayout(client, viewport, `${label} completion`, true);
}

async function runMobileCategoryAudit(client, category, observedMethods) {
  const history = prerequisiteHistory(category);
  await seedAttempts(client, history.attempts);
  await openPath(client);
  await openCategoryLesson(client, category);
  observedMethods.add(await assertLesson(client, VIEWPORTS.mobile, `${CATEGORY_LABELS[category]} mobile`, "1 / 10"));

  if (category === "reading_units") {
    await retryThenCompleteExact(client);
    observedMethods.add(await client.evaluate(`document.querySelector(".method-strip__step.is-current")?.textContent?.trim() ?? ""`));
    await completeExactInteraction(client);
    observedMethods.add(await client.evaluate(`document.querySelector(".method-strip__step.is-current")?.textContent?.trim() ?? ""`));
    await completeExactInteraction(client);
    const progressBeforeExit = await client.evaluate(`document.querySelector(".lesson-progress-copy strong")?.textContent?.trim() ?? ""`);
    if (progressBeforeExit !== "4 / 10") throw new Error(`Reading-unit interruption setup expected 4 / 10, got ${progressBeforeExit}.`);
    await clickButtonAria(client, "Quitter la séance");
    await waitForExpression(client, `document.body.innerText.includes("Construis une lecture sûre")`, "return to path after interruption");
    await client.send("Page.reload", { ignoreCache: true });
    await waitForHome(client);
    await openPath(client);
    await openCategoryLesson(client, category);
    observedMethods.add(await assertLesson(client, VIEWPORTS.mobile, "Reading-unit persisted recovery", "4 / 10"));
  }

  await completeLesson(client, observedMethods);
  await assertCompletion(client, VIEWPORTS.mobile, `${CATEGORY_LABELS[category]} mobile`);
}

async function runDesktopJourney(client, observedMethods) {
  await setViewport(client, VIEWPORTS.desktop);
  await seedAttempts(client, []);
  await assertLayout(client, VIEWPORTS.desktop, "Desktop home");
  await openPath(client);
  await openCategoryLesson(client, "reading_units", { keyboard: true });
  observedMethods.add(await assertLesson(client, VIEWPORTS.desktop, "Reading units desktop keyboard entry", "1 / 10"));
  await completeLesson(client, observedMethods);
  await assertCompletion(client, VIEWPORTS.desktop, "Reading units desktop");
}

async function runDelayedMasteryTransition(client, observedMethods) {
  await setViewport(client, VIEWPORTS.mobile);
  const generated = generateCategoryAttempts("reading_units", Date.now() - (10 * DAY_MS), 59);
  await seedAttempts(client, generated.attempts);
  await openPath(client);
  await openCategoryLesson(client, "reading_units");
  observedMethods.add(await assertLesson(client, VIEWPORTS.mobile, "Delayed mastery verification", "10 / 10"));
  await completeExactInteraction(client);
  await waitForExpression(client, `document.body.innerText.includes("Une nouvelle étape s’ouvre.")`, "mastery unlock completion");
  const unlocked = await client.evaluate(`document.body.innerText.includes("Voyelles & Sukūn est maintenant accessible.")`);
  if (!unlocked) throw new Error("Delayed mastery verification did not unlock the next controlled category.");
  await clickButtonText(client, "Voir la suite");
  await waitForExpression(client, `document.body.innerText.includes("Construis une lecture sûre")`, "path after mastery unlock");
  const vowelsEnabled = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((candidate) => candidate.getAttribute("aria-label") === "Voyelles & Sukūn");
    return Boolean(button && !button.disabled);
  })()`);
  if (!vowelsEnabled) throw new Error("Next category remained unavailable after verified mastery transition.");
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener("exit", onExit);
      resolve(value);
    };
    const onExit = () => finish(true);
    const timeout = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForChildExit(child, 1500)) return;
  child.kill("SIGKILL");
  await waitForChildExit(child, 1500);
}

const preview = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "preview",
  "--host", "127.0.0.1",
  "--port", String(PREVIEW_PORT),
], { stdio: ["ignore", "ignore", "pipe"] });
let previewStderr = "";
preview.stderr.on("data", (chunk) => { if (previewStderr.length < 8000) previewStderr += chunk.toString(); });

const chromeBinary = findChromeBinary();
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "itqan-v1-audit-"));
const chrome = spawn(chromeBinary, [
  "--headless=new",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-background-networking",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let chromeStderr = "";
chrome.stderr.on("data", (chunk) => { if (chromeStderr.length < 12_000) chromeStderr += chunk.toString(); });

let client;
try {
  await waitForHttp(APP_URL, "Vite production preview");
  const target = await waitForPageTarget();
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  await setViewport(client, VIEWPORTS.mobile);
  await client.send("Page.navigate", { url: APP_URL });
  await waitForHome(client);
  await assertLayout(client, VIEWPORTS.mobile, "Mobile home");

  const observedMethods = new Set();
  for (const category of CATEGORY_ORDER) {
    await runMobileCategoryAudit(client, category, observedMethods);
  }
  await runDesktopJourney(client, observedMethods);
  await runDelayedMasteryTransition(client, observedMethods);

  const expectedMethods = ["Voir", "Décomposer", "Prononcer", "Fluidifier"];
  for (const method of expectedMethods) {
    if (!observedMethods.has(method)) throw new Error(`V1 journey never exercised the ${method} phase.`);
  }

  if (client.runtimeErrors.length) {
    throw new Error(`Browser runtime errors detected: ${client.runtimeErrors.slice(0, 8).join(" | ")}`);
  }

  console.log("V1 production-build learner journey audit passed: all six controlled categories completed a mobile session; interruption/reload recovery, retry feedback, RTL semantics, canonical method phases, desktop keyboard entry, viewport overflow checks, and a delayed mastery unlock were exercised through the real UI.");
} catch (error) {
  if (previewStderr.trim()) console.error(`Preview diagnostics:\n${previewStderr.trim().slice(-3000)}`);
  if (chromeStderr.trim()) console.error(`Chrome diagnostics:\n${chromeStderr.trim().slice(-4000)}`);
  throw error;
} finally {
  client?.close();
  await stopChild(chrome);
  await stopChild(preview);
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (error) {
    console.warn(`Browser profile cleanup skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}
