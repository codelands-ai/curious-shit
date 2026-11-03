import { existsSync, readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { cardHtml, srcset } from "./shared/card.ts";
import { FEED_URL, POSTER_SIZES, type FeedPoster } from "./shared/poster.ts";

const FEED_FILE = new URL("./public/generated/feed.json", import.meta.url);

// The newest poster is the LCP element. Write its card into the HTML so it paints without waiting
// for the script and feed.json, and preload the image and feed.json while the HTML parses.
function preloadFirstPoster(): Plugin {
  return {
    name: "preload-first-poster",
    transformIndexHtml(html, ctx) {
      if (!ctx.path.endsWith("/index.html") && ctx.path !== "/") return html;
      if (!existsSync(FEED_FILE)) return html;
      const { posters } = JSON.parse(readFileSync(FEED_FILE, "utf8")) as { posters: FeedPoster[] };
      const first = posters[0];
      const tags: { tag: string; attrs: Record<string, string>; injectTo: "head" }[] = [
        { tag: "link", attrs: { rel: "preload", href: FEED_URL, as: "fetch", crossorigin: "anonymous" }, injectTo: "head" },
      ];
      if (first) {
        // Preload the format the <picture> will pick: AVIF if there is one (browsers without AVIF skip a
        // typed preload), otherwise WebP.
        const variants = [...(first.avif?.length ? first.avif : first.src)].sort((a, b) => a.width - b.width);
        tags.push({
          tag: "link",
          attrs: {
            rel: "preload",
            as: "image",
            ...(first.avif?.length ? { type: "image/avif" } : {}),
            href: variants[variants.length - 1]!.url,
            imagesrcset: srcset(variants),
            imagesizes: POSTER_SIZES,
            fetchpriority: "high",
          },
          injectTo: "head",
        });
      }
      // A shared ?q= link replaces the feed with results, so the script removes this card there.
      const feedDiv = '<div id="feed" class="feed"></div>';
      if (!html.includes(feedDiv)) throw new Error("preload-first-poster: #feed container not found in index.html");
      return { html: first ? html.replace(feedDiv, `<div id="feed" class="feed">${cardHtml(first, true)}</div>`) : html, tags };
    },
  };
}

// The frontend lives in src/; ingest output in public/generated/ is served as static files.
export default defineConfig({
  root: "src",
  publicDir: "../public",
  plugins: [preloadFirstPoster()],
  // `npm run dev:api` serves the reactions Worker and a local D1 on 8787.
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: new URL("./src/index.html", import.meta.url).pathname,
        privacy: new URL("./src/privacy.html", import.meta.url).pathname,
      },
    },
  },
});
