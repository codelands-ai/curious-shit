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
| 2026-11-01 | Phase 1: `npm run ingest` builds the manifest, WebP variants and index; OCR verified on the three sample posters | PR #4 |
| 2026-11-01 | Phase 2: looping gallery feed with batching, entrance motion, picture lights and the feed error line | PR #5 |
| 2026-11-01 | Phase 3: MiniSearch search bar with results, clearing, `?q=` links, error line, speed and accuracy checks | PR #6 |
| 2026-11-01 | Phase 4: Cloudflare config, caching headers, `npm run deploy` / `deploy:preview`, first production deploy, mobile LCP fixes | `phase-4-first-deploy` |

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-01 | TypeScript everywhere: ingest script, frontend, Worker | One toolchain; the reaction set is defined once and shared |
| 2026-11-01 | Plain TypeScript + Vite, no frontend framework | The page is small: feed, search bar, reaction bar, one dialog |
| 2026-11-01 | OCR with native Tesseract installed locally, not tesseract.js | Faster and more accurate, which serves the 90% search target |
| 2026-11-01 | The build runs on the owner's machine, not in CI | Keeps "one command, live in 5 minutes" simple; CI can come later |
| 2026-11-01 | Added a seventh reaction: `shit` 💩 | Owner request, before phase 0 merged; it fits the site's name |
| 2026-11-01 | Ingest writes a slim `feed.json` for the gallery; the full `index.json` with OCR text loads only for search | About 5 MB of OCR text at 1,000 posters would blow the 2.5s LCP target |
| 2026-11-01 | Feed load failure shows "The gallery is closed for a moment. Shit happens." | Owner's wording; the specs had no error state for the feed |
| 2026-11-01 | Fonts stay on Google Fonts until phase 7 | They don't block the first poster; self-hosting can wait |
| 2026-11-01 | Search uses MiniSearch, built in the browser from `index.json` | Works directly on the existing JSON; one small library. Pagefind's partial loading only pays off at far larger collections |
| 2026-11-01 | Search terms go in the URL (`?q=`) as part of phase 3 | A Should-Have, but small; makes searches shareable |
| 2026-11-01 | No-results line: "Can't find any curious shit. Try something else." | Owner's wording |
| 2026-11-01 | If `index.json` fails to load, the search status shows "Search is closed for a moment. Shit happens." and the feed stays | Matches the feed's error line; specs had no search error state |
| 2026-11-01 | Deploys upload `dist/` from the owner's machine with Wrangler; Cloudflare doesn't build from GitHub | Tesseract and the generated images exist only locally |
| 2026-11-01 | `npm run deploy` commits new posters and the manifest and pushes them straight to `main` after a successful upload | Keeps publishing to one command and never loses poster IDs. Code still goes through PRs; only `posters/` and `data/manifest.json` skip review |
| 2026-11-01 | Site name `curious-shit` on the free Cloudflare address; custom domain later | Owner's choice |
| 2026-11-01 | Host as Workers static assets (`wrangler deploy`, `workers.dev` address) instead of classic Pages | Wrangler 4.156 redirects Pages project creation to Workers and calls classic Pages "the previous version". Static assets with no script still keep the reactions Worker the only server-side code |
| 2026-11-01 | First production deploy ran once from `phase-4-first-deploy` with plain `wrangler deploy` | Previews need the Worker to exist; owner chose to go live before merging so live checks could be done in the PR |
| 2026-11-01 | The build writes the newest poster's card into `index.html`, preloads its image and `feed.json`, loads fonts without blocking paint, and gives later posters low fetch priority | Mobile Lighthouse LCP was 2.6–2.8s with the card built by JavaScript; median is now 1.64s |
| 2026-11-01 | `.claude/PRD.md` is the only PRD; the claude.ai shared copy is dropped and no longer maintained | The repo file is versioned and read by every session; one copy can't drift |

## Plan

Each phase ends with something that can be seen or tested. Phases and steps are `proposed` until confirmed in conversation.

**Workflow:** one branch and one PR per phase, named `phase-N-<short-name>` (e.g. `phase-0-project-setup`). The PR updates this tracker as part of its work. The owner merges PRs manually.

| # | Phase | Status | Outcome |
| --- | --- | --- | --- |
| 0 | Project setup | done | Folder layout and toolchain ready, dev server running |
| 1 | Ingest pipeline | done | One command turns `posters/` into WebP variants, a manifest and a search index |
| 2 | Static gallery | done | Infinite scroll of posters styled to the design standard, running locally |
| 3 | Search | done | Pinned search bar filtering the feed by filename and OCR text |
| 4 | First deploy | in progress | Gallery and search live on Cloudflare (Workers static assets) |
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
| 1.7 | Images | `sharp` writes WebP (quality 80) at 800, 1600 and 2400px wide to `public/generated/posters/<id>-<hash8>-<width>.webp`, plus the original width when it's below 2400 (never upscaled; changed in phase 2 so 1536px originals aren't served at 800px on desktop) and files that already exist. The hash in the name lets the CDN cache images forever and gives a replaced poster new URLs. Files no longer referenced are deleted. | done |
| 1.8 | Index | Write `public/generated/index.json` as `{ posters: [...] }`: every non-removed Poster record (content model fields; `src` is a list of `{ width, url }`), newest first, ties by ID. Files are only rewritten when their contents change. The search-library index format is decided in phase 3. | done |
| 1.9 | Report | Print counts: new, renamed, replaced, restored, removed, unchanged; OCR from correction files, cache and Tesseract; images written; total time. | done |

**Done when:** on the three sample posters, `npm run ingest` produces the manifest, the WebP files and an index with OCR text; a second run changes nothing; renaming a poster keeps its ID.

**Verified 2026-11-01:** first run 2.4s with OCR on all three; second run changes no files; rename keeps the ID and updates the title; removal retires the entry and deletes its images; putting the file back restores the original manifest and index exactly; a correction file overrides OCR; a square image fails the run with the manifest untouched.

### Phase 2: Static gallery (done 2026-11-01)

| # | Step | Detail | Status |
| --- | --- | --- | --- |
| 2.1 | Slim feed file | Ingest also writes `public/generated/feed.json`: `id`, `title`, `src`, `width`, `height`, `added_at`, newest first. OCR text stays in `index.json`, loaded only by search (phase 3). | done |
| 2.2 | Page shell | 64px glass search-bar strip pinned to the top with the wordmark at the left gutter; feed below with the standard spacing. Room is left for the search input (phase 3) and `auth_control` (phase 5). | done |
| 2.3 | Poster card | `<figure>` with the image and placard title. `srcset` from `src`, `sizes` matching the layout, `width`/`height` set, alt = title. `--plinth` placeholder at the exact aspect ratio, poster shadow, picture light. | done |
| 2.4 | Batching | Render 8 cards at a time; when the bottom comes within about one screen, add the next 8. The brass loading dot sits at the bottom. First card eager with high fetch priority, the rest lazy. | done |
| 2.5 | Looping | After the last poster the feed starts again from the newest. Repeats are new elements and get the entrance animation. | done |
| 2.6 | Motion | Entrance at 15% visible (image fades and rises; picture light fades up 100ms later); first poster skips it; picture light brightens on hover; reduced motion means opacity only. | done |
| 2.7 | Error state | If `feed.json` fails to load, show "The gallery is closed for a moment. Shit happens." in the feed status style. | done |
| 2.8 | Responsive check | Gutters, gaps and title size at 375, 800 and 1440px. | done |

**Done when:** with the three sample posters, the page scrolls endlessly with no layout shift, the first poster appears without animation, and nothing moves under reduced motion.

**Verified 2026-11-01** in headless Chromium: gutters 16/32/64px, exhibit gaps 64/96/128px, space above the first exhibit 32/48/64px and title size 16/20/20px at 375/800/1440px; zero layout shift on load and over 48 cards of normal-speed scrolling; feed loops in order; first card shows at full opacity, later cards light up when 15% visible; reduced motion leaves cards at full opacity with no transform and a still dot; a failing `feed.json` shows the error line.

### Phase 3: Search (done 2026-11-01)

| # | Step | Detail | Status |
| --- | --- | --- | --- |
| 3.1 | Search library | MiniSearch over title, keywords and OCR text; title and keywords weighted higher; prefix matching and small-typo tolerance for OCR misreads. Shared config in `shared/search.ts`. | done |
| 3.2 | Index loading | `index.json` loads on first focus or input, never on page load. A query typed before it arrives runs when it's ready. | done |
| 3.3 | Search bar | 40px input centered in the strip, max 560px wide, max 100 characters, placeholder "Search every word on every wall", clear button when there's text. Below 768px the wordmark hides. Border goes brass on focus. | done |
| 3.4 | Results | 150ms after typing stops: feed fades out, page jumps to top, results fade in, in batches of 8, no looping, no entrance animation. Result status "N exhibits". | done |
| 3.5 | Ends of the list | End of results: "You've reached the back wall." No matches: "Can't find any curious shit. Try something else." | done |
| 3.6 | Clearing | Clear button, Escape or an empty box returns the full looping feed with the same fade. | done |
| 3.7 | URL | The query is kept in `?q=` (replaced, not pushed, so typing doesn't flood history). Opening a `?q=` link runs the search. | done |
| 3.8 | Speed check | `npm run bench:search`: 1,000 synthetic posters of 5,000 characters; every search under 200ms. | done |
| 3.9 | Accuracy check | 10 distinct words read by eye off each sample poster; search must return the right poster. | done |

**Done when:** searching any word read off a sample poster finds it, the 1,000-poster benchmark stays under 200ms, and clearing returns the endless feed.

**Verified 2026-11-01:**
- Accuracy: 30 of 30 words read by eye (10 per poster, mostly small body text) return the right poster as the only result, including "Pleistocene", which OCR misread as "Pieistocene".
- Speed: slowest of 160 benchmark searches 11ms (target 200ms). A 100-character query is the slowest case.
- In headless Chromium: `index.json` and MiniSearch load only on first focus; results, "N exhibits", back-wall and no-results lines, Escape, clear button, `?q=` links and the index-failure line all work; below 768px the wordmark hides and the input fills the strip with a 44px clear button.

### Phase 4: First deploy (confirmed 2026-11-01)

| # | Step | Who | Detail | Status |
| --- | --- | --- | --- | --- |
| 4.1 | Cloudflare account | Owner | Free plan at dash.cloudflare.com/sign-up. | done |
| 4.2 | Connect Wrangler | Owner | `! npx wrangler login` in Claude Code; approve in the browser. | done |
| 4.3 | Cloudflare config | Claude | Root `wrangler.toml`: Worker `curious-shit` with `[assets] directory = "./dist"`, no script, `workers.dev` and preview URLs on. The Worker is created by the first production deploy. (Changed from a classic Pages project; see Decisions.) | done |
| 4.4 | Caching rules | Claude | `public/_headers`: poster images and build assets cached for a year (names carry a hash); `feed.json` and `index.json` always revalidated; basic security headers. | done |
| 4.5 | `npm run deploy` | Claude | Requires `main`, in sync with `origin/main`, with no uncommitted changes outside `posters/` and `data/manifest.json`. Runs ingest, type-check and build, uploads, then commits and pushes poster changes. Prints the URL and total time. | done |
| 4.6 | Preview deploys | Claude | `npm run deploy:preview` runs `wrangler versions upload --preview-alias <branch>`: a preview URL for the branch that never touches production or commits. Needs the Worker to exist, so only works after the first production deploy. | done |
| 4.7 | Live check | Claude | Feed, search, `?q=` and cache headers on the live site; Lighthouse mobile LCP under 2.5s; time a new-poster deploy against 5 minutes. | in progress |

**Done when:** the site is live on `workers.dev`, search works there, mobile Lighthouse LCP is under 2.5s, and a new poster goes from `posters/` to live in under 5 minutes.

**Verified 2026-11-01:**
- Live at https://curious-shit.smokeraven667.workers.dev (first deploy). Feed, search and `?q=` work there with no console errors; unknown paths return 404.
- Headers: posters and `/assets/*` are `max-age=31536000, immutable`; HTML, `feed.json` and `index.json` are `max-age=0, must-revalidate`; security headers on every response; text responses are Brotli-compressed.
- `npm run deploy:preview` works (alias `phase-4-first-deploy-curious-shit.smokeraven667.workers.dev`) and leaves production untouched.
- Deploy guards tested in a throwaway clone: wrong branch, code changes, behind and ahead of GitHub are all refused; a new poster alone passes.
- Mobile Lighthouse (simulated slow 4G, 4× CPU), five runs on the preview: LCP 1.59, 1.64, 1.59, 2.04, 3.12s, median **1.64s**; scores 92–100; CLS 0. The 3.12s run spent 1.9s in render delay with downloads on time, which matches local CPU contention rather than the site.
- **Still to do:** time a real new-poster publish (`jacob-esau.webp`, added by the owner) with `npm run deploy` from `main` after this PR merges. That deploy also ships the LCP fixes to production.

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
- The sample posters are only 1536–1672px wide, so on high-density desktop screens they show at their native width, slightly soft. Larger originals (2400px+) fix that.
- The feed never removes cards, so a very long scroll keeps growing the page. Fine for now; revisit if memory becomes a problem on phones.
- Scrolling very fast (thousands of pixels at once) can catch the loading dot on screen as a batch is added, which counts as layout shift. Normal scrolling causes none.
- Below 768px the spec hides the wordmark to make room for the search input; that rule arrives with the input in phase 3.
- At 1,000 posters, `index.json` is about 5 MB (2.6 MB gzipped for random text; real text compresses better) and building the search index takes about 0.8s on the owner's machine, likely 2–4s on a phone. This happens once, on the first search. If it's too slow, ingest can pre-build the MiniSearch index (`toJSON`/`loadJSON`) or the build can move to a Web Worker.
- The focused search box shows both the brass border (design standard, Search) and the standard brass focus outline (design standard, Focus), which reads as a double ring. Both rules were followed as written; drop one if it looks heavy.
- Very common words (e.g. "the") match every poster. That's expected; results are ranked, not filtered further.
- The live address includes the Cloudflare account's subdomain (`smokeraven667.workers.dev`). A custom domain would replace it.
- Preview URLs are public to anyone who has the link.
- `npm run deploy:preview` runs ingest, so new posters in `posters/` get IDs in the local manifest. That change stays uncommitted; the production deploy commits it.
- A shared `?q=` link may briefly show the newest poster (written into the HTML) before the results replace it.
- Fonts load from Google Fonts at runtime, so the page needs network access to show the right typefaces.
- Cloudflare and Firebase accounts and projects have to be created by the owner; Claude can't sign up for them. Deferred to phase 4 (Cloudflare) and phase 5 (Firebase), when they're first needed.
- Generated images aren't committed, so a fresh clone must run `npm run ingest` before `npm run dev` shows posters.
- Titles built from filenames lose punctuation: `resurrection-overview-jehovahs-witness-vs-seventh-day-adventist` becomes "Resurrection Overview Jehovahs Witness Vs Seventh Day Adventist". Proper titles need the sidecar metadata file (a Should-Have) or careful filenames.
