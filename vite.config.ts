import { defineConfig, type Plugin } from "vite";

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

export default defineConfig({
  plugins: [injectSiteUrl()],
});
