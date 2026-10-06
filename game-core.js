export const BOOK_COLORS = [
  { id: "ruby", label: "rouge", fill: "#ef2536", dark: "#8f0712", edge: "#ffcf66" },
  { id: "blue", label: "bleu", fill: "#178ee8", dark: "#06477f", edge: "#ffd06b" },
  { id: "ochre", label: "ocre", fill: "#f2a30b", dark: "#8d4c00", edge: "#ffe084" },
  { id: "green", label: "vert", fill: "#4a9f2b", dark: "#1a5916", edge: "#ffd75d" },
  { id: "violet", label: "violet", fill: "#9a35ea", dark: "#4a0a7e", edge: "#ffd56d" },
  { id: "turquoise", label: "turquoise", fill: "#22c9c2", dark: "#08706e", edge: "#ffe17a" },
];

export function cloneState(state) {
  return state.map((stack) => stack.map((book) => ({ ...book })));
}

export function createSolvedState(colorCount, slotCount) {
  const stacks = [];
  for (let color = 0; color < colorCount; color += 1) {
    const stack = [];
    for (let number = 6; number >= 0; number -= 1) {
      stack.push({ color, number, id: `${color}-${number}` });
    }
    stacks.push(stack);
  }
  while (stacks.length < slotCount) stacks.push([]);
  return stacks;
}

export function topGroupStart(stack) {
  if (!stack.length) return -1;
  let start = stack.length - 1;
  while (start > 0) {
    const upper = stack[start];
    const lower = stack[start - 1];
    if (lower.color !== upper.color || lower.number !== upper.number + 1) break;
    start -= 1;
  }
  return start;
}

export function movableGroup(state, source) {
  const stack = state[source];
  if (!stack?.length) return [];
  return stack.slice(topGroupStart(stack));
}

export function isLegalMove(state, source, destination) {
  if (source === destination || source < 0 || destination < 0) return false;
  const sourceStack = state[source];
  const destinationStack = state[destination];
  if (!sourceStack?.length || !destinationStack) return false;
  const group = movableGroup(state, source);
  const groupBottom = group[0];
  const destinationTop = destinationStack.at(-1);
  return !destinationTop || (
    destinationTop.color === groupBottom.color
    && destinationTop.number > groupBottom.number
  );
}

export function applyMove(state, move) {
  if (!isLegalMove(state, move.from, move.to)) return null;
  const next = cloneState(state);
  const start = topGroupStart(next[move.from]);
  const group = next[move.from].splice(start);
  next[move.to].push(...group);
  return next;
}

export function isSolved(state, colorCount) {
  const complete = new Set();
  for (const stack of state) {
    if (!stack.length) continue;
    if (stack.length !== 7) return false;
    const color = stack[0].color;
    for (let index = 0; index < 7; index += 1) {
      if (stack[index].color !== color || stack[index].number !== 6 - index) return false;
    }
    complete.add(color);
  }
  return complete.size === colorCount;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function levelConfig(levelNumber) {
  const index = Math.max(0, Math.min(29, levelNumber - 1));
  return {
    colorCount: 6,
    slotCount: 8,
    targetMoves: 16 + Math.floor(index * 6 / 29),
  };
}

function createRandomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
}

function scrambleCandidate(config, seed, splitCount) {
  const random = mulberry32(seed);
  const state = createSolvedState(config.colorCount, config.slotCount);
  const inverseMoves = [];

  for (let step = 0; step < splitCount; step += 1) {
    const candidates = [];
    for (let source = 0; source < state.length; source += 1) {
      const stack = state[source];
      if (stack.length < 2) continue;
      const groupStart = topGroupStart(stack);
      if (stack.length - groupStart < 2) continue;

      for (let cut = groupStart + 1; cut < stack.length; cut += 1) {
        const group = stack.slice(cut);
        const groupBottom = group[0];
        for (let destination = 0; destination < state.length; destination += 1) {
          if (destination === source || state[destination].length + group.length > 8) continue;
          const destinationTop = state[destination].at(-1);
          const wouldMerge = destinationTop
            && destinationTop.color === groupBottom.color
            && destinationTop.number === groupBottom.number + 1;
          if (wouldMerge) continue;
          const mixingBonus = destinationTop && destinationTop.color !== groupBottom.color ? 4 : 1;
          candidates.push({ source, destination, cut, mixingBonus });
        }
      }
    }

    if (!candidates.length) break;
    const weighted = [];
    for (const candidate of candidates) {
      for (let weight = 0; weight < candidate.mixingBonus; weight += 1) weighted.push(candidate);
    }
    const choice = weighted[Math.floor(random() * weighted.length)];
    const group = state[choice.source].splice(choice.cut);
    state[choice.destination].push(...group);
    inverseMoves.push({ from: choice.destination, to: choice.source });
  }

  const guaranteedSolution = inverseMoves.reverse();
  if (!validateSolution(state, guaranteedSolution, config.colorCount)) {
    return null;
  }
  const solution = solveState(state, config.colorCount, { maxNodes: 100000, maxTimeMs: 1600 })
    ?? guaranteedSolution;
  if (!validateSolution(state, solution, config.colorCount)) return null;
  return { state, solution, seed, splitCount };
}

export function generateLevel(levelNumber, requestedSeed = createRandomSeed()) {
  const config = levelConfig(levelNumber);
  const baseSeed = requestedSeed >>> 0;
  let best = null;

  for (let attempt = 0; attempt < 600; attempt += 1) {
    const seed = (baseSeed ^ Math.imul(attempt + 1, 2654435761)) >>> 0;
    const splitCount = 22 + ((seed >>> 8) % 17);
    const candidate = scrambleCandidate(config, seed, splitCount);
    if (!candidate) continue;
    const distance = Math.abs(candidate.solution.length - config.targetMoves);
    const score = distance * 2 + (candidate.solution.length < config.targetMoves ? 1 : 0);
    if (!best || score < best.score) best = { ...candidate, score };
    if (distance === 0) break;
  }

  if (!best) throw new Error(`Le niveau ${levelNumber} n'a pas pu être généré.`);
  return {
    number: levelNumber,
    ...config,
    splitCount: best.splitCount,
    seed: best.seed,
    initialState: cloneState(best.state),
    solution: best.solution,
  };
}

export function validateSolution(initialState, moves, colorCount) {
  let state = cloneState(initialState);
  for (const move of moves) {
    const next = applyMove(state, move);
    if (!next) return false;
    state = next;
  }
  return isSolved(state, colorCount);
}

function stateKey(state) {
  return state
    .map((stack) => stack.map((book) => `${book.color}${book.number}`).join("."))
    .sort()
    .join("|");
}

function correctConnections(state) {
  let total = 0;
  for (const stack of state) {
    for (let index = 1; index < stack.length; index += 1) {
      const lower = stack[index - 1];
      const upper = stack[index];
      if (lower.color === upper.color && lower.number === upper.number + 1) total += 1;
    }
  }
  return total;
}

function heuristic(state, colorCount) {
  const missingConnections = colorCount * 6 - correctConnections(state);
  let mixedBoundaries = 0;
  for (const stack of state) {
    for (let index = 1; index < stack.length; index += 1) {
      if (stack[index - 1].color !== stack[index].color) mixedBoundaries += 1;
    }
  }
  return missingConnections + mixedBoundaries * 0.15;
}

export function enumerateMoves(state) {
  const moves = [];
  let firstEmpty = -1;
  for (let index = 0; index < state.length; index += 1) {
    if (!state[index].length) {
      firstEmpty = index;
      break;
    }
  }

  for (let source = 0; source < state.length; source += 1) {
    const stack = state[source];
    if (!stack.length) continue;
    const groupStart = topGroupStart(stack);
    const groupIsWholeStack = groupStart === 0;
    const towerColor = stack[0].color;
    const isCompleteTower = stack.length === 7 && stack.every(
      (book, index) => book.color === towerColor && book.number === 6 - index,
    );
    if (isCompleteTower) continue;

    for (let destination = 0; destination < state.length; destination += 1) {
      if (!isLegalMove(state, source, destination)) continue;
      if (!state[destination].length) {
        if (destination !== firstEmpty || groupIsWholeStack) continue;
      }
      moves.push({ from: source, to: destination });
    }
  }
  return moves;
}

class MinHeap {
  constructor() { this.values = []; }
  get size() { return this.values.length; }
  push(value) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].score <= value.score) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }
  pop() {
    const root = this.values[0];
    const last = this.values.pop();
    if (this.values.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        let child = left;
        if (right < this.values.length && this.values[right].score < this.values[left].score) child = right;
        if (this.values[child].score >= last.score) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = last;
    }
    return root;
  }
}

export function solveState(initialState, colorCount, options = {}) {
  const maxNodes = options.maxNodes ?? 45000;
  const maxTimeMs = options.maxTimeMs ?? 700;
  const started = performance.now();
  const open = new MinHeap();
  const seen = new Map();
  const initialKey = stateKey(initialState);
  open.push({ state: cloneState(initialState), path: [], cost: 0, score: heuristic(initialState, colorCount) });
  seen.set(initialKey, 0);
  let explored = 0;

  while (open.size && explored < maxNodes && performance.now() - started < maxTimeMs) {
    const node = open.pop();
    explored += 1;
    if (isSolved(node.state, colorCount)) return node.path;

    for (const move of enumerateMoves(node.state)) {
      const nextState = applyMove(node.state, move);
      if (!nextState) continue;
      const nextCost = node.cost + 1;
      const key = stateKey(nextState);
      if ((seen.get(key) ?? Infinity) <= nextCost) continue;
      seen.set(key, nextCost);
      const estimate = heuristic(nextState, colorCount);
      open.push({
        state: nextState,
        path: [...node.path, move],
        cost: nextCost,
        score: nextCost + estimate * 1.35,
      });
    }
  }
  return null;
}

export function moveMatches(first, second) {
  return Boolean(first && second && first.from === second.from && first.to === second.to);
}
