# Mission Control

Working tracker for building Curious Shit: what's done, what's next, and what's still unresolved. Update it whenever a step is confirmed, finished or changed.

Specs live in [CLAUDE.md](../CLAUDE.md), [PRD.md](PRD.md), [content-model.md](content-model.md) and [design-standard.md](design-standard.md). This file tracks the work, not the requirements.

**Status key:** `proposed` (under discussion) · `confirmed` (agreed, not started) · `in progress` · `done`

---

## Done

| Date | Work | Where |
| --- | --- | --- |
| 2026-11-01 | Vibe sentence, PRD, content model with gap decisions, design standard | `.claude/`, PR #1 |
| 2026-11-01 | CLAUDE.md, `.gitignore` for Node/Cloudflare/Firebase, Claude attribution turned off | PR #1 (merged manually by owner) |
| 2026-11-01 | Mission control tracker | PR #2 |
| 2026-11-01 | Phase 0: folder layout, Vite + TypeScript toolchain, shared reactions, design tokens, blank page | PR #3 |
| 2026-11-01 | Phase 1: `npm run ingest` builds the manifest, WebP variants and index; OCR verified on the three sample posters | `phase-1-ingest-pipeline` |

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-01 | TypeScript everywhere: ingest script, frontend, Worker | One toolchain; the reaction set is defined once and shared |
| 2026-11-01 | Plain TypeScript + Vite, no frontend framework | The page is small: feed, search bar, reaction bar, one dialog |
| 2026-11-01 | OCR with native Tesseract installed locally, not tesseract.js | Faster and more accurate, which serves the 90% search target |
| 2026-11-01 | The build runs on the owner's machine, not in CI | Keeps "one command, live in 5 minutes" simple; CI can come later |
| 2026-11-01 | Added a seventh reaction: `shit` 💩 | Owner request, before phase 0 merged; it fits the site's name |
| 2026-11-01 | `.claude/PRD.md` is the only PRD; the claude.ai shared copy is dropped and no longer maintained | The repo file is versioned and read by every session; one copy can't drift |

## Plan

Each phase ends with something that can be seen or tested. Phases and steps are `proposed` until confirmed in conversation.

**Workflow:** one branch and one PR per phase, named `phase-N-<short-name>` (e.g. `phase-0-project-setup`). The PR updates this tracker as part of its work. The owner merges PRs manually.

| # | Phase | Status | Outcome |
| --- | --- | --- | --- |
| 0 | Project setup | done | Folder layout and toolchain ready, dev server running |
| 1 | Ingest pipeline | done | One command turns `posters/` into WebP variants, a manifest and a search index |
| 2 | Static gallery | proposed | Infinite scroll of posters styled to the design standard, running locally |
| 3 | Search | proposed | Pinned search bar filtering the feed by filename and OCR text |
| 4 | First deploy | proposed | Gallery and search live on Cloudflare Pages |
| 5 | Sign-in | proposed | Firebase Auth with Google and email magic link |
| 6 | Reactions | proposed | Worker + D1 endpoint, reaction bar wired up, rate limiting |
| 7 | Launch readiness | proposed | Privacy page, graceful degradation, success criteria checked |

Detailed steps for each phase get added below as they're confirmed.

### Phase 0: Project setup (done 2026-11-01)

**Folder layout**

```
curious-shit/
├── posters/                 originals, committed; optional <name>.ocr.txt correction files beside them
├── data/manifest.json       permanent poster IDs and added_at dates, committed
├── scripts/ingest.ts        the build pipeline (phase 1)
├── shared/reactions.ts      the seven reactions, used by frontend and Worker
├── src/                     frontend: index.html, main.ts, styles/tokens.css
├── public/generated/        WebP variants and search index written by ingest, ignored by git
├── worker/                  reactions Worker: src/index.ts, schema.sql, wrangler.toml (phase 6)
└── dist/                    Vite build output, ignored by git
```

**Steps**

| # | Step | Who | Status |
| --- | --- | --- | --- |
| 0.1 | Install Tesseract: `sudo apt install -y tesseract-ocr` | Owner (needs sudo) | done |
| 0.2 | Move the three sample posters into `posters/` | Claude | done |
| 0.3 | Create `package.json`, `tsconfig.json` and Vite config; install `typescript`, `vite`, `tsx`, `sharp`, `wrangler` as dev dependencies | Claude | done |
| 0.4 | Create the folder layout with placeholder files | Claude | done |
| 0.5 | Write `shared/reactions.ts` with the reactions (seven, after adding 💩) | Claude | done |
| 0.6 | Write `src/styles/tokens.css` from the design standard's token block, plus a blank page using it | Claude | done |
| 0.7 | Add `public/generated/` to `.gitignore` | Claude | done |
| 0.8 | npm scripts: `dev`, `ingest`, `build`, `deploy` (ingest and deploy as stubs until their phases) | Claude | done |

**Done when:** `tesseract --version` works, and `npm run dev` serves a blank dark page that uses the design tokens.

### Phase 1: Ingest pipeline (done 2026-11-01)

`npm run ingest` runs these steps in order. It's incremental: unchanged posters are skipped, so a re-run with nothing new takes seconds.

| # | Step | Detail | Status |
| --- | --- | --- | --- |
| 1.1 | Scan | Find `.jpg`, `.jpeg`, `.png` and `.webp` files in `posters/`, case-insensitive. | done |
| 1.2 | Validate | Read dimensions with `sharp`. Any image with aspect ratio below 1.2 fails the whole run with a list of the offending files, so nothing is half-published. | done |
| 1.3 | Identify | Hash each file (SHA-256). Match it to the manifest by filename, then by hash. A hash match under a new name is a rename: update `file`, keep `id`. No match is a new poster: `id` = filename slug (`-2` appended on collision), `added_at` = now. Same filename with new contents is a replacement and keeps its ID. A removed poster that comes back (by name or hash) is restored with its old ID. Manifest entries hold `id`, `file`, `hash`, `added_at` and `removed`. | done |
| 1.4 | Retire | A manifest entry whose file is gone gets `removed: true` and drops out of the index. The entry stays so its ID is never reused. | done |
| 1.5 | OCR | Use `posters/<name>.ocr.txt` if it exists. Otherwise use the cached result in `.cache/ocr/<hash>.txt`. Otherwise run Tesseract (`-l eng`) on a grayscale copy upscaled to at least 3000px wide, since poster text is often small. Collapse whitespace, drop tokens with no letters or digits, cap at 5,000 characters. | done |
| 1.6 | Title and keywords | Title: filename with hyphens and underscores as spaces, title-cased, 80 characters max. Keywords: lowercase filename words minus stop words. | done |
| 1.7 | Images | `sharp` writes WebP (quality 80) at 800, 1600 and 2400px wide to `public/generated/posters/<id>-<hash8>-<width>.webp`, skipping widths larger than the original (at least one variant is always written) and files that already exist. The hash in the name lets the CDN cache images forever and gives a replaced poster new URLs. Files no longer referenced are deleted. | done |
| 1.8 | Index | Write `public/generated/index.json` as `{ posters: [...] }`: every non-removed Poster record (content model fields; `src` is a list of `{ width, url }`), newest first, ties by ID. Files are only rewritten when their contents change. The search-library index format is decided in phase 3. | done |
| 1.9 | Report | Print counts: new, renamed, replaced, restored, removed, unchanged; OCR from correction files, cache and Tesseract; images written; total time. | done |

**Done when:** on the three sample posters, `npm run ingest` produces the manifest, the WebP files and an index with OCR text; a second run changes nothing; renaming a poster keeps its ID.

**Verified 2026-11-01:** first run 2.4s with OCR on all three; second run changes no files; rename keeps the ID and updates the title; removal retires the entry and deletes its images; putting the file back restores the original manifest and index exactly; a correction file overrides OCR; a square image fails the run with the manifest untouched.

## Environment

Checked 2026-11-01 on the owner's machine (WSL2, Linux):

| Tool | Status |
| --- | --- |
| Node | v24.16.0 |
| npm | 11.13.0 |
| Python | 3.14.4 |
| gh | 2.96.0 |
| Firebase CLI | 15.29.0 |
| Tesseract | 5.5.0 (eng, osd) |
| cwebp | not installed (not needed: `sharp` makes the WebP files) |
| Wrangler | project dev dependency (`npx wrangler`) |

## Caveats and open issues

- The `initial-checkin` and `create-mission-control` branches are merged but still exist on GitHub (`initial-checkin` also locally).
- Renaming a poster and editing its contents in the same run makes it look new: it gets a new ID and the old entry is retired, so its reactions are orphaned. Rename and edit in separate runs.
- A correction file must be renamed along with its poster (`<name>.ocr.txt` follows the image's filename).
- The sample posters are only 1536–1672px wide, so they get an 800px variant (and 1600px for the gnostic poster) but no 2400px one.
- Fonts load from Google Fonts at runtime, so the page needs network access to show the right typefaces.
- Cloudflare and Firebase accounts and projects have to be created by the owner; Claude can't sign up for them. Deferred to phase 4 (Cloudflare) and phase 5 (Firebase), when they're first needed.
- Generated images aren't committed, so a fresh clone must run `npm run ingest` before `npm run dev` shows posters.
- Titles built from filenames lose punctuation: `resurrection-overview-jehovahs-witness-vs-seventh-day-adventist` becomes "Resurrection Overview Jehovahs Witness Vs Seventh Day Adventist". Proper titles need the sidecar metadata file (a Should-Have) or careful filenames.
