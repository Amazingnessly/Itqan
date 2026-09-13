import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const productionUrl = process.argv[2] ?? "https://itqan.gassamasa.workers.dev/";
const debugPort = 9222;
const debugBaseUrl = `http://127.0.0.1:${debugPort}`;
const MOBILE_VIEWPORT = { width: 390, height: 844 };

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const binary = candidates.find((candidate) => fs.existsSync(candidate));
  if (!binary) {
    throw new Error(`No Chrome/Chromium binary found. Checked: ${candidates.join(", ")}`);
  }
  return binary;
}

async function waitForPageTarget(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${debugBaseUrl}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(200);
  }
  throw new Error(`Chrome DevTools endpoint did not become ready.${lastError ? ` Last error: ${String(lastError)}` : ""}`);
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
        const text = (message.params.args ?? [])
          .map((arg) => arg.value ?? arg.description ?? arg.type)
          .join(" ");
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

async function waitForExpression(client, expression, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await client.evaluate(expression)) return;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}.${lastError ? ` Last error: ${String(lastError)}` : ""}`);
}

async function assertMobileLayout(client, label) {
  const layout = await client.evaluate(`(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
  }))()`);
  if (layout.innerWidth !== MOBILE_VIEWPORT.width) {
    throw new Error(`${label} did not honor the ${MOBILE_VIEWPORT.width}px mobile viewport (got ${layout.innerWidth}px).`);
  }
  if (!layout.viewportMeta.includes("width=device-width")) {
    throw new Error(`${label} is missing the required device-width viewport metadata.`);
  }
  if (layout.scrollWidth > layout.clientWidth + 1) {
    throw new Error(`${label} has horizontal overflow (${layout.scrollWidth}px content in ${layout.clientWidth}px viewport).`);
  }
}

async function openPrimaryRoute(client, navLabel, expectedText, routeLabel) {
  const navLabelLiteral = JSON.stringify(navLabel);
  const expectedTextLiteral = JSON.stringify(expectedText);
  const clicked = await client.evaluate(`(() => {
    const label = ${navLabelLiteral};
    const button = [...document.querySelectorAll(".bottom-nav button")]
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not open ${routeLabel} from the production bottom navigation.`);

  await waitForExpression(
    client,
    `document.body.innerText.includes(${expectedTextLiteral})`,
    `${routeLabel} to render`,
  );

  const active = await client.evaluate(`(() => {
    const label = ${navLabelLiteral};
    const button = [...document.querySelectorAll(".bottom-nav button")]
      .find((candidate) => candidate.textContent?.trim() === label);
    return button?.getAttribute("aria-current") === "page";
  })()`);
  if (!active) throw new Error(`${routeLabel} did not become the active primary navigation route.`);
  await assertMobileLayout(client, `Production ${routeLabel}`);
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

async function stopChrome(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForChildExit(child, 1500)) return;
  child.kill("SIGKILL");
  await waitForChildExit(child, 1500);
}

function removeBrowserProfile(directory) {
  try {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  } catch (error) {
    // GitHub-hosted runners are ephemeral. Cleanup must never turn a successful
    // production journey into a false deployment failure if a Chrome helper
    // process briefly retains a profile file after the browser itself exited.
    console.warn(`Browser profile cleanup skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const chromeBinary = findChromeBinary();
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "itqan-production-smoke-"));
const chrome = spawn(chromeBinary, [
  "--headless=new",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-background-networking",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let chromeStderr = "";
chrome.stderr.on("data", (chunk) => {
  if (chromeStderr.length < 12_000) chromeStderr += chunk.toString();
});

let client;
try {
  const target = await waitForPageTarget();
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: MOBILE_VIEWPORT.width,
    height: MOBILE_VIEWPORT.height,
    screenWidth: MOBILE_VIEWPORT.width,
    screenHeight: MOBILE_VIEWPORT.height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await client.send("Page.navigate", { url: productionUrl });

  await waitForExpression(
    client,
    `document.readyState === "complete" && document.body.innerText.includes("La précision d’abord.")`,
    "the rendered Itqān home screen",
  );

  const homeReady = await client.evaluate(`(() => {
    const primary = [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Commencer la session"));
    return Boolean(primary && document.body.innerText.includes("Itqān"));
  })()`);
  if (!homeReady) throw new Error("Rendered home screen is missing its primary session action.");
  await assertMobileLayout(client, "Production Accueil");

  const primaryRoutes = [
    ["Parcours", "Construis une lecture sûre", "Parcours"],
    ["Révision", "Stabiliser la précision", "Révision"],
    ["Sources", "Sources contrôlées", "Sources"],
    ["Profil", "Ta progression", "Profil"],
    ["Accueil", "La précision d’abord.", "Accueil"],
  ];
  for (const [navLabel, expectedText, routeLabel] of primaryRoutes) {
    await openPrimaryRoute(client, navLabel, expectedText, routeLabel);
  }

  const clicked = await client.evaluate(`(() => {
    const primary = [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Commencer la session"));
    if (!primary) return false;
    primary.click();
    return true;
  })()`);
  if (!clicked) throw new Error("Could not start the controlled lesson from the rendered home screen.");

  await waitForExpression(
    client,
    `Boolean(document.querySelector(".reading-arabic")) || document.body.innerText.includes("Session bloquée par sécurité")`,
    "the controlled lesson to resolve",
  );

  const lessonState = await client.evaluate(`(() => {
    const arabic = document.querySelector(".reading-arabic");
    return {
      safetyBlocked: document.body.innerText.includes("Session bloquée par sécurité"),
      arabicLength: arabic?.textContent?.trim().length ?? 0,
      lang: arabic?.getAttribute("lang") ?? "",
      dir: arabic?.getAttribute("dir") ?? "",
      verifiedSource: document.body.innerText.includes("Chaîne vérifiée deux fois sur le scan source."),
      readyAction: [...document.querySelectorAll("button")]
        .some((button) => button.textContent?.includes("Commencer ma lecture")),
    };
  })()`);

  if (lessonState.safetyBlocked) throw new Error("Production lesson entered the safety-blocked state.");
  if (lessonState.arabicLength <= 0) throw new Error("Controlled Arabic did not render in the production lesson.");
  if (lessonState.lang !== "ar" || lessonState.dir !== "rtl") {
    throw new Error("Controlled Arabic rendered without the required Arabic/RTL semantics.");
  }
  if (!lessonState.verifiedSource) throw new Error("Controlled-source verification marker is missing in production.");
  if (!lessonState.readyAction) throw new Error("Production lesson did not reach the ready-to-read state.");
  await assertMobileLayout(client, "Production lesson");

  await delay(250);
  if (client.runtimeErrors.length) {
    throw new Error(`Browser runtime errors detected: ${client.runtimeErrors.slice(0, 5).join(" | ")}`);
  }

  console.log(`Production mobile browser smoke passed at ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}: all five primary routes rendered, the controlled lesson opened with verified Arabic, and every checked surface stayed within the mobile viewport without runtime errors.`);
} catch (error) {
  if (chromeStderr.trim()) {
    console.error(`Chrome diagnostics:\n${chromeStderr.trim().slice(-4000)}`);
  }
  throw error;
} finally {
  client?.close();
  await stopChrome(chrome);
  removeBrowserProfile(userDataDir);
}
