import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PENDING = "PENDING QUALIFIED HUMAN REVIEW";
const VERIFIED = "VERIFIED BY QUALIFIED HUMAN";
const CORRECTION_REQUIRED = "CORRECTION REQUIRED";
const BLOCKED = "BLOCKED BY AMBIGUOUS SOURCE";
const ALLOWED_STATUSES = new Set([PENDING, VERIFIED, CORRECTION_REQUIRED, BLOCKED]);

const CATEGORY_RESOURCES = Object.freeze({
  reading_units: {
    blueprint: "public/content/blueprints/units-batch01.json",
    manifest: "public/content/verified/s110-batch01.json",
  },
  vowels_sukun: {
    blueprint: "public/content/blueprints/vowels_sukun-batch02.json",
    manifest: "public/content/verified/s110-batch02.json",
  },
  shaddah: {
    blueprint: "public/content/blueprints/shaddah-batch02.json",
    manifest: "public/content/verified/s110-batch02.json",
  },
  article_al: {
    blueprint: "public/content/blueprints/article_al-batch02.json",
    manifest: "public/content/verified/s110-batch02.json",
  },
  linking: {
    blueprint: "public/content/blueprints/linking-batch02.json",
    manifest: "public/content/verified/s110-batch02.json",
  },
  fluent_reading: {
    blueprint: "public/content/blueprints/fluent_reading-batch02.json",
    manifest: "public/content/verified/s110-batch02.json",
  },
});

function fail(message) {
  throw new Error(`V1 human-review record invalid: ${message}`);
}

function stripCode(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function metadataValue(reviewText, label) {
  const prefix = `- ${label}:`;
  const line = reviewText.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  if (!line) fail(`missing reviewer metadata field: ${label}`);
  return stripCode(line.slice(prefix.length));
}

function parseReviewRows(reviewText) {
  const rows = [];
  for (const line of reviewText.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 6) continue;
    const category = stripCode(cells[0]);
    if (!Object.hasOwn(CATEGORY_RESOURCES, category)) continue;
    rows.push({
      category,
      sessionId: stripCode(cells[1]),
      blueprint: stripCode(cells[2]),
      manifest: stripCode(cells[3]),
      status: stripCode(cells[4]),
      evidence: stripCode(cells[5]),
    });
  }
  return rows;
}

function assertReviewerMetadata(reviewText) {
  const releaseSha = metadataValue(reviewText, "Release candidate SHA");
  const reviewer = metadataValue(reviewText, "Reviewer name or traceable reviewer ID");
  const qualification = metadataValue(reviewText, "Reviewer qualification/context relevant to Arabic reading instruction");
  const reviewDate = metadataValue(reviewText, "Review date");

  if (!/^[0-9a-f]{40}$/i.test(releaseSha)) fail("release candidate SHA must be a full 40-character commit SHA once review evidence is recorded");
  if (!reviewer || reviewer === "PENDING") fail("reviewer identity is required once review evidence is recorded");
  if (!qualification || qualification === "PENDING") fail("reviewer qualification/context is required once review evidence is recorded");
  if (!reviewDate || reviewDate === "PENDING") fail("review date is required once review evidence is recorded");
}

export function validateHumanReviewRecord({ activation, reviewText, requireComplete = false }) {
  const categories = Object.keys(CATEGORY_RESOURCES);
  const activationCategories = Object.keys(activation).filter((key) => key !== "schemaVersion");
  const unknownActivationCategories = activationCategories.filter((category) => !categories.includes(category));
  if (unknownActivationCategories.length) fail(`unknown activation categories: ${unknownActivationCategories.join(", ")}`);

  const missingActivationCategories = categories.filter((category) => !Array.isArray(activation[category]));
  if (missingActivationCategories.length) fail(`missing activation categories: ${missingActivationCategories.join(", ")}`);

  const expected = new Map();
  for (const category of categories) {
    for (const sessionId of activation[category]) {
      const key = `${category}:${sessionId}`;
      if (expected.has(key)) fail(`duplicate active session: ${key}`);
      expected.set(key, { category, sessionId });
    }
  }

  const rows = parseReviewRows(reviewText);
  const seen = new Map();
  for (const row of rows) {
    const key = `${row.category}:${row.sessionId}`;
    if (seen.has(key)) fail(`duplicate review row: ${key}`);
    seen.set(key, row);

    const expectedResources = CATEGORY_RESOURCES[row.category];
    if (row.blueprint !== expectedResources.blueprint) fail(`${key} points to unexpected blueprint ${row.blueprint}`);
    if (row.manifest !== expectedResources.manifest) fail(`${key} points to unexpected manifest ${row.manifest}`);
    if (!ALLOWED_STATUSES.has(row.status)) fail(`${key} has unsupported status ${row.status}`);
    if (row.status !== PENDING && (!row.evidence || row.evidence === "PENDING")) {
      fail(`${key} requires a traceable evidence/correction reference for status ${row.status}`);
    }
  }

  const missingRows = [...expected.keys()].filter((key) => !seen.has(key));
  const extraRows = [...seen.keys()].filter((key) => !expected.has(key));
  if (missingRows.length) fail(`missing active session review row(s): ${missingRows.join(", ")}`);
  if (extraRows.length) fail(`review row(s) are not currently active: ${extraRows.join(", ")}`);

  const overallOutcome = metadataValue(reviewText, "Overall outcome");
  if (!ALLOWED_STATUSES.has(overallOutcome)) fail(`unsupported overall outcome ${overallOutcome}`);

  const counts = {
    total: rows.length,
    pending: rows.filter((row) => row.status === PENDING).length,
    verified: rows.filter((row) => row.status === VERIFIED).length,
    corrections: rows.filter((row) => row.status === CORRECTION_REQUIRED).length,
    blocked: rows.filter((row) => row.status === BLOCKED).length,
  };

  const hasRecordedReview = counts.total > counts.pending;
  if (hasRecordedReview) assertReviewerMetadata(reviewText);

  if (requireComplete) {
    if (counts.pending) fail(`${counts.pending} active session(s) still await qualified human review`);
    if (counts.corrections) fail(`${counts.corrections} active session(s) still require controlled correction`);
    if (counts.blocked) fail(`${counts.blocked} active session(s) remain blocked by ambiguous source`);
    if (counts.verified !== counts.total) fail("every active session must be VERIFIED BY QUALIFIED HUMAN for release completion");
    assertReviewerMetadata(reviewText);
    if (overallOutcome !== VERIFIED) fail(`overall outcome must be ${VERIFIED} for release completion`);
  }

  return counts;
}

function runCli() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const activation = JSON.parse(fs.readFileSync(path.join(root, "public/content/activation/active-sessions.json"), "utf8"));
  const reviewText = fs.readFileSync(path.join(root, "docs/V1_ARABIC_HUMAN_REVIEW.md"), "utf8");
  const requireComplete = process.argv.includes("--require-complete");
  const counts = validateHumanReviewRecord({ activation, reviewText, requireComplete });

  if (requireComplete) {
    console.log(`OK: V1 human-review evidence is structurally complete for ${counts.total} active session(s). Arabic correctness remains a qualified-human assertion.`);
    return;
  }

  console.log(`OK: V1 human-review record covers ${counts.total} active session(s) with controlled references and supported statuses.`);
  if (counts.pending) console.log(`Human review remains pending for ${counts.pending} active session(s).`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
