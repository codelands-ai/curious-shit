// PRD success criterion: searching any distinct word visible on a poster returns that poster for at least
// 90% of posters. Checks the words in data/search-check.json against the index the site actually ships
// (public/generated/search-index.json, written by npm run ingest).

import { readFileSync } from "node:fs";
import { loadSearch, runSearch } from "../shared/search.ts";

const TARGET = 0.9;
const root = new URL("..", import.meta.url).pathname;
const { posters: words } = JSON.parse(readFileSync(`${root}data/search-check.json`, "utf8")) as { posters: Record<string, string[]> };
const feed = JSON.parse(readFileSync(`${root}public/generated/feed.json`, "utf8")) as { posters: { id: string }[] };
const search = loadSearch(readFileSync(`${root}public/generated/search-index.json`, "utf8"));

const live = feed.posters.map((p) => p.id);
const unlisted = live.filter((id) => !words[id]);
let passing = 0;
let checked = 0;
for (const id of live) {
  const list = words[id];
  if (!list) continue;
  checked++;
  const misses = list.filter((w) => !runSearch(search, w).includes(id));
  if (misses.length === 0) passing++;
  console.log(`${misses.length === 0 ? "PASS" : "FAIL"}  ${id}  ${list.length - misses.length}/${list.length}${misses.length ? `  missing: ${misses.join(", ")}` : ""}`);
}

const share = checked ? passing / checked : 0;
console.log(`\n${passing}/${checked} posters found by every listed word (${(share * 100).toFixed(0)}%, target ${TARGET * 100}%)`);
if (unlisted.length) console.log(`Not yet in data/search-check.json: ${unlisted.join(", ")}`);
if (share < TARGET) process.exit(1);
