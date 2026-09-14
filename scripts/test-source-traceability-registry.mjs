import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const base = process.cwd();
const arabicPattern = /[\u0600-\u06ff]/u;
const categoryCatalog = fs.readFileSync(path.join(base, "src/learning/categoryCatalog.ts"), "utf8");
const manifestPattern = /manifestUrl:\s*"([^"]+)"/g;
const manifestUrls = [];
let match;
while ((match = manifestPattern.exec(categoryCatalog)) !== null) manifestUrls.push(match[1]);
const uniqueManifestUrls = [...new Set(manifestUrls)];

const expected = new Map();
for (const manifestUrl of uniqueManifestUrls) {
  const manifestPath = path.join(base, manifestUrl.replace(/^\//, "public/"));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const sourceControl = manifest.sourceControl;
  const current = expected.get(sourceControl.canonicalSourceId) ?? {
    sourceId: sourceControl.canonicalSourceId,
    batchIds: new Set(),
    verifiedPdfPages: new Set(),
    visualPassesPerItem: 2,
    silentNormalization: false,
    ocrUsedAsAuthority: false,
  };
  current.batchIds.add(manifest.batchId);
  for (const page of sourceControl.verifiedPdfPages) current.verifiedPdfPages.add(page);
  expected.set(sourceControl.canonicalSourceId, current);
}

const expectedSources = [...expected.values()]
  .map((source) => ({
    sourceId: source.sourceId,
    batchIds: [...source.batchIds].sort(),
    verifiedPdfPages: [...source.verifiedPdfPages].sort((a, b) => a - b),
    visualPassesPerItem: source.visualPassesPerItem,
    silentNormalization: source.silentNormalization,
    ocrUsedAsAuthority: source.ocrUsedAsAuthority,
  }))
  .sort((a, b) => a.sourceId.localeCompare(b.sourceId));

const generatedPath = path.join(base, "src/learning/sourceTraceability.generated.ts");
const generated = fs.readFileSync(generatedPath, "utf8");
assert.equal(arabicPattern.test(generated), false, "generated traceability must not contain Arabic text");
assert.equal(generated.includes("canonicalFile"), false, "generated traceability must not expose source filenames");
assert.equal(generated.includes("arabicExact"), false, "generated traceability must not expose exercise Arabic");

const marker = "export const CONTROLLED_SOURCE_TRACEABILITY: readonly ControlledSourceTraceability[] = ";
const markerIndex = generated.indexOf(marker);
assert.ok(markerIndex >= 0, "generated traceability export is missing");
const jsonStart = markerIndex + marker.length;
const jsonEnd = generated.indexOf(";", jsonStart);
assert.ok(jsonEnd > jsonStart, "generated traceability payload is malformed");
const actualSources = JSON.parse(generated.slice(jsonStart, jsonEnd));
assert.deepEqual(actualSources, expectedSources, "generated source traceability must match controlled manifests referenced by the category catalog");

for (const source of actualSources) {
  assert.equal(source.visualPassesPerItem, 2);
  assert.equal(source.silentNormalization, false);
  assert.equal(source.ocrUsedAsAuthority, false);
  assert.ok(source.batchIds.length > 0);
  assert.ok(source.verifiedPdfPages.length > 0);
}

const sourcesPage = fs.readFileSync(path.join(base, "src/pages/Sources/SourcesPage.tsx"), "utf8");
assert.ok(sourcesPage.includes("sourceTraceability.generated"), "SourcesPage must use generated controlled traceability");
assert.equal(sourcesPage.includes("../../content/manifest"), false, "SourcesPage must not use the legacy visual source manifest");

console.log(`Controlled source traceability tests passed for ${actualSources.length} source(s).`);
