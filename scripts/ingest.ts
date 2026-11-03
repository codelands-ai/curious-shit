// Build pipeline: posters/ -> data/manifest.json, WebP variants and the search index.
// Run with `npm run ingest`. Steps are numbered as in .claude/00-mission-control.md (phase 1).

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { parse as parseYaml } from "yaml";
import type { FeedFile, FeedPoster, IndexPoster, Tag } from "../shared/poster.ts";
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
const OG_DIR = join(GENERATED_DIR, "og");
const OG_URL = "/generated/og";
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
const ALT_MAX_CHARS = 125;
const DESCRIPTION_MAX_CHARS = 200;
const TAGS_PATH = join(ROOT, "data/tags.yml");
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

  // Sidecar metadata (phase 9): every file checked before anything is written.
  const tagList = await readTagList();
  const sidecars = new Map<string, Sidecar>();
  const sidecarErrors: string[] = [];
  for (const s of scanned) {
    const result = await readSidecar(s.file, tagList);
    if (typeof result === "string") sidecarErrors.push(result);
    else if (result) sidecars.set(s.file, result);
  }
  sidecarErrors.push(...(await strayFiles(scanned)));
  if (sidecarErrors.length > 0) fail(`Fix these poster metadata files:\n${sidecarErrors.join("\n")}`);

  // 1.3 Identify and 1.4 Retire.
  const manifest = await readManifest();
  const live = identify(manifest, scanned);

  // 1.5–1.7 for each live poster.
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(OG_DIR, { recursive: true });
  await mkdir(OCR_CACHE_DIR, { recursive: true });
  const records = await mapPool(live, availableParallelism(), async ({ entry, scan: s }) => {
    const [ocr_text, { src, avif }, og] = await Promise.all([ocrText(s), writeVariants(entry.id, s), writeShareImage(entry.id, s)]);
    const words = filenameWords(s.file);
    const meta = sidecars.get(s.file);
    const title = meta?.title ?? makeTitle(words);
    return {
      id: entry.id,
      title,
      alt: meta?.alt ?? title,
      tags: (meta?.tags ?? []).map((slug) => ({ slug, name: tagList.get(slug)! })),
      ...(meta?.description ? { description: meta.description } : {}),
      keywords: makeKeywords(words),
      ocr_text,
      src,
      avif,
      og,
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
    ({ id, title, alt, tags, description, src, avif, og, width, height, added_at }): FeedPoster => ({
      id,
      title,
      alt,
      tags,
      ...(description ? { description } : {}),
      src,
      avif,
      og,
      width,
      height,
      added_at,
    }),
  );
  // Tags in use, in data/tags.yml order, with how many posters carry each.
  const tagsInUse: FeedFile["tags"] = [...tagList]
    .map(([slug, name]) => ({ slug, name, count: records.filter((r) => r.tags.some((t) => t.slug === slug)).length }))
    .filter((t) => t.count > 0);
  const feedChanged = await writeIfChanged(FEED_PATH, json({ posters: feed, tags: tagsInUse } satisfies FeedFile));
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

// ---------- Sidecar metadata ----------

interface Sidecar {
  title?: string;
  alt?: string;
  tags?: string[];
  description?: string;
}

const SIDECAR_FIELDS = new Set(["title", "alt", "tags", "description"]);

async function readTagList(): Promise<Map<string, string>> {
  const raw = await readFile(TAGS_PATH, "utf8").catch(() => "");
  const parsed = (raw ? parseYaml(raw) : {}) as Record<string, unknown> | null;
  const tags = new Map<string, string>();
  for (const [slug, name] of Object.entries(parsed ?? {})) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || typeof name !== "string" || !name.trim()) {
      fail(`data/tags.yml: "${slug}" needs a lowercase-hyphenated slug and a display name, like  deep-time: Deep time`);
    }
    tags.set(slug, name.trim());
  }
  return tags;
}

/** The poster's sidecar (posters/<name>.yml), undefined if it has none, or an error message. */
async function readSidecar(file: string, tagList: Map<string, string>): Promise<Sidecar | undefined | string> {
  const name = `${stem(file)}.yml`;
  const raw = await readFile(join(POSTERS_DIR, name), "utf8").catch(() => null);
  if (raw === null) return undefined;
  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (err) {
    return `  ${name}: not valid YAML (${(err as Error).message.split("\n")[0]})`;
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return `  ${name}: expected fields like  title: …  and  tags: [ … ]`;
  const problems: string[] = [];
  const out: Sidecar = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SIDECAR_FIELDS.has(key)) {
      problems.push(`unknown field "${key}" (allowed: ${[...SIDECAR_FIELDS].join(", ")})`);
      continue;
    }
    if (key === "tags") {
      if (!Array.isArray(value) || !value.every((t) => typeof t === "string")) {
        problems.push("tags must be a list, like  tags: [religion, bible]");
        continue;
      }
      const tags = [...new Set(value as string[])];
      for (const t of tags) {
        if (!tagList.has(t)) {
          const hint = closest(t, [...tagList.keys()]);
          problems.push(`unknown tag "${t}"${hint ? ` (did you mean "${hint}"?)` : ""}; add new tags to data/tags.yml`);
        }
      }
      out.tags = tags;
      continue;
    }
    if (typeof value !== "string" || !value.trim()) {
      problems.push(`${key} must be text`);
      continue;
    }
    const text = value.trim().replace(/\s+/g, " ");
    const max = key === "title" ? TITLE_MAX_CHARS : key === "alt" ? ALT_MAX_CHARS : DESCRIPTION_MAX_CHARS;
    if (text.length > max) problems.push(`${key} is ${text.length} characters; the limit is ${max}`);
    out[key as "title" | "alt" | "description"] = text;
  }
  return problems.length ? problems.map((p) => `  ${name}: ${p}`).join("\n") : out;
}

/** Metadata or correction files whose poster is gone (usually a rename that missed them). */
async function strayFiles(scanned: ScannedFile[]): Promise<string[]> {
  const stems = new Set(scanned.map((s) => stem(s.file)));
  const errors: string[] = [];
  for (const name of await readdir(POSTERS_DIR)) {
    const sidecar = /^(.*)\.(yml|yaml)$/.exec(name);
    if (!sidecar) continue;
    if (sidecar[2] === "yaml") errors.push(`  ${name}: rename to ${sidecar[1]}.yml`);
    else if (!stems.has(sidecar[1]!)) errors.push(`  ${name}: no poster image named ${sidecar[1]}.* (rename it along with its poster)`);
  }
  return errors;
}

/** The candidate within edit distance 2, if any. */
function closest(word: string, candidates: string[]): string | undefined {
  const distance = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0]!;
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const temp = row[j]!;
        row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = temp;
      }
    }
    return row[b.length]!;
  };
  const best = candidates.map((c) => [c, distance(word, c)] as const).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= 2 ? best[0] : undefined;
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
  const keepOg = new Set(records.map((r) => basename(r.og)));
  for (const name of await readdir(OG_DIR)) {
    if (!keepOg.has(name)) await rm(join(OG_DIR, name));
  }
}

// ---------- Share image ----------

// Link previews (Open Graph): each poster cropped to 1200x630 from the top. The content hash in the name
// means a replaced poster gets a fresh preview and the old one can be cached forever.
async function writeShareImage(id: string, s: ScannedFile): Promise<string> {
  const name = `${id}-${s.hash.slice(0, 8)}.jpg`;
  const out = join(OG_DIR, name);
  if (!(await exists(out))) {
    await sharp(join(POSTERS_DIR, s.file)).rotate().resize(1200, 630, { fit: "cover", position: "top" }).jpeg({ quality: 82 }).toFile(out);
    counts.imagesWritten++;
  }
  return `${OG_URL}/${name}`;
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
