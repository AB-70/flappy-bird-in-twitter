// Game tuning shared by the browser game and the score API, which uses it to
// reject scores that could not have been reached in the time a player had.

export const W = 300;
export const H = 300;
export const PIPE_SPEED = 90;
export const PIPE_W = 40;
export const BIRD_X = 80;
export const BIRD_R = 10;
/** x where the first pipe appears when a run starts. */
export const FIRST_PIPE_X = W + 40;
/** x where each later pipe appears. */
export const NEXT_PIPE_X = W + 10;
/** A new pipe spawns once the previous one has scrolled left of this x. */
export const SPAWN_TRIGGER_X = W - 155;

export const LEADERBOARD_SIZE = 10;
export const NAME_MAX_LENGTH = 12;

/** Fastest possible time, in seconds, to pass `score` pipes. */
export function minRunSeconds(score: number): number {
  if (score <= 0) return 0;
  const scoreLine = BIRD_X - BIRD_R - PIPE_W;
  const firstPipe = (FIRST_PIPE_X - scoreLine) / PIPE_SPEED;
  const perPipe = (NEXT_PIPE_X - SPAWN_TRIGGER_X) / PIPE_SPEED;
  return firstPipe + (score - 1) * perPipe;
}

/** Trims and validates a display name; returns null if it isn't usable. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > NAME_MAX_LENGTH) return null;
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name)) return null;
  return name;
}
