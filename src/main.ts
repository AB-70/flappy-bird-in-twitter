// Flappy Bird on a single canvas. The world is a fixed 300x300 logical square
// (the X player card is square) that gets scaled to fit whatever iframe we are in.

import {
  BIRD_R, BIRD_X, FIRST_PIPE_X, H, NAME_MAX_LENGTH, NEXT_PIPE_X, PIPE_SPEED, PIPE_W, SPAWN_TRIGGER_X, W, cleanName,
} from "./rules.js";
import { board, initScoreboard, qualifies, refreshBoard, submitScore } from "./scoreboard.js";

const GROUND_H = 40;
const FLOOR_Y = H - GROUND_H;

const GRAVITY = 900;
const FLAP_VELOCITY = -270;
const MAX_FALL_SPEED = 420;
const PIPE_GAP = 88;
const STEP = 1 / 120;

const COLORS = {
  sky: "#4ec0ca",
  cloud: "#e9fcd9",
  pipe: "#73bf2e",
  pipeDark: "#558022",
  pipeLight: "#9ce659",
  ground: "#ded895",
  groundTop: "#5ee270",
  groundStripe: "#d3c96f",
  bird: "#f8d81d",
  birdDark: "#e0802b",
  beak: "#f75b2c",
  outline: "#543847",
  white: "#ffffff",
  highlight: "#fcd34d",
  panel: "rgba(84, 56, 71, 0.55)",
};

type State = "ready" | "playing" | "dead";
type Pipe = { x: number; gapY: number; scored: boolean };

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const nameForm = document.getElementById("name-form") as HTMLFormElement;
const nameInput = document.getElementById("name-input") as HTMLInputElement;
const nameSkip = document.getElementById("name-skip") as HTMLButtonElement;
const nameStatus = document.getElementById("name-status") as HTMLElement;
const isPoster = new URLSearchParams(location.search).has("poster");

let state: State = "ready";
let birdY = H / 2 - 20;
let birdVy = 0;
let pipes: Pipe[] = [];
let score = 0;
let best = loadBest();
let groundOffset = 0;
let time = 0;
let deadAt = 0;
let playerName = loadName();
let askingName = false;

function loadBest(): number {
  try {
    return Number(localStorage.getItem("flappy-best")) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value: number): void {
  try {
    localStorage.setItem("flappy-best", String(value));
  } catch {
    // Storage can be blocked inside third-party iframes; best score just won't persist.
  }
}

function loadName(): string | null {
  try {
    return localStorage.getItem("flappy-name");
  } catch {
    return null;
  }
}

function saveName(value: string): void {
  try {
    localStorage.setItem("flappy-name", value);
  } catch {
    // Name just won't be prefilled next time.
  }
}

function reset(): void {
  state = "ready";
  birdY = H / 2 - 20;
  birdVy = 0;
  pipes = [];
  score = 0;
}

function spawnPipe(x: number): void {
  const margin = 40;
  const gapY = margin + PIPE_GAP / 2 + Math.random() * (FLOOR_Y - 2 * margin - PIPE_GAP);
  pipes.push({ x, gapY, scored: false });
}

function flap(): void {
  if (state === "ready") {
    state = "playing";
    spawnPipe(FIRST_PIPE_X);
  }
  if (state === "playing") {
    birdVy = FLAP_VELOCITY;
  } else if (state === "dead" && !askingName && time - deadAt > 0.6) {
    reset();
  }
}

function die(): void {
  state = "dead";
  deadAt = time;
  if (score > best) {
    best = score;
    saveBest(best);
  }
  if (qualifies(score, playerName)) openNameForm();
  else void refreshBoard();
}

function circleHitsRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number): boolean {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

function update(dt: number): void {
  time += dt;

  if (state !== "dead") {
    groundOffset = (groundOffset + PIPE_SPEED * dt) % 24;
  }

  if (state === "ready") {
    birdY = H / 2 - 20 + Math.sin(time * 6) * 4;
    return;
  }

  // Bird keeps falling after death until it hits the floor.
  birdVy = Math.min(birdVy + GRAVITY * dt, MAX_FALL_SPEED);
  birdY += birdVy * dt;
  if (birdY < BIRD_R) {
    birdY = BIRD_R;
    birdVy = 0;
  }
  if (birdY > FLOOR_Y - BIRD_R) {
    birdY = FLOOR_Y - BIRD_R;
    if (state === "playing") die();
    return;
  }
  if (state === "dead") return;

  for (const pipe of pipes) {
    pipe.x -= PIPE_SPEED * dt;
    if (!pipe.scored && pipe.x + PIPE_W < BIRD_X - BIRD_R) {
      pipe.scored = true;
      score++;
    }
    const top = pipe.gapY - PIPE_GAP / 2;
    const bottom = pipe.gapY + PIPE_GAP / 2;
    if (
      circleHitsRect(BIRD_X, birdY, BIRD_R - 1, pipe.x, -100, PIPE_W, top + 100) ||
      circleHitsRect(BIRD_X, birdY, BIRD_R - 1, pipe.x, bottom, PIPE_W, FLOOR_Y - bottom)
    ) {
      die();
      return;
    }
  }

  pipes = pipes.filter((p) => p.x + PIPE_W > -10);
  const last = pipes[pipes.length - 1];
  if (!last || last.x < SPAWN_TRIGGER_X) spawnPipe(NEXT_PIPE_X);
}

// ---------- drawing ----------

function drawBackground(): void {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = COLORS.cloud;
  const drift = state === "dead" ? 0 : (time * 8) % (W + 120);
  for (const [cx, cy, s] of [[40, 190, 1], [150, 205, 1.3], [250, 185, 0.9], [360, 200, 1.1]] as const) {
    const x = ((cx - drift + W + 120) % (W + 120)) - 60;
    ctx.beginPath();
    ctx.arc(x, cy, 18 * s, 0, Math.PI * 2);
    ctx.arc(x + 20 * s, cy + 6, 14 * s, 0, Math.PI * 2);
    ctx.arc(x - 20 * s, cy + 8, 12 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(0, 210, W, FLOOR_Y - 210);
}

function drawPipe(x: number, y: number, h: number, capAtBottom: boolean): void {
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(x - 1, y, PIPE_W + 2, h);
  ctx.fillStyle = COLORS.pipe;
  ctx.fillRect(x + 1, y, PIPE_W - 2, h);
  ctx.fillStyle = COLORS.pipeLight;
  ctx.fillRect(x + 4, y, 4, h);
  ctx.fillStyle = COLORS.pipeDark;
  ctx.fillRect(x + PIPE_W - 8, y, 5, h);

  const capH = 14;
  const capY = capAtBottom ? y + h - capH : y;
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(x - 4, capY - 1, PIPE_W + 8, capH + 2);
  ctx.fillStyle = COLORS.pipe;
  ctx.fillRect(x - 2, capY + 1, PIPE_W + 4, capH - 2);
  ctx.fillStyle = COLORS.pipeLight;
  ctx.fillRect(x + 1, capY + 1, 4, capH - 2);
  ctx.fillStyle = COLORS.pipeDark;
  ctx.fillRect(x + PIPE_W - 6, capY + 1, 5, capH - 2);
}

function drawPipes(): void {
  for (const pipe of pipes) {
    const top = pipe.gapY - PIPE_GAP / 2;
    const bottom = pipe.gapY + PIPE_GAP / 2;
    drawPipe(pipe.x, -2, top + 2, true);
    drawPipe(pipe.x, bottom, FLOOR_Y - bottom, false);
  }
}

function drawGround(): void {
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, FLOOR_Y, W, 2);
  ctx.fillStyle = COLORS.groundTop;
  ctx.fillRect(0, FLOOR_Y + 2, W, 8);
  ctx.fillStyle = COLORS.groundStripe;
  for (let x = -groundOffset; x < W; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_Y + 10);
    ctx.lineTo(x + 12, FLOOR_Y + 10);
    ctx.lineTo(x + 6, FLOOR_Y + 2);
    ctx.lineTo(x - 6, FLOOR_Y + 2);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, FLOOR_Y + 10, W, 2);
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, FLOOR_Y + 12, W, GROUND_H - 12);
}

function drawBird(y: number, vy: number, birdState: State): void {
  const tilt = birdState === "ready" ? 0 : Math.max(-0.45, Math.min(1.4, vy / 350));
  const wingUp = birdState !== "dead" && Math.floor(time * 10) % 2 === 0;

  ctx.save();
  ctx.translate(BIRD_X, y);
  ctx.rotate(tilt);
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.outline;

  // body
  ctx.fillStyle = COLORS.bird;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // belly
  ctx.fillStyle = COLORS.birdDark;
  ctx.beginPath();
  ctx.ellipse(1, 5, 7, 4, 0, 0, Math.PI);
  ctx.fill();

  // wing
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.ellipse(-6, wingUp ? -2 : 2, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // eye
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.arc(5, -4, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(6, -5, 2, 3);

  // beak
  ctx.fillStyle = COLORS.beak;
  ctx.beginPath();
  ctx.ellipse(11, 3, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function text(str: string, x: number, y: number, size: number): void {
  ctx.font = `900 ${size}px "Trebuchet MS", "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.strokeStyle = COLORS.outline;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = COLORS.white;
  ctx.fillText(str, x, y);
}

function drawOverlay(): void {
  if (state === "ready") {
    text("FLAPPY BIRD", W / 2, 62, 34);
    if (!isPoster && Math.floor(time * 2) % 2 === 0) text("click / tap / space", W / 2, 205, 14);
  } else if (state === "playing") {
    text(String(score), W / 2, 40, 32);
  } else {
    text("GAME OVER", W / 2, 38, 28);
    text(`score ${score}   best ${best}`, W / 2, 70, 15);
    drawBoard();
    if (!askingName && time - deadAt > 0.6) text("click to retry", W / 2, FLOOR_Y + 22, 13);
  }
}

function drawBoard(): void {
  const x = 50;
  const y = 88;
  const w = W - 100;
  const h = 150;
  ctx.fillStyle = COLORS.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();

  text("TOP 10", W / 2, y + 13, 13);
  if (board.status !== "ready" || board.top.length === 0) {
    const msg = board.status === "loading" ? "loading..." : board.status === "error" ? "scoreboard offline" : "no scores yet";
    text(msg, W / 2, y + h / 2 + 6, 11);
    return;
  }

  ctx.font = `700 10px system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  board.top.forEach((entry, i) => {
    const rowY = y + 32 + i * 11.5;
    const mine = playerName !== null && entry.name.toLowerCase() === playerName.toLowerCase();
    ctx.fillStyle = mine ? COLORS.highlight : COLORS.white;
    ctx.textAlign = "left";
    ctx.fillText(`${i + 1}.`, x + 12, rowY);
    ctx.fillText(entry.name, x + 32, rowY);
    ctx.textAlign = "right";
    ctx.fillText(String(entry.score), x + w - 12, rowY);
  });
}

function draw(): void {
  drawBackground();
  drawPipes();
  drawGround();
  drawBird(birdY, birdVy, state);
  drawOverlay();
}

// ---------- sizing, input, loop ----------

function resize(): void {
  const size = Math.floor(Math.min(window.innerWidth, window.innerHeight));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  ctx.setTransform((size * dpr) / W, 0, 0, (size * dpr) / H, 0, 0);
}

window.addEventListener("resize", resize);
resize();

// ---------- name entry for a top 10 score ----------

function openNameForm(): void {
  askingName = true;
  nameInput.value = playerName ?? "";
  nameStatus.textContent = "";
  nameForm.hidden = false;
  nameInput.focus();
}

function closeNameForm(): void {
  askingName = false;
  nameForm.hidden = true;
  canvas.focus();
}

nameInput.maxLength = NAME_MAX_LENGTH;
// Keep clicks and keys inside the form from flapping or restarting the game.
nameForm.addEventListener("pointerdown", (e) => e.stopPropagation());
nameForm.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Escape") closeNameForm();
});
nameSkip.addEventListener("click", closeNameForm);
nameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = cleanName(nameInput.value);
  if (!name) {
    nameStatus.textContent = "Letters, numbers, space, . _ - only";
    return;
  }
  nameStatus.textContent = "Saving...";
  playerName = name;
  saveName(name);
  const ok = await submitScore(name, score);
  if (ok) closeNameForm();
  else nameStatus.textContent = "Couldn't save score. Try again?";
});

// Inside the X iframe the page only gets keyboard events after the first click,
// so pointer input is the primary control and also grabs focus.
window.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  canvas.focus();
  flap();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    if (!e.repeat) flap();
  }
});

if (!isPoster) void initScoreboard();

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  // Clamp so a backgrounded tab doesn't simulate seconds of physics at once.
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
