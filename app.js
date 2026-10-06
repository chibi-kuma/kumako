import {
  BOOK_COLORS,
  applyMove,
  cloneState,
  generateLevel,
  isLegalMove,
  isSolved,
  moveMatches,
  movableGroup,
  solveState,
  topGroupStart,
  validateSolution,
} from "./game-core.js?v=6";

const playfield = document.querySelector("#playfield");
const levelTitle = document.querySelector("#levelTitle");
const moveCounter = document.querySelector("#moveCounter");
const undoButton = document.querySelector("#undoButton");
const restartButton = document.querySelector("#restartButton");
const hintButton = document.querySelector("#hintButton");
const hintLabel = document.querySelector("#hintLabel");
const hintIcon = document.querySelector("#hintIcon");
const levelsButton = document.querySelector("#levelsButton");
const levelPanel = document.querySelector("#levelPanel");
const closeLevelsButton = document.querySelector("#closeLevelsButton");
const levelGrid = document.querySelector("#levelGrid");
const hintLayer = document.querySelector("#hintLayer");
const hintPath = document.querySelector("#hintPath");
const completionNotice = document.querySelector("#completionNotice");
const status = document.querySelector("#status");
const game = document.querySelector("#game");
const topbar = document.querySelector(".topbar");
const controls = document.querySelector(".controls");

let currentLevelNumber = Number.parseInt(localStorage.getItem("kumako-level") || "1", 10);
if (!Number.isInteger(currentLevelNumber) || currentLevelNumber < 1 || currentLevelNumber > 30) currentLevelNumber = 1;

let level;
let state;
let initialState;
let history = [];
let moveCount = 0;
let hintPlan = [];
let won = false;
let drag = null;
let hintTimer = null;

function loadLevel(number) {
  currentLevelNumber = number;
  localStorage.setItem("kumako-level", String(number));
  level = generateLevel(number);
  state = cloneState(level.initialState);
  initialState = cloneState(level.initialState);
  history = [];
  moveCount = 0;
  hintPlan = [...level.solution];
  won = false;
  hideHint();
  render();
  updateLevelGrid();
  status.textContent = `Niveau ${number}. ${level.colorCount} couleurs et ${level.slotCount} emplacements.`;
}

function createBookElement(book, stackIndex, bookIndex) {
  const color = BOOK_COLORS[book.color];
  const element = document.createElement("div");
  element.className = "book";
  element.dataset.stack = String(stackIndex);
  element.dataset.bookIndex = String(bookIndex);
  element.style.setProperty("--size", String(book.number));
  element.style.setProperty("--fill", color.fill);
  element.style.setProperty("--dark", color.dark);
  element.style.setProperty("--edge", color.edge);
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", book.number === 0 ? `Petit livre ${color.label}` : `Livre ${color.label} numéro ${book.number}`);

  if (book.number > 0) {
    const number = document.createElement("span");
    number.className = "book-number";
    number.textContent = String(book.number);
    element.append(number);
  }
  return element;
}

function fitBooksBelowHeader() {
  const tallestStack = Math.max(1, ...state.map((stack) => stack.length));
  const playfieldRect = playfield.getBoundingClientRect();
  const headerRect = topbar.getBoundingClientRect();
  const availableHeight = Math.max(1, playfieldRect.bottom - headerRect.bottom - 10);
  const normalHeight = Math.min(39, Math.max(20, window.innerHeight * .061));
  const fittedHeight = Math.min(normalHeight, (availableHeight + tallestStack - 1) / tallestStack);
  game.style.setProperty("--book-height", `${Math.max(15, Math.floor(fittedHeight))}px`);
}

function render() {
  playfield.style.setProperty("--slot-count", String(level.slotCount));
  fitBooksBelowHeader();
  playfield.replaceChildren();

  state.forEach((stack, stackIndex) => {
    const stackElement = document.createElement("div");
    stackElement.className = "stack";
    stackElement.dataset.stack = String(stackIndex);
    stackElement.setAttribute("aria-label", `Pile ${stackIndex + 1}`);
    const books = document.createElement("div");
    books.className = "stack-books";
    const groupStart = topGroupStart(stack);
    stack.forEach((book, bookIndex) => {
      const element = createBookElement(book, stackIndex, bookIndex);
      if (bookIndex >= groupStart) element.classList.add("movable");
      books.append(element);
    });
    stackElement.append(books);
    playfield.append(stackElement);
  });

  moveCounter.textContent = `${moveCount} ${moveCount === 1 ? "coup" : "coups"}`;
  levelTitle.textContent = `Niveau ${currentLevelNumber}`;
  levelTitle.classList.toggle("complete", won);
  undoButton.disabled = history.length === 0;
  hintLabel.textContent = won ? "Suivant" : "Indice";
  hintIcon.textContent = won ? "›" : "⌁";
  game.classList.toggle("level-complete", won);
  completionNotice.hidden = !won;
  completionNotice.classList.toggle("visible", won);
  document.querySelectorAll(".book.movable").forEach((book) => {
    book.addEventListener("pointerdown", onPointerDown);
  });
}

function updateLevelGrid() {
  for (const button of levelGrid.children) {
    button.classList.toggle("current", Number(button.dataset.level) === currentLevelNumber);
    button.setAttribute("aria-current", Number(button.dataset.level) === currentLevelNumber ? "true" : "false");
  }
}

function buildLevelGrid() {
  for (let number = 1; number <= 30; number += 1) {
    const button = document.createElement("button");
    button.className = "level-choice";
    button.type = "button";
    button.dataset.level = String(number);
    button.textContent = String(number);
    button.setAttribute("aria-label", `Niveau ${number}`);
    button.addEventListener("click", () => {
      levelPanel.hidden = true;
      loadLevel(number);
    });
    levelGrid.append(button);
  }
}

function saveHistory() {
  history.push({
    state: cloneState(state),
    moveCount,
    hintPlan: hintPlan ? [...hintPlan] : null,
    won,
  });
}

function commitMove(move) {
  const next = applyMove(state, move);
  if (!next) return false;
  saveHistory();
  state = next;
  moveCount += 1;
  if (hintPlan?.length && moveMatches(hintPlan[0], move)) hintPlan.shift();
  else hintPlan = null;
  won = isSolved(state, level.colorCount);
  hideHint();
  render();
  if (won) status.textContent = `Niveau ${currentLevelNumber} terminé en ${moveCount} coups.`;
  return true;
}

function onPointerDown(event) {
  if (won || drag || event.button > 0) return;
  const bookElement = event.currentTarget;
  const source = Number(bookElement.dataset.stack);
  const clickedIndex = Number(bookElement.dataset.bookIndex);
  const groupStart = topGroupStart(state[source]);
  if (clickedIndex < groupStart) return;

  event.preventDefault();
  hideHint();
  bookElement.setPointerCapture(event.pointerId);
  const stackElement = playfield.querySelector(`.stack[data-stack="${source}"]`);
  const sourceBooks = [...stackElement.querySelectorAll(".book")].slice(groupStart);
  const rects = sourceBooks.map((element) => element.getBoundingClientRect());
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const top = Math.min(...rects.map((rect) => rect.top));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.style.left = `${left}px`;
  ghost.style.top = `${top}px`;
  ghost.style.width = `${right - left}px`;
  ghost.style.height = `${bottom - top}px`;

  const group = movableGroup(state, source);
  group.forEach((book) => {
    const clone = createBookElement(book, source, 0);
    const original = sourceBooks[group.indexOf(book)];
    clone.style.setProperty("--ghost-book-width", `${original.getBoundingClientRect().width}px`);
    ghost.append(clone);
  });
  document.body.append(ghost);
  sourceBooks.forEach((element) => element.classList.add("source-hidden"));

  drag = {
    source,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    ghost,
    sourceBooks,
    currentTarget: -1,
  };
  bookElement.addEventListener("pointermove", onPointerMove);
  bookElement.addEventListener("pointerup", onPointerUp, { once: true });
  bookElement.addEventListener("pointercancel", onPointerCancel, { once: true });
}

function nearestStack(clientX, clientY) {
  const gameRect = game.getBoundingClientRect();
  const controlsRect = controls.getBoundingClientRect();
  if (clientY < gameRect.top || clientY > controlsRect.top + 12) return -1;
  let nearest = -1;
  let distance = Infinity;
  document.querySelectorAll(".stack").forEach((stack) => {
    const rect = stack.getBoundingClientRect();
    const candidateDistance = Math.abs(clientX - (rect.left + rect.width / 2));
    if (candidateDistance < distance) {
      nearest = Number(stack.dataset.stack);
      distance = candidateDistance;
    }
  });
  return nearest;
}

function clearDropHighlights() {
  document.querySelectorAll(".stack").forEach((stack) => stack.classList.remove("drop-valid", "drop-invalid"));
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const x = event.clientX - drag.startX;
  const y = event.clientY - drag.startY;
  drag.ghost.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.025)`;
  const target = nearestStack(event.clientX, event.clientY);
  if (target === drag.currentTarget) return;
  drag.currentTarget = target;
  clearDropHighlights();
  if (target >= 0 && target !== drag.source) {
    const stack = playfield.querySelector(`.stack[data-stack="${target}"]`);
    stack.classList.add(isLegalMove(state, drag.source, target) ? "drop-valid" : "drop-invalid");
  }
}

function finishDrag(validMove) {
  if (!drag) return;
  clearDropHighlights();
  const activeDrag = drag;
  drag = null;

  if (validMove) {
    const targetRect = playfield.querySelector(`.stack[data-stack="${validMove.to}"]`).getBoundingClientRect();
    const ghostRect = activeDrag.ghost.getBoundingClientRect();
    const translateX = targetRect.left + targetRect.width / 2 - (ghostRect.left + ghostRect.width / 2);
    activeDrag.ghost.style.transition = "transform 170ms cubic-bezier(.2,.75,.3,1)";
    activeDrag.ghost.style.transform += ` translate3d(${translateX}px, 0, 0)`;
    window.setTimeout(() => {
      activeDrag.ghost.remove();
      commitMove(validMove);
    }, 175);
  } else {
    activeDrag.ghost.style.transition = "transform 290ms cubic-bezier(.2,.9,.35,1.18)";
    activeDrag.ghost.style.transform = "translate3d(0,0,0) scale(1)";
    window.setTimeout(() => {
      activeDrag.ghost.remove();
      activeDrag.sourceBooks.forEach((element) => element.classList.remove("source-hidden"));
    }, 295);
  }
}

function onPointerUp(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const target = nearestStack(event.clientX, event.clientY);
  const move = { from: drag.source, to: target };
  finishDrag(isLegalMove(state, move.from, move.to) ? move : null);
}

function onPointerCancel() { finishDrag(null); }

function hideHint() {
  window.clearTimeout(hintTimer);
  hintLayer.classList.remove("visible");
  hintPath.setAttribute("d", "");
  document.querySelectorAll(".book.hint-source, .book.hint-target").forEach((book) => {
    book.classList.remove("hint-source", "hint-target");
  });
  document.querySelectorAll(".stack.hint-target-empty").forEach((stack) => {
    stack.classList.remove("hint-target-empty");
  });
}

function showHint(move) {
  const sourceStack = playfield.querySelector(`.stack[data-stack="${move.from}"]`);
  const destinationStack = playfield.querySelector(`.stack[data-stack="${move.to}"]`);
  const sourceBooks = [...sourceStack.querySelectorAll(".book")];
  const sourceGroup = sourceBooks.slice(topGroupStart(state[move.from]));
  sourceGroup.forEach((book) => book.classList.add("hint-source"));
  const sourceAnchor = sourceGroup[0].getBoundingClientRect();

  const destinationBooks = [...destinationStack.querySelectorAll(".book")];
  const destinationTop = destinationBooks.at(-1);
  if (destinationTop) destinationTop.classList.add("hint-target");
  else destinationStack.classList.add("hint-target-empty");
  const destinationAnchor = destinationTop?.getBoundingClientRect() ?? destinationStack.getBoundingClientRect();

  const gameRect = game.getBoundingClientRect();
  const headerBottom = topbar.getBoundingClientRect().bottom - gameRect.top;
  const startX = sourceAnchor.left + sourceAnchor.width / 2 - gameRect.left;
  const startY = sourceAnchor.top + sourceAnchor.height / 2 - gameRect.top;
  const endX = destinationAnchor.left + destinationAnchor.width / 2 - gameRect.left;
  const endY = destinationTop
    ? destinationAnchor.top + destinationAnchor.height / 2 - gameRect.top
    : destinationAnchor.bottom - gameRect.top - 14;
  const distance = Math.abs(endX - startX);
  const controlX = (startX + endX) / 2;
  const controlY = Math.max(headerBottom + 16, Math.min(startY, endY) - Math.min(70, distance * .22 + 24));
  hintPath.setAttribute("d", `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`);
  hintLayer.classList.add("visible");
  const sourceColor = BOOK_COLORS[movableGroup(state, move.from)[0].color].label;
  status.textContent = `Indice : déplace le groupe ${sourceColor} de la pile ${move.from + 1} vers la pile ${move.to + 1}.`;
  hintTimer = window.setTimeout(hideHint, 5000);
}

function preferredPlanIsValid() {
  return hintPlan?.length && validateSolution(state, hintPlan, level.colorCount);
}

function requestHint() {
  if (won) {
    loadLevel(currentLevelNumber === 30 ? 1 : currentLevelNumber + 1);
    return;
  }
  hideHint();
  hintButton.disabled = true;
  status.textContent = "Recherche du prochain coup…";
  window.setTimeout(() => {
    let plan = preferredPlanIsValid() ? hintPlan : solveState(state, level.colorCount);
    if (!plan?.length) {
      plan = level.solution && validateSolution(state, level.solution, level.colorCount) ? level.solution : null;
    }
    hintButton.disabled = false;
    if (plan?.length) {
      hintPlan = [...plan];
      showHint(plan[0]);
    } else {
      status.textContent = "Je ne trouve pas de chemin depuis cette position. Tu peux annuler ton dernier coup.";
    }
  }, 40);
}

undoButton.addEventListener("click", () => {
  const previous = history.pop();
  if (!previous) return;
  state = previous.state;
  moveCount = previous.moveCount;
  hintPlan = previous.hintPlan;
  won = previous.won;
  hideHint();
  render();
  status.textContent = "Dernier coup annulé.";
});

restartButton.addEventListener("click", () => {
  state = cloneState(initialState);
  history = [];
  moveCount = 0;
  hintPlan = [...level.solution];
  won = false;
  hideHint();
  render();
  status.textContent = `Niveau ${currentLevelNumber} recommencé.`;
});

hintButton.addEventListener("click", requestHint);

levelsButton.addEventListener("click", () => {
  hideHint();
  levelPanel.hidden = false;
  updateLevelGrid();
  levelPanel.querySelector(".level-choice.current")?.focus();
});

closeLevelsButton.addEventListener("click", () => {
  levelPanel.hidden = true;
  levelsButton.focus();
});

let resizeFrame;
window.addEventListener("resize", () => {
  hideHint();
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    if (drag) finishDrag(null);
    render();
  });
});
document.addEventListener("visibilitychange", () => { if (document.hidden && drag) finishDrag(null); });

buildLevelGrid();
loadLevel(currentLevelNumber);
