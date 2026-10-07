# Flappy Bird in Twitter

Flappy Bird that plays **inside a post on X**. You post a link, X shows a "video" thumbnail, and clicking it loads the live game inline.

## How it works

- **X Player Card.** `index.html` has `twitter:card=player` meta tags. X shows `public/poster.png` with a play button and, on click, loads `twitter:player` (this same page) in a 600×600 iframe.
- **Absolute URLs.** X requires absolute URLs in those tags. `vite.config.ts` replaces `%SITE_URL%` at build time with `SITE_URL`, or with Vercel's production domain if that isn't set.
- **Framing.** `vercel.json` sends `Content-Security-Policy: frame-ancestors` so x.com / twitter.com are allowed to embed the page.
- **The game.** `src/main.ts` draws everything on one canvas using a 300×300 logical world, scaled to fit the iframe. It uses a fixed-timestep physics loop and accepts click, tap, Space, ↑ or W. The best score is saved in `localStorage` when the browser allows it.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # typecheck + production build into dist/
```

## Deploy on Vercel

1. Import the repo into Vercel (the Vite preset is auto-detected; no settings needed).
2. Optional: set `SITE_URL` (e.g. `https://flappy.example.com`) if you use a custom domain.
3. Deploy, then post the root URL on X.

## Regenerating the poster

```bash
npm run dev
npx playwright install chromium   # once; or set CHROMIUM_PATH to an existing Chrome/Chromium
npm run poster
```

## Notes

- Test cards by posting from a throwaway or private account. X caches card metadata, so changes to the meta tags can take a while to show up.
- Desktop web renders player cards most reliably; the mobile apps may open the link in a browser instead.
