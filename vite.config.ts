import { existsSync, readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { FEED_URL, POSTER_SIZES, type FeedPoster } from "./shared/poster.ts";

const FEED_FILE = new URL("./public/generated/feed.json", import.meta.url);

// Start downloading feed.json and the newest poster while the HTML is still parsing,
// instead of waiting for the script to run (the first poster is the LCP element).
function preloadFirstPoster(): Plugin {
  return {
    name: "preload-first-poster",
    transformIndexHtml() {
      if (!existsSync(FEED_FILE)) return [];
      const { posters } = JSON.parse(readFileSync(FEED_FILE, "utf8")) as { posters: FeedPoster[] };
      const first = posters[0];
      const tags: { tag: string; attrs: Record<string, string>; injectTo: "head" }[] = [
        { tag: "link", attrs: { rel: "preload", href: FEED_URL, as: "fetch", crossorigin: "anonymous" }, injectTo: "head" },
      ];
      if (first) {
        const variants = [...first.src].sort((a, b) => a.width - b.width);
        tags.push({
          tag: "link",
          attrs: {
            rel: "preload",
            as: "image",
            href: variants[variants.length - 1]!.url,
            imagesrcset: variants.map((v) => `${v.url} ${v.width}w`).join(", "),
            imagesizes: POSTER_SIZES,
            fetchpriority: "high",
          },
          injectTo: "head",
        });
      }
      return tags;
    },
  };
}

// The frontend lives in src/; ingest output in public/generated/ is served as static files.
export default defineConfig({
  root: "src",
  publicDir: "../public",
  plugins: [preloadFirstPoster()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
