// Talks to /api/token and /api/scores. Everything here fails soft: if the API
// is unreachable the game still plays, it just shows no board.

import { LEADERBOARD_SIZE } from "./rules.js";

export type Entry = { name: string; score: number };
export type Board = { status: "loading" | "ready" | "error"; top: Entry[] };

export const board: Board = { status: "loading", top: [] };
let token: string | null = null;

export async function initScoreboard(): Promise<void> {
  await Promise.all([fetchToken(), refreshBoard()]);
}

async function fetchToken(): Promise<void> {
  try {
    const res = await fetch("/api/token", { cache: "no-store" });
    if (res.ok) token = ((await res.json()) as { token: string }).token;
  } catch {
    // Without a token scores can't be submitted, but the board can still show.
  }
}

export async function refreshBoard(): Promise<void> {
  try {
    const res = await fetch("/api/scores");
    if (!res.ok) throw new Error(String(res.status));
    board.top = ((await res.json()) as { top: Entry[] }).top;
    board.status = "ready";
  } catch {
    if (board.status === "loading") board.status = "error";
  }
}

/** Whether `score` would make the current top 10 (and beat this name's existing entry). */
export function qualifies(score: number, name: string | null): boolean {
  if (score <= 0 || board.status !== "ready" || !token) return false;
  const mine = name && board.top.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (mine && mine.score >= score) return false;
  return board.top.length < LEADERBOARD_SIZE || score > board.top[board.top.length - 1].score;
}

export async function submitScore(name: string, score: number): Promise<boolean> {
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, score, token }),
    });
    if (!res.ok) return false;
    board.top = ((await res.json()) as { top: Entry[] }).top;
    board.status = "ready";
    return true;
  } catch {
    return false;
  }
}
