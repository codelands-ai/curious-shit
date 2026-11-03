// Build pipeline: posters/ -> data/manifest.json, WebP variants and the search index.
// Run with `npm run ingest`. Steps are numbered as in .claude/00-mission-control.md (phase 1).

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import type { FeedPoster, IndexPoster } from "../shared/poster.ts";
import { buildSearch } from "../shared/search.ts";

const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const POSTERS_DIR = join(ROOT, "posters");
const MANIFEST_PATH = join(ROOT, "data/manifest.json");
// Bump OCR_VERSION when the OCR method changes, so every poster is read again.
// v2 (phase 7): paragraph mode plus sparse-text mode, which catches map labels and scattered words.
const OCR_VERSION = "v2";
const OCR_CACHE_DIR = join(ROOT, ".cache/ocr", OCR_VERSION);
const GENERATED_DIR = join(ROOT, "public/generated");
const IMAGES_DIR = join(GENERATED_DIR, "posters");
const INDEX_PATH = join(GENERATED_DIR, "index.json");
const FEED_PATH = join(GENERATED_DIR, "feed.json");
const SEARCH_INDEX_PATH = join(GENERATED_DIR, "search-index.json");
const IMAGES_URL = "/generated/posters";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIN_ASPECT = 1.2;
const WIDTHS = [800, 1600, 2400];
const WEBP_QUALITY = 80;
// AVIF q50 matches WebP q80 for poster text at about 55% of the bytes (phase 7 measurement).
const AVIF_QUALITY = 50;
const AVIF_EFFORT = 4;
const OCR_MIN_WIDTH = 3000;
const OCR_MAX_CHARS = 5000;
const TITLE_MAX_CHARS = 80;
const STOP_WORDS = new Set(
  "a an and are as at be by for from in into is it its of on or the to vs versus with".split(" "),
);

interface ManifestEntry {
  id: string;
  file: string;
  hash: string;
  added_at: string;
  removed?: true;
}

interface Manifest {
  posters: ManifestEntry[];
}

interface ScannedFile {
  file: string;
  hash: string;
  width: number;
  height: number;
}

type PosterRecord = IndexPoster;

const counts = {
  new: 0,
  renamed: 0,
  replaced: 0,
  restored: 0,
  removed: 0,
  unchanged: 0,
  ocrCorrection: 0,
  ocrCached: 0,
  ocrTesseract: 0,
  imagesWritten: 0,
};

async function main(): Promise<void> {
  const started = Date.now();
  await checkTesseract();

  // 1.1 Scan and 1.2 Validate: read everything before writing anything.
  const scanned = await scan();
  const tooNarrow = scanned.filter((s) => s.width / s.height < MIN_ASPECT);
  if (tooNarrow.length > 0) {
    const lines = tooNarrow.map(
      (s) => `  ${s.file}: ${s.width}×${s.height} (aspect ${(s.width / s.height).toFixed(2)})`,
    );
    fail(`These images have an aspect ratio below ${MIN_ASPECT} and can't be published:\n${lines.join("\n")}`);
  }

  // 1.3 Identify and 1.4 Retire.
  const manifest = await readManifest();
  const live = identify(manifest, scanned);

  // 1.5–1.7 for each live poster.
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(OCR_CACHE_DIR, { recursive: true });
  const records = await mapPool(live, availableParallelism(), async ({ entry, scan: s }) => {
    const [ocr_text, { src, avif }] = await Promise.all([ocrText(s), writeVariants(entry.id, s)]);
    const words = filenameWords(s.file);
    return {
      id: entry.id,
      title: makeTitle(words),
      keywords: makeKeywords(words),
      ocr_text,
      src,
      avif,
      width: s.width,
      height: s.height,
      added_at: entry.added_at,
    } satisfies PosterRecord;
  });
  await removeStaleImages(records);

  // 1.8 Index, newest first.
  records.sort((a, b) => b.added_at.localeCompare(a.added_at) || a.id.localeCompare(b.id));
  manifest.posters.sort((a, b) => a.added_at.localeCompare(b.added_at) || a.id.localeCompare(b.id));
  const manifestChanged = await writeIfChanged(MANIFEST_PATH, json(manifest));
  const indexChanged = await writeIfChanged(INDEX_PATH, json({ posters: records }));
  const feed = records.map(
    ({ id, title, src, avif, width, height, added_at }): FeedPoster => ({ id, title, src, avif, width, height, added_at }),
  );
  const feedChanged = await writeIfChanged(FEED_PATH, json({ posters: feed }));
  await writeIfChanged(SEARCH_INDEX_PATH, JSON.stringify(buildSearch(records)));

  // 1.9 Report.
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    [
      `Ingested ${records.length} posters in ${seconds}s`,
      `  new ${counts.new} · renamed ${counts.renamed} · replaced ${counts.replaced} · restored ${counts.restored} · removed ${counts.removed} · unchanged ${counts.unchanged}`,
      `  OCR: ${counts.ocrCorrection} from correction files · ${counts.ocrCached} cached · ${counts.ocrTesseract} run`,
      `  images written: ${counts.imagesWritten}`,
      `  manifest ${manifestChanged ? "updated" : "unchanged"} · index ${indexChanged ? "updated" : "unchanged"} · feed ${feedChanged ? "updated" : "unchanged"}`,
    ].join("\n"),
  );
}

// ---------- 1.1 Scan ----------

async function scan(): Promise<ScannedFile[]> {
  const names = (await readdir(POSTERS_DIR)).filter((n) => IMAGE_EXTENSIONS.has(extname(n).toLowerCase()));
  names.sort();
  return Promise.all(
    names.map(async (file) => {
      const buffer = await readFile(join(POSTERS_DIR, file));
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height) fail(`Can't read the dimensions of ${file}`);
      // EXIF orientations 5–8 are rotated 90°, so the displayed width is the stored height.
      const rotated = (meta.orientation ?? 1) >= 5;
      return {
        file,
        hash: createHash("sha256").update(buffer).digest("hex"),
        width: rotated ? meta.height : meta.width,
        height: rotated ? meta.width : meta.height,
      };
    }),
  );
}

// ---------- 1.3 Identify, 1.4 Retire ----------

function identify(manifest: Manifest, scanned: ScannedFile[]): { entry: ManifestEntry; scan: ScannedFile }[] {
  const now = new Date().toISOString();
  const claimed = new Set<ManifestEntry>();
  const matched = new Map<ScannedFile, ManifestEntry>();
  const byFile = new Map(manifest.posters.map((e) => [e.file, e]));

  // Same filename: the same poster, even if its contents were edited.
  for (const s of scanned) {
    const entry = byFile.get(s.file);
    if (!entry) continue;
    claimed.add(entry);
    matched.set(s, entry);
    if (entry.removed) {
      delete entry.removed;
      counts.restored++;
    } else if (entry.hash !== s.hash) {
      counts.replaced++;
    } else {
      counts.unchanged++;
    }
    entry.hash = s.hash;
  }

  // Same contents under a new filename: a rename (or a removed poster coming back), so the ID is kept.
  for (const s of scanned) {
    if (matched.has(s)) continue;
    const entry = manifest.posters.find((e) => !claimed.has(e) && e.hash === s.hash);
    if (!entry) continue;
    claimed.add(entry);
    matched.set(s, entry);
    if (entry.removed) {
      delete entry.removed;
      counts.restored++;
    } else {
      counts.renamed++;
    }
    entry.file = s.file;
  }

  // Anything else is new.
  const ids = new Set(manifest.posters.map((e) => e.id));
  for (const s of scanned) {
    if (matched.has(s)) continue;
    const entry: ManifestEntry = { id: uniqueId(slugify(stem(s.file)), ids), file: s.file, hash: s.hash, added_at: now };
    ids.add(entry.id);
    manifest.posters.push(entry);
    claimed.add(entry);
    matched.set(s, entry);
    counts.new++;
  }

  // Entries whose file is gone are retired, never deleted, so their IDs are never reused.
  for (const entry of manifest.posters) {
    if (!claimed.has(entry) && !entry.removed) {
      entry.removed = true;
      counts.removed++;
    }
  }

  return scanned.map((s) => ({ entry: matched.get(s)!, scan: s }));
}

function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "poster";
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ---------- 1.5 OCR ----------

async function ocrText(s: ScannedFile): Promise<string> {
  const correction = join(POSTERS_DIR, `${stem(s.file)}.ocr.txt`);
  if (await exists(correction)) {
    counts.ocrCorrection++;
    return cleanText(await readFile(correction, "utf8"));
  }

  const cached = join(OCR_CACHE_DIR, `${s.hash}.txt`);
  if (await exists(cached)) {
    counts.ocrCached++;
    return readFile(cached, "utf8");
  }

  // Poster text is often small, so OCR a grayscale copy at least OCR_MIN_WIDTH wide.
  const dir = await mkdtemp(join(tmpdir(), "curious-ocr-"));
  try {
    const png = join(dir, "page.png");
    await sharp(join(POSTERS_DIR, s.file))
      .rotate()
      .grayscale()
      .resize({ width: Math.max(s.width, OCR_MIN_WIDTH) })
      .png()
      .toFile(png);
    const tesseract = (psm: string) =>
      run("tesseract", [png, "stdout", "-l", "eng", "--psm", psm], {
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, OMP_THREAD_LIMIT: "1" },
      }).then((r) => r.stdout);
    // Paragraph mode (3) reads body text in order; sparse mode (11) finds labels on maps and diagrams.
    const [paragraphs, sparse] = await Promise.all([tesseract("3"), tesseract("11")]);
    const text = cleanText(mergeOcr(paragraphs, sparse));
    await writeFile(cached, text);
    counts.ocrTesseract++;
    return text;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The paragraph text, followed by any words only sparse mode found (so the 5,000-character cap keeps the prose). */
function mergeOcr(paragraphs: string, sparse: string): string {
  const key = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const seen = new Set(paragraphs.split(/\s+/).map(key).filter(Boolean));
  const extra: string[] = [];
  for (const token of sparse.split(/\s+/)) {
    const k = key(token);
    if (k && !seen.has(k)) {
      seen.add(k);
      extra.push(token);
    }
  }
  return `${paragraphs} ${extra.join(" ")}`;
}

function cleanText(raw: string): string {
  const tokens = raw.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t));
  let text = tokens.join(" ");
  if (text.length > OCR_MAX_CHARS) {
    text = text.slice(0, OCR_MAX_CHARS);
    const lastSpace = text.lastIndexOf(" ");
    if (lastSpace > 0) text = text.slice(0, lastSpace);
  }
  return text;
}

// ---------- 1.6 Title and keywords ----------

function filenameWords(file: string): string[] {
  return stem(file)
    .split(/[-_\s]+/)
    .filter(Boolean);
}

function makeTitle(words: string[]): string {
  let title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  if (title.length > TITLE_MAX_CHARS) {
    title = title.slice(0, TITLE_MAX_CHARS);
    const lastSpace = title.lastIndexOf(" ");
    if (lastSpace > 0) title = title.slice(0, lastSpace);
  }
  return title;
}

function makeKeywords(words: string[]): string[] {
  const lower = words.map((w) => w.toLowerCase()).filter((w) => !STOP_WORDS.has(w));
  return [...new Set(lower)];
}

// ---------- 1.7 Images ----------

// File names include a short content hash, so a replaced poster gets new URLs and the
// old ones can be cached forever.
async function writeVariants(id: string, s: ScannedFile): Promise<Pick<PosterRecord, "src" | "avif">> {
  // Standard widths below the original, plus the original itself when it's under the largest
  // standard width, so the sharpest version is never thrown away (and nothing is upscaled).
  const widths = WIDTHS.filter((w) => w < s.width);
  if (s.width <= WIDTHS[WIDTHS.length - 1]!) widths.push(s.width);
  const short = s.hash.slice(0, 8);
  const write = (format: "webp" | "avif") =>
    Promise.all(
      widths.map(async (width) => {
        const name = `${id}-${short}-${width}.${format}`;
        const out = join(IMAGES_DIR, name);
        if (!(await exists(out))) {
          const resized = sharp(join(POSTERS_DIR, s.file)).rotate().resize({ width });
          await (format === "webp"
            ? resized.webp({ quality: WEBP_QUALITY })
            : resized.avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
          ).toFile(out);
          counts.imagesWritten++;
        }
        return { width, url: `${IMAGES_URL}/${name}` };
      }),
    );
  const [src, avif] = await Promise.all([write("webp"), write("avif")]);
  return { src, avif };
}

async function removeStaleImages(records: PosterRecord[]): Promise<void> {
  const keep = new Set(records.flatMap((r) => [...r.src, ...r.avif].map((v) => basename(v.url))));
  for (const name of await readdir(IMAGES_DIR)) {
    if (!keep.has(name)) await rm(join(IMAGES_DIR, name));
  }
}

// ---------- Helpers ----------

async function checkTesseract(): Promise<void> {
  try {
    await run("tesseract", ["--version"]);
  } catch {
    fail("Tesseract isn't installed or isn't on PATH. Install it with: sudo apt install -y tesseract-ocr");
  }
}

async function readManifest(): Promise<Manifest> {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Manifest;
    if (!Array.isArray(manifest.posters)) throw new Error("missing posters array");
    return manifest;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { posters: [] };
    fail(`Can't read ${MANIFEST_PATH}: ${(err as Error).message}`);
  }
}

async function writeIfChanged(path: string, content: string): Promise<boolean> {
  const current = await readFile(path, "utf8").catch(() => null);
  if (current === content) return false;
  await writeFile(path, content);
  return true;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function stem(file: string): string {
  return basename(file, extname(file));
}

function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

function fail(message: string): never {
  console.error(`ingest failed: ${message}`);
  process.exit(1);
}

await main();
