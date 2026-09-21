import assert from "node:assert/strict";
import {
  sessionComposition,
  sessionCompositionLabel,
} from "../src/pages/Lesson/sessionComposition";

const foundationInteractions = [
  { itemId: "controlled-item-1", ignoredVisibleText: "same" },
  { itemId: "controlled-item-2", ignoredVisibleText: "same" },
  { itemId: "controlled-item-3", ignoredVisibleText: "same" },
  { itemId: "controlled-item-1", ignoredVisibleText: "different" },
];

const foundationComposition = sessionComposition(foundationInteractions);
assert.deepEqual(foundationComposition, {
  interactionCount: 4,
  distinctItemIdCount: 3,
  plannedRevisitCount: 1,
});
assert.equal(
  sessionCompositionLabel(foundationComposition),
  "4 interactions · 3 itemIds contrôlés distincts · 1 revisite pédagogique planifiée",
);

const noRevisitComposition = sessionComposition([
  { itemId: "controlled-item-1" },
  { itemId: "controlled-item-2" },
]);
assert.deepEqual(noRevisitComposition, {
  interactionCount: 2,
  distinctItemIdCount: 2,
  plannedRevisitCount: 0,
});
assert.equal(
  sessionCompositionLabel(noRevisitComposition),
  "2 interactions · 2 itemIds contrôlés distincts · 0 revisite pédagogique planifiée",
);

const repeatedSingleItemComposition = sessionComposition([
  { itemId: "controlled-item-1" },
  { itemId: "controlled-item-1" },
  { itemId: "controlled-item-1" },
]);
assert.deepEqual(repeatedSingleItemComposition, {
  interactionCount: 3,
  distinctItemIdCount: 1,
  plannedRevisitCount: 2,
});
assert.equal(
  sessionCompositionLabel(repeatedSingleItemComposition),
  "3 interactions · 1 itemId contrôlé distinct · 2 revisites pédagogiques planifiées",
);

console.log("Lesson session presentation tests passed: interaction, distinct itemId, and planned-revisit counts remain explicit and itemId-derived.");
