// Search speed check: 1,000 synthetic posters with 5,000 characters of text each.
// Every query must finish under the PRD's 200ms target. Run with `npm run bench:search`.

import { gzipSync } from "node:zlib";
import type { IndexPoster } from "../shared/poster.ts";
import { buildSearch, loadSearch, runSearch } from "../shared/search.ts";

const POSTERS = 1000;
const CHARS = 5000;
const TARGET_MS = 200;
const RUNS = 20;

// Deterministic pseudo-random words, so every run benchmarks the same data.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const letters = "abcdefghijklmnopqrstuvwxyz";
const word = () => Array.from({ length: 3 + Math.floor(rand() * 9) }, () => letters[Math.floor(rand() * 26)]).join("");
const vocab = Array.from({ length: 30000 }, word);
// Zipf-like: early vocabulary words are much more common, like real text.
const pick = () => vocab[Math.floor(vocab.length * rand() ** 3)]!;

const posters: IndexPoster[] = Array.from({ length: POSTERS }, (_, i) => {
  let text = "";
  while (text.length < CHARS) text += pick() + " ";
  const titleWords = [pick(), pick(), pick()];
  return {
    id: `poster-${i}`,
    title: titleWords.join(" "),
    alt: titleWords.join(" "),
    tags: [],
    keywords: titleWords,
    ocr_text: text.slice(0, CHARS).trim(),
    src: [{ width: 800, url: `/generated/posters/poster-${i}-800.webp` }],
    avif: [{ width: 800, url: `/generated/posters/poster-${i}-800.avif` }],
    og: `/generated/og/poster-${i}.jpg`,
    zoom: { width: 800, webp: `/generated/posters/poster-${i}-800.webp`, avif: `/generated/posters/poster-${i}-800.avif` },
    width: 1600,
    height: 1000,
    added_at: new Date(2026, 0, 1 + i).toISOString(),
  };
});

const json = JSON.stringify({ posters });
const t0 = performance.now();
const built = buildSearch(posters);
const buildMs = performance.now() - t0;
// What the browser does: load the index ingest pre-built.
const serialized = JSON.stringify(built);
const t1 = performance.now();
const search = loadSearch(serialized);
const loadMs = performance.now() - t1;

const common = vocab[0]!;
const rare = vocab[vocab.length - 1]!;
const typo = (w: string) => w.slice(0, 2) + (w[2] === "x" ? "y" : "x") + w.slice(3);
const longWord = vocab.find((w) => w.length >= 8)!;
const queries: Record<string, string> = {
  "common word": common,
  "rare word": rare,
  "prefix (3 letters)": common.slice(0, 3),
  "typo": typo(longWord),
  "two words": `${vocab[1]} ${vocab[2]}`,
  "four words": vocab.slice(3, 7).join(" "),
  "no match": "zzzzqqqq",
  "100 characters": Array.from({ length: 12 }, (_, i) => vocab[i]).join(" ").slice(0, 100),
};

console.log(`${POSTERS} posters, index.json ${(json.length / 1e6).toFixed(1)} MB (${(gzipSync(json).length / 1e6).toFixed(1)} MB gzipped)`);
console.log(`build index: ${buildMs.toFixed(0)}ms (done once by ingest)`);
console.log(`load pre-built index: ${loadMs.toFixed(0)}ms (${(serialized.length / 1e6).toFixed(1)} MB; what the browser does on first search)\n`);

let worst = 0;
for (const [label, q] of Object.entries(queries)) {
  const times: number[] = [];
  let hits = 0;
  for (let i = 0; i < RUNS; i++) {
    const s = performance.now();
    hits = runSearch(search, q).length;
    times.push(performance.now() - s);
  }
  times.sort((a, b) => a - b);
  const max = times[times.length - 1]!;
  worst = Math.max(worst, max);
  console.log(`${label.padEnd(20)} median ${times[RUNS >> 1]!.toFixed(1).padStart(6)}ms  max ${max.toFixed(1).padStart(6)}ms  ${hits} results`);
}

console.log(`\nslowest search: ${worst.toFixed(1)}ms (target ${TARGET_MS}ms)`);
if (worst >= TARGET_MS) {
  console.error("FAIL: a search took longer than the target");
  process.exit(1);
}
console.log("PASS");
