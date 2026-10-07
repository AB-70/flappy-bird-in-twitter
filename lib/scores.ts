import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { LEADERBOARD_SIZE, cleanName, minRunSeconds } from "../src/rules.js";

// Shared by the Vercel functions in api/ and the Vite dev server middleware.

export type Entry = { name: string; score: number };

/** Tokens older than this can't be used to submit scores. */
const TOKEN_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Slack for timer differences between the browser and the server. */
const TIMING_TOLERANCE = 0.9;

interface ScoreStore {
  top(): Promise<Entry[]>;
  /** Records `score` for `name`, keeping only that name's best. */
  submit(entry: Entry): Promise<void>;
}

class MemoryStore implements ScoreStore {
  private best = new Map<string, Entry>();

  async top(): Promise<Entry[]> {
    return [...this.best.values()].sort((a, b) => b.score - a.score).slice(0, LEADERBOARD_SIZE);
  }

  async submit(entry: Entry): Promise<void> {
    const key = entry.name.toLowerCase();
    const existing = this.best.get(key);
    if (!existing || entry.score > existing.score) this.best.set(key, entry);
  }
}

class PostgresStore implements ScoreStore {
  private sql;
  private ready: Promise<unknown> | null = null;

  constructor(url: string) {
    this.sql = neon(url);
  }

  private init(): Promise<unknown> {
    this.ready ??= this.sql`
      CREATE TABLE IF NOT EXISTS scores (
        name_key   text PRIMARY KEY,
        name       text NOT NULL,
        score      integer NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`.then(() => this.sql`CREATE INDEX IF NOT EXISTS scores_score_idx ON scores (score DESC)`);
    return this.ready;
  }

  async top(): Promise<Entry[]> {
    await this.init();
    const rows = await this.sql`SELECT name, score FROM scores ORDER BY score DESC, updated_at ASC LIMIT ${LEADERBOARD_SIZE}`;
    return rows as Entry[];
  }

  async submit({ name, score }: Entry): Promise<void> {
    await this.init();
    await this.sql`
      INSERT INTO scores (name_key, name, score) VALUES (${name.toLowerCase()}, ${name}, ${score})
      ON CONFLICT (name_key) DO UPDATE
        SET name = EXCLUDED.name, score = EXCLUDED.score, updated_at = now()
        WHERE scores.score < EXCLUDED.score`;
  }
}

// Vercel's Neon integration sets DATABASE_URL (and POSTGRES_URL on older setups).
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const store: ScoreStore = databaseUrl ? new PostgresStore(databaseUrl) : new MemoryStore();

// The database URL is already a secret, so it doubles as the signing key unless one is set.
const secret = process.env.SCORE_SECRET ?? databaseUrl ?? "local-dev-secret";

function sign(payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** A token recording when this page load started; scores must fit inside that time. */
export function issueToken(now = Date.now()): string {
  const payload = String(now);
  return `${payload}.${sign(payload)}`;
}

function tokenIssuedAt(token: unknown, now: number): number | null {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const issuedAt = Number(payload);
  if (!Number.isFinite(issuedAt) || now - issuedAt > TOKEN_MAX_AGE_MS || issuedAt > now) return null;
  return issuedAt;
}

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, init);

export async function handleTokenRequest(): Promise<Response> {
  return json({ token: issueToken() }, { headers: { "Cache-Control": "no-store" } });
}

export async function handleScoresRequest(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") {
      // Short CDN cache: the board is read on every game over but rarely changes.
      return json({ top: await store.top() }, { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" } });
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const name = cleanName(body.name);
    if (!name) return new Response("Invalid name", { status: 400 });
    const score = body.score;
    if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 100_000) {
      return new Response("Invalid score", { status: 400 });
    }

    const now = Date.now();
    const issuedAt = tokenIssuedAt(body.token, now);
    if (issuedAt === null) return new Response("Invalid or expired token", { status: 403 });
    if ((now - issuedAt) / 1000 < minRunSeconds(score) * TIMING_TOLERANCE) {
      return new Response("Score not possible in the time played", { status: 403 });
    }

    await store.submit({ name, score });
    return json({ top: await store.top() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("scores request failed", err);
    return new Response("Scoreboard unavailable", { status: 503 });
  }
}
