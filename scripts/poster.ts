// Renders public/poster.png: the image X shows (with its own play button on top)
// before someone clicks the card. Run `npm run dev` first, then `npm run poster`.
import { chromium } from "playwright-core";

const url = process.env.POSTER_URL ?? "http://localhost:5173/?poster";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 2 });
await page.goto(url);
await page.waitForTimeout(300);
await page.screenshot({ path: "public/poster.png" });
await browser.close();
console.log("wrote public/poster.png");
