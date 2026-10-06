import assert from "node:assert/strict";
import {
  applyMove,
  createSolvedState,
  generateLevel,
  isLegalMove,
  isSolved,
  topGroupStart,
  validateSolution,
} from "../game-core.js";

const solved = createSolvedState(3, 5);
assert.equal(isSolved(solved, 3), true);
assert.equal(topGroupStart(solved[0]), 0);

const interrupted = [[
  { color: 0, number: 5 },
  { color: 0, number: 3 },
  { color: 0, number: 2 },
  { color: 0, number: 1 },
  { color: 0, number: 0 },
], []];
assert.equal(topGroupStart(interrupted[0]), 1);
assert.equal(isLegalMove(interrupted, 0, 1), true);
assert.ok(applyMove(interrupted, { from: 0, to: 1 }));

for (let number = 1; number <= 30; number += 1) {
  const level = generateLevel(number);
  assert.equal(level.initialState.length, level.slotCount);
  assert.equal(validateSolution(level.initialState, level.solution, level.colorCount), true, `niveau ${number}`);
  const bookCount = level.initialState.flat().length;
  assert.equal(bookCount, level.colorCount * 7);
}

console.log("30 niveaux validés.");
