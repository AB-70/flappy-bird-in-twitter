import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { handleScoresRequest, handleTokenRequest } from "./lib/scores.js";

// X needs absolute URLs in the card meta tags. On Vercel the production
// domain is provided automatically; SITE_URL overrides it (e.g. a custom domain).
function siteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:5173";
}

const injectSiteUrl = (): Plugin => ({
  name: "inject-site-url",
  transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", siteUrl()),
});

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request("http://localhost/api", {
    method: req.method,
    headers: { "content-type": req.headers["content-type"] ?? "application/json" },
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}

// Serves the api/ routes during `vite dev` (in-memory scores unless DATABASE_URL is set),
// so the scoreboard works locally without `vercel dev`.
const devApi = (): Plugin => ({
  name: "dev-api",
  configureServer(server) {
    server.middlewares.use("/api/token", async (_req, res) => send(res, await handleTokenRequest()));
    server.middlewares.use("/api/scores", async (req, res) => send(res, await handleScoresRequest(await toRequest(req))));
  },
});

export default defineConfig({
  plugins: [injectSiteUrl(), devApi()],
});
