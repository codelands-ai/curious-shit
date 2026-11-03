import { existsSync, readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { cardHtml, posterPreloadAttrs, topicsHtml } from "./shared/card.ts";
import { FEED_URL, type FeedFile, type FeedPoster } from "./shared/poster.ts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./shared/site.ts";

const FEED_FILE = new URL("./public/generated/feed.json", import.meta.url);

function readFeedFile(): FeedFile {
  return existsSync(FEED_FILE) ? (JSON.parse(readFileSync(FEED_FILE, "utf8")) as FeedFile) : { posters: [], tags: [] };
}

function readFeed(): FeedPoster[] {
  return readFeedFile().posters;
}

// The newest poster is the LCP element. Write its card into the HTML so it paints without waiting
// for the script and feed.json, and preload the image and feed.json while the HTML parses.
function preloadFirstPoster(): Plugin {
  return {
    name: "preload-first-poster",
    transformIndexHtml(html, ctx) {
      if (!ctx.path.endsWith("/index.html") && ctx.path !== "/") return html;
      if (!existsSync(FEED_FILE)) return html;
      const first = readFeed()[0];
      const tags: { tag: string; attrs: Record<string, string>; injectTo: "head" }[] = [
        { tag: "link", attrs: { rel: "preload", href: FEED_URL, as: "fetch", crossorigin: "anonymous" }, injectTo: "head" },
      ];
      if (first) tags.push({ tag: "link", attrs: posterPreloadAttrs(first), injectTo: "head" });
      // A shared ?q= link replaces the feed with results, so the script removes this card there.
      const feedDiv = '<div id="feed" class="feed"></div>';
      if (!html.includes(feedDiv)) throw new Error("preload-first-poster: #feed container not found in index.html");
      let out = first ? html.replace(feedDiv, `<div id="feed" class="feed">${cardHtml(first, true)}</div>`) : html;
      // The topic row sits above the first poster, so it's in the HTML from the start (no layout shift).
      const topicsNav = '<nav id="topics" class="topics" aria-label="Topics"></nav>';
      if (!out.includes(topicsNav)) throw new Error("preload-first-poster: #topics nav not found in index.html");
      const topics = topicsHtml(readFeedFile().tags ?? []);
      out = out.replace(topicsNav, topics ? `<nav id="topics" class="topics" aria-label="Topics">${topics}</nav>` : "");
      return { html: out, tags };
    },
  };
}

// Description, icons and Open Graph tags for every page, from shared/site.ts.
function pageMeta(): Plugin {
  return {
    name: "page-meta",
    transformIndexHtml(html, ctx) {
      const path = ctx.path === "/index.html" ? "/" : ctx.path.replace(/\.html$/, "");
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? SITE_NAME;
      const meta = (attrs: Record<string, string>) => ({ tag: "meta", attrs, injectTo: "head" as const });
      const link = (attrs: Record<string, string>) => ({ tag: "link", attrs, injectTo: "head" as const });
      const notFound = ctx.path.endsWith("/404.html");
      return [
        meta({ name: "description", content: SITE_DESCRIPTION }),
        meta({ name: "theme-color", content: "#121110" }),
        link({ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }),
        link({ rel: "apple-touch-icon", href: "/apple-touch-icon.png" }),
        ...(notFound ? [] : [link({ rel: "canonical", href: `${SITE_URL}${path}` })]),
        meta({ property: "og:site_name", content: SITE_NAME }),
        meta({ property: "og:type", content: "website" }),
        meta({ property: "og:title", content: title }),
        meta({ property: "og:description", content: SITE_DESCRIPTION }),
        meta({ property: "og:url", content: `${SITE_URL}${path}` }),
        // The newest poster's preview; permalink pages swap in their own (scripts/permalinks.ts).
        ...(readFeed()[0] ? [meta({ property: "og:image", content: `${SITE_URL}${readFeed()[0]!.og}` })] : []),
        meta({ property: "og:image:width", content: "1200" }),
        meta({ property: "og:image:height", content: "630" }),
        meta({ name: "twitter:card", content: "summary_large_image" }),
      ];
    },
  };
}

// The frontend lives in src/; ingest output in public/generated/ is served as static files.
export default defineConfig({
  root: "src",
  publicDir: "../public",
  plugins: [preloadFirstPoster(), pageMeta()],
  // `npm run dev:api` serves the reactions Worker and a local D1 on 8787.
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: new URL("./src/index.html", import.meta.url).pathname,
        privacy: new URL("./src/privacy.html", import.meta.url).pathname,
        notFound: new URL("./src/404.html", import.meta.url).pathname,
      },
    },
  },
});
