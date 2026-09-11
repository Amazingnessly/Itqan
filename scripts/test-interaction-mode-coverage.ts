import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SUPPORTED_INTERACTION_MODES,
  isSupportedInteractionMode,
} from "../src/learning/interactionModes";
import { INTERACTION_INSTRUCTIONS, METHOD_STEPS } from "../src/pages/Lesson/interactionInstructions";

const blueprintDir = path.join(process.cwd(), "public/content/blueprints");
const blueprintFiles = fs.readdirSync(blueprintDir).filter((file) => file.endsWith(".json"));
const usedModes = new Set<string>();

for (const file of blueprintFiles) {
  const blueprint = JSON.parse(fs.readFileSync(path.join(blueprintDir, file), "utf8"));
  for (const session of blueprint.sessions ?? []) {
    for (const interaction of session.interactions ?? []) {
      assert.equal(
        isSupportedInteractionMode(interaction.mode),
        true,
        `Unsupported interaction mode ${interaction.mode} in ${file}/${session.id}`,
      );
      usedModes.add(interaction.mode);
    }
  }
}

assert.deepEqual(
  [...usedModes].sort(),
  [...SUPPORTED_INTERACTION_MODES].sort(),
  "Supported interaction modes must exactly match the modes present in controlled blueprints.",
);
assert.deepEqual(
  Object.keys(INTERACTION_INSTRUCTIONS).sort(),
  [...SUPPORTED_INTERACTION_MODES].sort(),
  "Lesson instructions must cover every supported interaction mode exactly once.",
);

for (const mode of SUPPORTED_INTERACTION_MODES) {
  const instruction = INTERACTION_INSTRUCTIONS[mode];
  assert.ok(METHOD_STEPS.includes(instruction.kicker));
  assert.ok(instruction.title.trim().length > 0);
  assert.ok(instruction.hint.trim().length > 0);
}

console.log(`Interaction mode coverage passed for ${SUPPORTED_INTERACTION_MODES.length} controlled modes.`);
