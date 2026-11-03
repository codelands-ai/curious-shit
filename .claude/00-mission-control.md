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
| 2026-11-01 | Phase 4: Cloudflare config, caching headers, `npm run deploy` / `deploy:preview`, first production deploy, mobile LCP fixes | PR #7 |
| 2026-11-01 | Phase 5: Firebase sign-in (Google popup, email link), auth control and dialog, privacy page | PR #9 |
| 2026-11-02 | Phase 6: reactions Worker + D1, reaction bar in a placard panel above each poster, Worker tests, delete-user script | PR #10 |
| 2026-11-03 | Phase 7: success criteria met with evidence; AVIF, self-hosted fonts, pre-built search index, sparse OCR, accessibility fixes, page basics, CSP, README | PR #11 |
| 2026-11-03 | Phase 8: permalinks with per-poster preview cards, share button, sitemap | PR #13 |
| 2026-11-03 | Phase 9: sidecar titles, alt text and tags; topic filter row; tag search | PR #14 |
| 2026-11-01 | First poster published with `npm run deploy`: `jacob-esau.webp`, live and searchable in 12s | commit `98a8732` |

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
| 2026-11-01 | Firebase Auth code loads only on "Sign in to react", for returning signed-in visitors after the first paint, or when opening an email link | Keeps the SDK off the critical path for first-time visitors and the LCP target |
| 2026-11-01 | Google sign-in uses a popup, not a redirect | Redirect sign-in breaks in browsers that block third-party storage when the site isn't on the Firebase auth domain |
| 2026-11-01 | Sign-in dialog heading "Sign in to react"; privacy note "We keep only an anonymous ID. Your email stays with Google's Firebase." | Owner approved |
| 2026-11-01 | Signed-in control shows the user's initial, not their Google photo | Owner's choice: no extra download, quieter |
| 2026-11-01 | Privacy page moves from phase 7 to phase 5 | The sign-in dialog links to it |
| 2026-11-01 | Stay on Spark and accept 5 email-link sign-in emails per day; when the cap is hit the dialog says so and suggests Google | Verified on firebase.google.com/docs/auth/limits (updated 2026-10-20): "Email link sign-in emails 5 emails/day" on Spark, 25,000 on Blaze, "Please add a billing instrument to go beyond 5". Signed-in visitors stay signed in, so only new email sign-ins count. Revisit if it bites |
| 2026-11-01 | The Auth emulator runs through `npx firebase-tools@15.29.0` (`npm run emulators`, `npm run dev:emulator`) | The global `firebase` is the Windows install under WSL and hangs at prompts |
| 2026-11-01 | Privacy page contact for deletion requests: willt@codelands.ai | Owner's choice |
| 2026-11-02 | The reactions API runs in the site's own Worker at `/api/*` (`run_worker_first`), same origin as the site | No CORS preflights or second deploy. Static files never invoke the script, so the site stays up if the API fails. Still the only server-side code |
| 2026-11-02 | D1 keeps a `counts` table updated in the same transaction as `reactions` | Reading counts costs 7 rows per poster regardless of popularity, protecting the free read quota |
| 2026-11-02 | Add/remove are `PUT`/`DELETE` per poster and emoji, not a toggle | Idempotent, so retries and double taps can't flip state |
| 2026-11-02 | Rate limits: about 60 changes/min per user, about 300 reads/min per IP, via the Workers rate-limit binding | Owner approved. Cloudflare's docs say the limits are approximate and per location, which is fine for flood protection |
| 2026-11-02 | Tapping the signed-out tooltip opens the sign-in dialog | Owner approved (superseded below) |
| 2026-11-02 | After trying the preview: "Sign in to react" becomes "Sign in to vote" (button and dialog); signed-out taps open sign-in directly, no tooltip; counts always show, including 0; title and reaction bar move above the poster in one row (stacked on phones); title 31px (25px on phones) in bright text; emoji 28px in 48px pills | Owner feedback: "react" reads as the framework, and titles and emoji were too small and easy to miss |
| 2026-11-02 | Title and emoji sit inside a raised `--plinth` placard panel attached to the top of each poster, with pills on `--wall`; the picture light moves behind the whole exhibit and its edges are masked | Owner feedback: the pills crossed the glow's hard top edge; the panel should act as a divider between posters |
| 2026-11-03 | The LCP criterion is measured with Lighthouse devtools (applied) throttling, mobile | Stricter than the simulated default; passing it implies passing the other |
| 2026-11-03 | Self-host the fonts (supersedes "Fonts stay on Google Fonts until phase 7") | Removes a second origin from the critical path, and Google no longer sees visitor IPs |
| 2026-11-03 | Keep the owner's three test votes as the first real votes | Owner's choice |
| 2026-11-03 | The search input shows only its brass border on focus; every other control keeps the standard focus outline | Resolves the phase 3 double ring |
| 2026-11-03 | Phase 7 includes the launch polish (accessibility, page basics, CSP, README) | Owner's choice |
| 2026-11-03 | Hard rule reworded: if the Worker is down, bars are hidden; if Firebase is down, counts still show and sign-in reports an error (CLAUDE.md, PRD, content model) | Owner's choice: counts come from our own Worker, so hiding them when only sign-in is down would remove working information |
| 2026-11-03 | Permalinks are `/p/<id>`, one static HTML page per poster written after the build | Link-preview bots don't run JavaScript, and the stack forbids server rendering |
| 2026-11-03 | A permalink opens the feed at that poster and continues in feed order, looping | Keeps walking the hallway from where the link dropped you |
| 2026-11-03 | Preview text: "<title> · Curious Shit" with the site description; image is a 1200×630 crop of the poster | OCR snippets are too messy for previews |
| 2026-11-03 | A share button (link icon) in each placard panel: native share sheet on phones, copy on desktop | The address bar doesn't change while scrolling, so there's nothing else to copy |
| 2026-11-03 | Cormorant SC (titles, wordmark) is preloaded with `font-display: optional` instead of `swap` | A late swap re-wrapped long titles and shifted the poster (CLS up to 0.14). Trade-off: on a slow first visit, titles may show in the fallback serif for that page |
| 2026-11-03 | Sidecar metadata is YAML (`posters/<name>.yml`): `title`, `alt`, `tags`, `description` | Easy to hand-edit; unknown fields and over-long values fail the publish |
| 2026-11-03 | Tags come from a fixed list in `data/tags.yml`; unknown tags fail the publish with a suggestion | Catches typos before they become new tags |
| 2026-11-03 | Filtering: a tag row under the top bar plus clickable tags on each poster; `?tag=` in the URL, combinable with search | Owner's choice |
| 2026-11-03 | First titles and tags: Geologic Time Scale (Deep time, Earth science); The Gnostic Cosmos (Religion, Gnosticism, Cosmology); Esau and Jacob (Religion, Bible); Resurrection Overview: Jehovah's Witnesses vs. Seventh-day Adventists (Religion, Christianity) | Owner approved; titles taken from each poster's own heading |
| 2026-11-03 | IBM Plex Sans also uses `font-display: optional` (not preloaded) | Topic chips wrap by width; a late swap shifted the poster on phones. On a first page view the system sans may show instead, which looks close |
| 2026-11-03 | The viewer opens by tapping the poster (no extra icon); Back closes it; one poster at a time; a Full screen button on desktop | Owner's choice |
| 2026-11-03 | Own pan/zoom code (pointer events and CSS transforms), loaded on first open | No dependency; keeps up-front JS and LCP unchanged |
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
| 4 | First deploy | done | Gallery and search live on Cloudflare (Workers static assets) |
| 5 | Sign-in | done | Firebase Auth with Google and email magic link |
| 6 | Reactions | done | Worker + D1 endpoint, reaction bar wired up, rate limiting |
| 7 | Launch readiness | done | Graceful degradation, success criteria checked (privacy page moved to phase 5) |
| 8 | Poster permalinks | done | Every poster has its own link with a real preview card; the gallery opens at that poster |
| 9 | Topic tags and titles | done | Sidecar files give posters proper titles, alt text and tags; visitors filter by tag |
| 10 | Full-screen view with zoom | in progress | Tap a poster to see it full screen; pinch, wheel or double-tap to read small print |

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

### Phase 4: First deploy (done 2026-11-01)

| # | Step | Who | Detail | Status |
| --- | --- | --- | --- | --- |
| 4.1 | Cloudflare account | Owner | Free plan at dash.cloudflare.com/sign-up. | done |
| 4.2 | Connect Wrangler | Owner | `! npx wrangler login` in Claude Code; approve in the browser. | done |
| 4.3 | Cloudflare config | Claude | Root `wrangler.toml`: Worker `curious-shit` with `[assets] directory = "./dist"`, no script, `workers.dev` and preview URLs on. The Worker is created by the first production deploy. (Changed from a classic Pages project; see Decisions.) | done |
| 4.4 | Caching rules | Claude | `public/_headers`: poster images and build assets cached for a year (names carry a hash); `feed.json` and `index.json` always revalidated; basic security headers. | done |
| 4.5 | `npm run deploy` | Claude | Requires `main`, in sync with `origin/main`, with no uncommitted changes outside `posters/` and `data/manifest.json`. Runs ingest, type-check and build, uploads, then commits and pushes poster changes. Prints the URL and total time. | done |
| 4.6 | Preview deploys | Claude | `npm run deploy:preview` runs `wrangler versions upload --preview-alias <branch>`: a preview URL for the branch that never touches production or commits. Needs the Worker to exist, so only works after the first production deploy. | done |
| 4.7 | Live check | Claude | Feed, search, `?q=` and cache headers on the live site; Lighthouse mobile LCP under 2.5s; time a new-poster deploy against 5 minutes. | done |

**Done when:** the site is live on `workers.dev`, search works there, mobile Lighthouse LCP is under 2.5s, and a new poster goes from `posters/` to live in under 5 minutes.

**Verified 2026-11-01:**
- Live at https://curious-shit.smokeraven667.workers.dev (first deploy). Feed, search and `?q=` work there with no console errors; unknown paths return 404.
- Headers: posters and `/assets/*` are `max-age=31536000, immutable`; HTML, `feed.json` and `index.json` are `max-age=0, must-revalidate`; security headers on every response; text responses are Brotli-compressed.
- `npm run deploy:preview` works (alias `phase-4-first-deploy-curious-shit.smokeraven667.workers.dev`) and leaves production untouched.
- Deploy guards tested in a throwaway clone: wrong branch, code changes, behind and ahead of GitHub are all refused; a new poster alone passes.
- Mobile Lighthouse (simulated slow 4G, 4× CPU), five runs on the preview: LCP 1.59, 1.64, 1.59, 2.04, 3.12s, median **1.64s**; scores 92–100; CLS 0. The 3.12s run spent 1.9s in render delay with downloads on time, which matches local CPU contention rather than the site.
- New-poster publish: `npm run deploy` on `main` with the owner's `jacob-esau.webp` took **12s** end to end (ingest, build, upload, commit and push as `98a8732`). OCR for this poster was already cached from preview runs; a first-time OCR adds roughly a second per poster. The poster is first in the live feed, its card is in the live HTML, and live searches for "Edomites", "birthright", "Isaac" and "impulsive" return it. This deploy also shipped the LCP fixes to production.

### Phase 5: Sign-in (done 2026-11-01)

| # | Step | Who | Detail | Status |
| --- | --- | --- | --- | --- |
| 5.1 | Firebase project | Owner | Project `curious-shit` on Spark, Analytics off; Authentication with Google and Email link (passwordless); authorized domain `curious-shit.smokeraven667.workers.dev`. | done |
| 5.2 | Connect the CLI | Owner | Replaced: the owner pasted the web config from the console instead. The `firebase` on PATH is the Windows install, whose login a Linux CLI can't use. | done |
| 5.3 | Web app config | Claude | Owner registered the web app; its public config is in `src/firebase-config.ts`. | done |
| 5.4 | Lazy auth | Claude | Firebase loads on "Sign in to react", after first paint for returning signed-in visitors, or when opening an email link. If it fails, the auth control hides. | done |
| 5.5 | Auth control | Claude | Signed out: "Sign in to react". Signed in: initial in a round button with a menu containing "Sign out". | done |
| 5.6 | Sign-in dialog | Claude | 400px, 44px buttons, fade, Escape, focus trapped. Google popup; email link with "Check your email"; errors as an oxblood line. | done |
| 5.7 | Email link return | Claude | Completes sign-in and cleans the URL; asks for the email again on a different device. | done |
| 5.8 | Token for phase 6 | Claude | `getIdToken()` for the reactions client. Nothing from Firebase is stored by us. | done |
| 5.9 | Privacy page | Claude | One short page: what's stored (Firebase UID with reactions), what Firebase holds, what third parties see. Linked from the dialog. | done |
| 5.10 | Tests | Claude, then owner | All flows against the Firebase Auth emulator, Firebase-down behavior and first-visit Lighthouse; then the owner tries real Google and email sign-in on a preview. | done |

**Done when:** the owner can sign in with Google and with an email link on the live site and sign out; Firebase failing leaves browsing and search untouched; first-visit mobile Lighthouse is no worse than phase 4.

**Verified 2026-11-01:**
- Emulator, 25/25 automated checks: first visit shows "Sign in to react" and loads no Firebase; dialog opens, Escape closes; Google popup sign-in shows the initial and closes the dialog; `getIdToken()` returns a token; returning visitors get no "Sign in" flash; sign-out; email link on the same browser signs in and cleans the URL; a reused link shows the expired message; another device asks for the email, then signs in; a simulated `QUOTA_EXCEEDED` shows the daily-cap line; Firebase unreachable shows a friendly error while search works; auth code failing to load hides the control and leaves the feed; the mobile strip fits.
- Real project: authorized domains and the Google provider confirmed through the public config endpoint; the owner signed in with Google and with an email link on the preview.
- First-visit cost: up-front JS 4.7 KB gzipped (was 3.2 KB); Firebase is a separate 31 KB chunk not requested on first visit.
- Lighthouse mobile, devtools (real) throttling, five runs each: preview median 2.66s vs production (phase 4 code) 2.69s, so no regression.

### Phase 6: Reactions (done 2026-11-02)

| # | Step | Detail | Status |
| --- | --- | --- | --- |
| 6.1 | Database | D1 `curious-shit-reactions`: `reactions` (unique on poster, emoji, uid) and `counts`, changed together in one batch. Migrations in `worker/migrations/`. | done |
| 6.2 | Worker API | `GET /api/reactions?ids=` (up to 8; plus the caller's own reactions with a token); `PUT`/`DELETE /api/reactions/:poster/:emoji`. Poster IDs checked against `feed.json`, emoji against `shared/reactions.ts`. | done |
| 6.3 | Token check | Firebase ID token verified with `jose` against Google's keys: signature, audience, issuer, expiry. Only `uid` is used. | done |
| 6.4 | Rate limiting | Rate-limit binding: writes per uid, reads per IP; 429 rolls the bar back quietly. | done |
| 6.5 | Tests | `npm test`: Worker tests on `@cloudflare/vitest-pool-workers` with local D1. One-of-each-emoji rule, idempotency, removal, auth failures, validation, counts, rate limits. | done |
| 6.6 | Reaction bar | Seven pills per card to the design standard; optimistic updates with rollback; duplicate cards stay in sync. | done |
| 6.7 | Loading counts | One request per batch of 8 after render; reserved space so nothing shifts; failure keeps bars invisible. | done |
| 6.8 | Signed out | Counts visible to everyone; tapping a pill opens the sign-in dialog (changed from a tooltip after the owner tried the preview). | done |
| 6.9 | Deletion | `npm run delete-user -- <uid>` removes a user's reactions and fixes counts. | done |
| 6.10 | Local dev | Local Worker and D1 behind `/api`; emulator tokens accepted only with an explicit dev-only setting. | done |

**Done when:** Worker tests pass; the owner can react, un-react and see counts on the live site; two accounts show combined counts; with the Worker unreachable, browsing and search work and bars are absent.

**Verified 2026-11-02:**
- Worker tests (`npm test`), 25/25 on a local D1 with real RS256 tokens. One reaction per user per emoji per poster, including 10 concurrent identical adds; the database's own unique constraint; idempotent add and remove; counts never negative; user deletion fixes counts; bad, expired, foreign-key, wrong-audience, wrong-issuer and unsigned tokens rejected; unknown posters and emoji rejected; both rate limits; emulator tokens accepted only on localhost with the dev flag. Deliberately breaking the count trigger fails 3 tests. `npm run deploy` runs these and refuses to upload on failure.
- Browser end to end (local Worker, D1 and Auth emulator), 23/23: bars on every card, including the pre-rendered one; "Sign in to vote"; zero counts shown; signed-out tap opens sign-in; optimistic taps; three rapid taps match the server; repeats of a poster in the loop stay in sync; two users combine; un-react; sign-out clears highlights; failed writes roll back; Worker down hides bars with no layout shift and search still works; search results have bars; phone layout stacked, with pills in two rows.
- Preview on Cloudflare: the free plan accepted both rate-limit bindings; the production D1 schema was applied; writes without a valid token get 401; the owner voted with Google and email-link accounts and the counts combined (2 distinct voters in production D1).
- Lighthouse mobile (devtools throttling): CLS 0; LCP 2.75–2.84s against 2.66s in phase 5 (+6.5 KB JS, within noise).
- Found and fixed: phone pages scrolled 32px sideways because of the picture light (since phase 2).

### Phase 7: Launch readiness (done 2026-11-03)

| # | Step | Detail | Status |
| --- | --- | --- | --- |
| 7.1 | Publish in 5 minutes | Re-time a publish with OCR not cached. | done |
| 7.2 | Search accuracy | `npm run check:search` over `data/search-check.json` (words read off each poster by eye); Jacob and Esau added. | done |
| 7.3 | Search at 1,000 posters | Index build time on a 4× slowed CPU; pre-build at ingest if too slow. | done |
| 7.4 | LCP under 2.5s | Devtools throttling. Try AVIF with a WebP fallback, phone-size quality and self-hosted fonts; keep what works. | done |
| 7.5 | One emoji each | Record the Worker tests as evidence. | done |
| 7.6 | $0 at scale | Free-plan limits from current docs against estimated use at 1,000 posters and 10,000 visitors a month. | done |
| 7.7 | Graceful degradation | On the live site, block Firebase, then the API: browsing and search work, bars hidden. | done |
| 7.8 | No upload path | Audit every write path. | done |
| 7.9 | Accessibility | Keyboard-only run, axe scan, contrast check. | done |
| 7.10 | Page basics | Favicon, meta description, Open Graph, 404 page. | done |
| 7.11 | Security headers | Content-Security-Policy, tested against every sign-in flow. | done |
| 7.12 | README | Owner's guide to publishing, previews, deletion and local dev. | done |

**Done when:** all six success criteria have recorded evidence, the hard rules pass on the live site, and every open caveat in the tracker is either resolved or explained.

**Success criteria, 2026-11-03:**

| PRD criterion | Result | Evidence |
| --- | --- | --- |
| Adding a poster takes one command, and it's live and searchable within 5 minutes | **Met: 22s** | `npm run deploy:preview` with the OCR cache cleared and one poster's images deleted: OCR of 4 posters (both passes), WebP and AVIF, type-checks, 25 tests, build and upload. The first real publish (phase 4) took 12s. Search ships in the same upload. |
| Searching any distinct word visible on a poster returns it for at least 90% of posters | **Met: 4/4 posters, 40/40 words** | `npm run check:search` over `data/search-check.json` (10 words per poster read by eye, mostly small print and map labels). Needed sparse-text OCR for "Mediterranean", a map label. |
| Search results in under 200ms with 1,000 posters | **Met: 8–13ms** | `npm run bench:search`, 1,000 synthetic posters of 5,000 characters. With a 4× slowed CPU in Chromium: 11ms per search; the one-time index load is 326ms (pre-built by ingest). |
| First poster visible in under 2.5s (LCP) on a mid-range phone over 4G | **Met: 1.82s median** | Lighthouse mobile, devtools (applied) throttling, five runs: 1.80–1.85s, score 99, CLS 0. Was 2.73s; fixed with AVIF (45–50% smaller than WebP) and self-hosted fonts. |
| One of each emoji per user per poster, verified by tests against the Worker | **Met** | `npm test`, 25/25, including 10 concurrent identical adds and the database's unique constraint. `npm run deploy` refuses to upload if they fail. |
| $0 a month through 1,000 posters and 10,000 monthly visitors | **Met, with one soft limit** | See the table below. The only tight limit is 5 email-link sign-ins a day. |

**Free-plan limits against estimated use at 1,000 posters and 10,000 visits a month** (about 330 visits a day; peak days assumed 10× that). Limits quoted from developers.cloudflare.com on 2026-11-03 (Workers limits page updated Oct 29, 2026; static assets billing Nov 3; D1 limits and pricing Oct 30) and firebase.google.com/docs/auth/limits (updated Oct 20, 2026).

| Limit | Free allowance | Estimated use | Headroom |
| --- | --- | --- | --- |
| Static asset requests (pages, images, fonts, JSON) | "free and unlimited" | all page traffic | none needed |
| Worker requests (`/api/*` only) | 100,000/day; over it, `/api/*` gets 429 and bars hide | about 5 per visit: 1,700/day, 17,000 on a peak day | 6× at peak |
| Worker CPU per request | 10 ms | token check and one D1 batch, a few ms | ok |
| D1 queries per invocation | 50 | at most 3 | ok |
| D1 rows read | 5 million/day | up to about 100 per count lookup: 170,000/day, 1.7M peak | 3× at peak |
| D1 rows written | 100,000/day | about 4 per vote (row, count, index): 100 votes a day is 400 rows | 250× |
| D1 storage | 500 MB per database, 5 GB total | about 100 bytes per reaction: 100,000 reactions is about 10 MB | 50× |
| Files per Worker version | 20,000 | 1,000 posters × 2 formats × 2–3 widths ≈ 6,000, plus about 20 | 3× |
| Largest file | 25 MiB | `index.json` and `search-index.json` about 5 MB each | 5× |
| Firebase Auth daily active users (Spark, if the tier applies) | 3,000 (Tier 1) | signed-in visitors per day, well under 300 | 10× |
| Firebase email-link emails | **5/day** | new email sign-ins only | **tight**: past 5, the dialog suggests Google |
| Git repo (originals) | R2 move planned past about 1 GB | about 500 KB per poster: about 500 MB at 1,000 | ok |

**Hard rules:**
- Graceful degradation, on the preview, with the same Cloudflare and Firebase setup as live.
  - Worker API down: feed loads and keeps loading as you scroll (9 → 33 cards), search works, all bars hidden.
  - Both down: the same.
  - Firebase down: feed and search work, counts still show, and sign-in shows a friendly error, which matches the reworded rule.
- No public upload path: POST, PUT, DELETE and PATCH on pages and files return 405; unknown API paths 404. The only writes are `PUT`/`DELETE /api/reactions/:poster/:emoji` with no body, behind token verification.

**Launch polish:**
- Accessibility: axe (WCAG 2.2 AA plus best practice) reports 0 issues on the gallery (desktop and phone), the sign-in dialog, no-results, privacy and 404.
  - Fixed: no h1 on phones; `--text-faint` on `--plinth` (4.3:1); `--oxblood` errors (3.5:1, now `#C76852` at 4.6:1).
  - Keyboard: tab order is search, sign-in, then the pills; the dialog keeps focus and returns it to "Sign in to vote" on close.
- Page basics: SVG favicon and touch icon, meta description, Open Graph and Twitter tags with a 1200×630 share image of the newest poster (made by ingest), canonical URLs, and a 404 page ("Nothing hangs here") with status 404.
- CSP: `default-src 'self'` plus only Firebase sign-in's origins. No violations across the feed, voting, search, privacy, 404 and the Google popup and frame. The owner confirmed Google sign-in works under the CSP on the phase 7 preview (2026-11-03), which runs the same headers as production.
- README: owner's guide to publishing, corrections, previews, deletion and local dev.

### Phase 8: Poster permalinks (done 2026-11-03)

| # | Step | Detail | Status |
| --- | --- | --- | --- |
| 8.1 | One page per poster | `scripts/permalinks.ts` writes `dist/p/<id>.html` from the built gallery page: title, preview tags, canonical, that poster's card pre-rendered and its image preloaded. | done |
| 8.2 | Preview image per poster | Ingest writes `public/generated/og/<id>-<hash8>.jpg` (1200×630, top crop) for each poster; the home page uses the newest one. | done |
| 8.3 | Opens in the scroll | On `/p/<id>` the feed starts at that poster and continues in feed order, looping. | done |
| 8.4 | Share button | Link icon in each placard panel; native share on touch devices, copy plus "Link copied" elsewhere. | done |
| 8.5 | Stable and gone links | IDs never change; removed posters' links get the 404 page. | done |
| 8.6 | Sitemap | `sitemap.xml` and `robots.txt`. | done |
| 8.7 | Tests and docs | Permalink, preview tags, share, 404, Lighthouse on a permalink; content model, design standard, README. | done |

**Done when:** sharing `/p/<id>` shows that poster's title and image in a link preview, opening it shows that poster first with the gallery continuing below, and a permalink meets the 2.5s LCP target.

**Verified 2026-11-03** (preview):
- Over plain HTTP, as a link-preview bot sees them: `/p/<id>` pages return 200 with the poster's title, Open Graph and Twitter tags, and a 1200×630 preview image (cached for a year). `/p/not-a-poster` returns the 404 page. `sitemap.xml` and `robots.txt` are served.
- Browser, 16/16: a permalink starts at that poster and continues in feed order. The server-rendered card is adopted (9 cards, same element), reaction bars load, and there's no layout shift. The tab title is the poster's. Desktop share copies the permalink and shows "Link copied", then hides it. Phone share calls the native sheet with title and URL. 44px target, no sideways scroll. Search works on a permalink and clearing returns to its order. The home page still starts at the newest. axe reports 0 issues.
- Lighthouse mobile, devtools throttling: long-title permalink LCP 1.81–1.87s (five runs), CLS 0; home and the Gnostic Cosmology permalink about 1.85–1.97s, CLS 0. Accessibility, Best Practices 100. SEO is 69 on previews only, because Cloudflare sends `x-robots-tag: noindex` there; production sends none.
- Found and fixed: the title font swapping in late re-wrapped long titles and pushed the poster down (CLS 0.05–0.14). Cormorant SC is now preloaded and uses `font-display: optional`.

### Phase 9: Topic tags and titles (done 2026-11-03)

| # | Step | Detail | Status |
| --- | --- | --- | --- |
| 9.1 | Sidecar file | Optional `posters/<name>.yml`: `title` (80 max), `alt` (125 max, defaults to title), `tags`, `description` (link-preview text). Validated by ingest. | done |
| 9.2 | Tag list | `data/tags.yml`: slug to display name. Unknown tags fail with the closest match suggested. | done |
| 9.3 | Tags on posters | Small square tags under the title in the placard panel, each a link to its filter. | done |
| 9.4 | Filter row | All tags with counts under the top bar; filters like search (fade, jump, "N exhibits · Tag", back wall); `?tag=`; combines with search; wraps on phones. | done |
| 9.5 | Search | Tag names searchable, weighted like keywords. | done |
| 9.6 | Stable links | Title changes don't touch IDs, permalinks or reactions; permalink pages use the new title and description. | done |
| 9.7 | First tags and titles | Sidecars for the four posters (see Decisions). | done |
| 9.8 | Tests and docs | Ingest validation, filter/URL/search behaviour, layout, CLS, accessibility; content model, design standard, README. | done |

**Done when:** the four posters show their new titles and tags, filtering by any tag (alone or with search) shows exactly the tagged posters with a shareable URL, and a bad sidecar fails ingest with a clear message.

**Verified 2026-11-03** (preview):
- Ingest validation: one run reports a 90-character title, an unknown tag "religon" (suggests "religion"), an unknown field, a `.yaml` file and an orphaned sidecar together, and exits before writing anything.
- Browser, 18/18:
  - new titles and tags; the filter row with counts; Religion shows exactly its 3 posters, newest first, ending at the back wall;
  - search inside a tag, and outside it (0 results); Escape keeps the tag; choosing the active topic or "All" clears;
  - tags on posters filter in place; tag names are searchable; `?tag=` links open filtered;
  - permalinks show the new titles and the hand-written alt text;
  - on phones the row wraps with no sideways scroll; axe reports 0 issues with a filter active.
- Lighthouse mobile, devtools throttling: home, `?tag=religion` and the long-title permalink all have LCP 1.80–1.98s, CLS 0, Accessibility 100. `npm run check:search` 40/40; Worker tests 25/25.
- Found and fixed: IBM Plex Sans swapping in late re-wrapped the topic chips on phones (CLS 0.037); Plex now uses `font-display: optional` too (no preload, to keep bandwidth for the first poster).

### Phase 10: Full-screen view with zoom (confirmed 2026-11-03)

| # | Step | Detail | Status |
| --- | --- | --- | --- |
| 10.1 | Opening | Tap or click a poster (magnifier cursor on desktop); focusable, Enter opens. | confirmed |
| 10.2 | Viewer | Full-window dark dialog: title, controls (−, level, +, Fit, Close; Full screen on desktop); page scroll locked. | confirmed |
| 10.3 | Zoom and pan | Pinch and drag; wheel and trackpad toward the cursor; double-tap or double-click toggles fit and 2.5×; keys `+` `−` `0` and arrows. Max 2 screen px per image px; pan clamped to the edges. | confirmed |
| 10.4 | Sharpness | Loads the sharpest variant; ingest adds a zoom-only size (original width up to 4096px) when the original is wider than 2400px. | confirmed |
| 10.5 | Closing | Close, Escape, backdrop tap when not zoomed, or Back (opening pushes a history step); focus and scroll restored. | confirmed |
| 10.6 | First-visit cost | Viewer code loads on first open only. | confirmed |
| 10.7 | Accessibility and motion | Dialog named after the poster, focus kept inside, alt text, labelled 44px controls; reduced motion snaps. | confirmed |
| 10.8 | Tests and docs | Open/close four ways, zoom by every input, pan limits, focus/scroll restore, CLS, axe, phone, Lighthouse; content model, design standard, README. | confirmed |

**Done when:** tapping any poster opens it full screen, small print on a sample poster is readable by zooming with touch, mouse and keyboard, every way of closing returns you to the same place, and the first-poster LCP is unchanged.

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

Reviewed 2026-11-03 (phase 7). Every item is either resolved or a known limitation with its reason.

### Resolved

- ~~LCP under real throttling missed the target~~: AVIF posters and self-hosted fonts give 1.82s median with devtools throttling (phase 7).
- ~~The search index build takes 2–4s on a phone~~: ingest pre-builds it; loading takes 326ms on a 4× slowed CPU (phase 7).
- ~~Double focus ring on the search box~~: the search box keeps only its brass border (phase 7 decision).
- ~~Fonts load from Google Fonts~~: self-hosted (phase 7).
- ~~Below 768px the wordmark hides~~: done in phase 3; in phase 7 it became visually hidden, so it's still the page's h1 for screen readers.
- ~~Cloudflare and Firebase accounts needed creating~~: done in phases 4 and 5.

### Known limitations

- **Rename and edit in separate deploys.** Doing both at once makes a poster look new: new ID, reactions orphaned. In the README.
- **Correction files follow their poster's filename**, so rename them together. In the README.
- **Sample posters are 1536–1672px wide**, so they're a little soft on high-density desktop screens. Originals of 2400px or more fix it.
- **The feed never removes cards**, so a very long scroll keeps growing the page. No problem seen at 100+ cards; revisit if phones struggle.
- **Very fast scrolling** (thousands of pixels at once) can catch the loading dot on screen as a batch is added, which counts as layout shift. Normal scrolling causes none.
- **Very common words** like "the" match every poster. Results are ranked, which is expected.
- **The address includes the account subdomain** (`smokeraven667.workers.dev`). A custom domain would replace it: change `SITE_URL` in `shared/site.ts` and add the domain to Firebase's authorized domains and the CSP `frame-src` if the auth domain changes.
- **Preview URLs are public** to anyone with the link.
- **Previews use the production D1**, so votes cast on a preview are real. Schema migrations run only on production deploys. In the README.
- **Each preview branch needs its own Firebase authorized domain** for sign-in. In the README.
- **`npm run deploy:preview` runs ingest**, so new posters get IDs in the local manifest. That change stays uncommitted; the production deploy commits it.
- **A shared `?q=` link may briefly show the newest poster**, written into the HTML, before the results replace it. A fix needs an inline script, which the CSP forbids.
- **Firebase Spark allows 5 email-link sign-in emails a day.** Past that, the dialog suggests Google. Testing email sign-in uses the quota.
- **On phones, "Sign in to vote" shortens the search placeholder** to "Search every word…".
- **Rate limits are approximate and per Cloudflare location**, and reads are keyed by IP, which Cloudflare advises against for stable keys; there's no better key for signed-out visitors. Fine for flood protection.
- **Titles built from filenames lose punctuation** ("Jehovahs Witness Vs …"). Proper titles need the sidecar metadata file (a Should-Have) or careful filenames.
- **A fresh clone must run `npm run ingest`** before `npm run dev` shows posters. Generated files aren't committed. In the README.
- **The `initial-checkin` and `create-mission-control` branches** still exist on GitHub (`initial-checkin` also locally). Harmless; delete whenever.
- **Tabbing past the last control in the sign-in dialog** reaches the browser's own toolbar before cycling back. That's native `<dialog>` behaviour; page content behind it stays unreachable.
