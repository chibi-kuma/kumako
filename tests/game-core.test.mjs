import assert from "node:assert/strict";
import {
  applyMove,
  createSolvedState,
  generateLevel,
  isLegalMove,
  isSolved,
  levelConfig,
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

const solutionLengths = [];
for (let number = 1; number <= 30; number += 1) {
  const level = generateLevel(number, 100000 + number);
  assert.equal(level.initialState.length, level.slotCount);
  assert.equal(level.colorCount, 6);
  assert.equal(level.slotCount, 8);
  assert.equal(validateSolution(level.initialState, level.solution, level.colorCount), true, `niveau ${number}`);
  const bookCount = level.initialState.flat().length;
  assert.equal(bookCount, level.colorCount * 7);
  assert.ok(Math.abs(level.solution.length - level.targetMoves) <= 1, `difficulté niveau ${number}`);
  solutionLengths.push(level.solution.length);
}

const targets = Array.from({ length: 30 }, (_, index) => levelConfig(index + 1).targetMoves);
assert.deepEqual(targets, [...targets].sort((a, b) => a - b));
assert.ok(solutionLengths.every((length) => length >= 15));

const firstMix = generateLevel(1, 111);
const secondMix = generateLevel(1, 222);
assert.notDeepEqual(firstMix.initialState, secondMix.initialState);

console.log("30 niveaux aléatoires validés avec six couleurs et une difficulté progressive.");
