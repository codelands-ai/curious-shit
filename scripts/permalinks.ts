// After `vite build`: one static page per poster at dist/p/<id>.html (served at /p/<id>), plus sitemap.xml
// and robots.txt. Each page is the built gallery with that poster's title, link-preview tags, canonical
// address, pre-rendered card and image preload, so link previews work without JavaScript and the poster
// paints as fast as on the home page. Run by `npm run build` and `npm run deploy`.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { attrsHtml, cardHtml, escape, posterPreloadAttrs } from "../shared/card.ts";
import type { FeedPoster } from "../shared/poster.ts";
import { SITE_NAME, SITE_URL, permalinkPath } from "../shared/site.ts";

const DIST = new URL("../dist/", import.meta.url).pathname;

const template = await readFile(join(DIST, "index.html"), "utf8");
const { posters } = JSON.parse(await readFile(join(DIST, "generated/feed.json"), "utf8")) as { posters: FeedPoster[] };

/** Replace exactly one match, so a change to the template can't silently produce broken pages. */
function swap(html: string, pattern: RegExp, replacement: string, what: string): string {
  const matches = html.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`));
  if (matches?.length !== 1) throw new Error(`permalinks: expected one ${what} in dist/index.html, found ${matches?.length ?? 0}`);
  return html.replace(pattern, () => replacement);
}

function page(poster: FeedPoster): string {
  const url = `${SITE_URL}${permalinkPath(poster.id)}`;
  const title = `${poster.title} · ${SITE_NAME}`;
  let html = template;
  html = swap(html, /<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`, "<title>");
  html = swap(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escape(title)}">`, "og:title");
  html = swap(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escape(url)}">`, "og:url");
  html = swap(html, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escape(SITE_URL + poster.og)}">`, "og:image");
  html = swap(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escape(url)}">`, "canonical");
  if (poster.description) {
    html = swap(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${escape(poster.description)}">`, "description");
    html = swap(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escape(poster.description)}">`, "og:description");
  }
  html = swap(html, /<link [^>]*data-poster-preload[^>]*>/, `<link ${attrsHtml(posterPreloadAttrs(poster))}>`, "poster preload");
  html = swap(html, /<div id="feed" class="feed"><figure[\s\S]*?<\/figure><\/div>/, `<div id="feed" class="feed">${cardHtml(poster, true)}</div>`, "pre-rendered card");
  return html;
}

await rm(join(DIST, "p"), { recursive: true, force: true });
await mkdir(join(DIST, "p"), { recursive: true });
for (const poster of posters) await writeFile(join(DIST, "p", `${poster.id}.html`), page(poster));

const urls = [`${SITE_URL}/`, ...posters.map((p) => `${SITE_URL}${permalinkPath(p.id)}`)];
await writeFile(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    posters.map((p) => `  <url><loc>${escape(`${SITE_URL}${permalinkPath(p.id)}`)}</loc><lastmod>${p.added_at.slice(0, 10)}</lastmod></url>`).join("\n") +
    `\n  <url><loc>${SITE_URL}/</loc></url>\n</urlset>\n`,
);
await writeFile(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Permalinks: ${posters.length} poster pages, sitemap with ${urls.length} URLs`);
