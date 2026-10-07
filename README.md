# Flappy Bird in Twitter

Flappy Bird that plays **inside a post on X**. You post a link, X shows a "video" thumbnail, and clicking it loads the live game inline.

## How it works

- **X Player Card.** `index.html` has `twitter:card=player` meta tags. X shows `public/poster.png` with a play button and, on click, loads `twitter:player` (this same page) in a 600×600 iframe.
- **Absolute URLs.** X requires absolute URLs in those tags. `vite.config.ts` replaces `%SITE_URL%` at build time with `SITE_URL`, or with Vercel's production domain if that isn't set.
- **Framing.** `vercel.json` sends `Content-Security-Policy: frame-ancestors` so x.com / twitter.com are allowed to embed the page.
- **Scoreboard.** The top 10 shows on the game-over screen. A score that makes the board opens a name prompt. `api/scores` stores each name's best score in Postgres (Neon); reads are CDN-cached for 5s, and writes only happen for top 10 scores, so traffic stays tiny. To stop fake scores sent with curl, `api/token` hands each page load a signed timestamp, and a score is rejected if it couldn't have been reached in the time since (`minRunSeconds` in `src/rules.ts`). This blocks casual cheating; someone determined who waits long enough can still submit a fake score.
- **The game.** `src/main.ts` draws everything on one canvas using a 300×300 logical world, scaled to fit the iframe. It uses a fixed-timestep physics loop and accepts click, tap, Space, ↑ or W. The best score is saved in `localStorage` when the browser allows it.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173 (api/ routes served by Vite; scores kept in memory unless DATABASE_URL is set)
npm run build   # typecheck + production build into dist/
```

## Deploy on Vercel

1. Import the repo into Vercel (the Vite preset is auto-detected).
2. **Storage → Marketplace → Neon (Postgres)** → create a free database and connect it to the project. This sets `DATABASE_URL`; the `scores` table is created automatically on first request. Without it the scoreboard falls back to per-instance memory and will look empty or inconsistent.
3. Redeploy so the function picks up `DATABASE_URL`.
4. Optional: set `SITE_URL` if you use a custom domain, and `SCORE_SECRET` to sign tokens with a dedicated key (defaults to the database URL).
5. Post the root URL on X.

## Regenerating the poster

```bash
npm run dev
npx playwright install chromium   # once; or set CHROMIUM_PATH to an existing Chrome/Chromium
npm run poster
```

## Notes

- Test cards by posting from a throwaway or private account. X caches card metadata, so changes to the meta tags can take a while to show up.
- Desktop web renders player cards most reliably; the mobile apps may open the link in a browser instead.
