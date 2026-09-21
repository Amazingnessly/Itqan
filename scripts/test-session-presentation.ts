import assert from "node:assert/strict";
import { sessionItemOutline } from "../src/learning/sessionPresentation.ts";

const foundation = sessionItemOutline(["item-a", "item-b", "item-c", "item-b"]);
assert.equal(foundation.interactionCount, 4);
assert.equal(foundation.controlledItemCount, 3);
assert.equal(foundation.plannedRevisitCount, 1);
assert.deepEqual([...foundation.revisitIndexes], [3]);

const allNew = sessionItemOutline(["item-a", "item-b", "item-c"]);
assert.equal(allNew.controlledItemCount, 3);
assert.equal(allNew.plannedRevisitCount, 0);
assert.deepEqual([...allNew.revisitIndexes], []);

const repeated = sessionItemOutline(["item-a", "item-a", "item-a"]);
assert.equal(repeated.controlledItemCount, 1);
assert.equal(repeated.plannedRevisitCount, 2);
assert.deepEqual([...repeated.revisitIndexes], [1, 2]);

console.log("Session presentation itemId regressions passed.");
