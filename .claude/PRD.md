# Curious Shit — Product Requirements

Nov 1, 2026 · @Will Thompson

## Vision

A curiosity cabinet built for the scroll age: oversized landscape posters about deep time, dead religions and odd science, laid out like a never-ending gallery hallway with a search bar that reads every word on every image.

Curious Shit is a single-curator gallery. Only the owner publishes posters; visitors scroll, search the text inside every image, and react with emoji.

## User Personas

| Persona | Who they are | What they need |
| --- | --- | --- |
| The Curator | The site owner and sole publisher | Adding a poster takes one step, and OCR and indexing happen without manual work |
| The Drifter | Arrives from a shared link and scrolls with no goal | Fast-loading, full-width images and an endless feed that never dead-ends |
| The Hunter | Remembers a phrase or topic from a poster | A search bar always on screen that finds posters by any word printed on them |
| The Reactor | A returning visitor who signs in to react | One-tap emoji reactions and visible counts from other visitors |

## Feature List

### Must-Have

- **Static gallery on Cloudflare (Workers static assets):** a continuous vertical scroll of full-width landscape posters that lazy-loads the next batch of 8.
- **Build-time ingest pipeline:** for each new image, reject it with a clear error if its aspect ratio is below 1.2, assign a permanent ID and publish date in a manifest file, extract keywords from the filename, run OCR, generate WebP variants at 2–3 widths, and write everything to a static JSON search index.
- **OCR correction file:** an optional hand-edited plain-text file per poster that replaces its OCR output in the index.
- **Always-visible search bar:** client-side full-text search over filenames and OCR text, with results filtering the scroll in place.
- **Firebase Authentication:** visitors sign in with Google or an email magic link to react; browsing and searching need no account.
- **Reactions endpoint (Cloudflare Worker + D1):** verifies the Firebase ID token, adds a reaction on first tap and removes it on second, allows one reaction per user per emoji per image, and returns counts per image.
- **Fixed reaction set:** seven reactions, shown with live counts under each poster: like 👍, hate 👎, angry 😡, wtf 😳, mind-blown 🤯, lol 😂 and shit 💩.
- **Owner-only publishing:** new posters are added only by the owner through the repo and build, with no public upload path.
- **Rate limiting on the Worker** to block scripted reaction floods.
- **Privacy page:** one short page stating that only the Firebase user ID is stored and email addresses stay with Firebase.

### Should-Have

- A permalink for each poster that opens it in the scroll, with Open Graph tags for link previews.
- Topic tags from a sidecar metadata file, usable as search filters.
- A full-screen view with zoom for reading small print on posters.
- Search terms kept in the URL so searches can be shared.

### Nice-to-Have

- Sort by most-reacted or by a single emoji ("most wtf").
- A random-poster button.
- An admin page for the owner to correct OCR text without a rebuild.
- An RSS feed of new posters.

## Technical Constraints

- **Hosting:** Cloudflare Workers static assets (the successor to Pages) serves all HTML, JS, images and the search index with no script; a single reactions Worker is the only server-side code.
- **Data:** D1 (SQLite) holds only reactions, keyed by image ID, emoji and Firebase user ID with a unique constraint. Poster content and OCR text are never stored in D1.
- **OCR runs at build time** (Tesseract or similar) in CI or on the owner's machine, never in the browser or the Worker.
- **Auth:** Firebase Auth issues identities, and the Worker verifies ID tokens against Google's public keys. No user data is stored beyond the Firebase UID.
- **Search is client-side**, using MiniSearch or Pagefind over the static index, with no server-side search service.
- **Graceful degradation:** if the Worker or Firebase is down, scrolling and search still work and reactions are hidden.
- **Cost:** must run on Cloudflare and Firebase free tiers at launch.
- **Image storage:** originals move from git to Cloudflare R2 once the collection passes about 1 GB.

## Design Standard

A dim, museum-after-hours hallway: dark walls, warm spot-lit posters, and generous space between exhibits so each image reads as its own discovery. The posters are the only color on the page; interface chrome stays muted, with small-caps museum-placard labels and a slim search bar that feels like a docent's desk rather than an app toolbar. Reactions are small and a little irreverent, a wink in a serious room.

## Success Criteria

- Adding a poster takes one command, and it is live and searchable within 5 minutes.
- Searching any distinct word visible on a poster returns that poster for at least 90% of posters.
- Search results appear in under 200 ms with 1,000 posters indexed.
- The first poster is visible in under 2.5 seconds (LCP) on a mid-range phone over 4G.
- Each signed-in user can hold only one of each emoji per poster, verified by tests against the Worker.
- Running costs stay at $0 a month through the first 1,000 posters and 10,000 monthly visitors.

## Content Model

The page has six sections, top to bottom, fed by two data records. Only Must-Have features are covered.

### 1. Search bar (pinned to the top)

| Field | Description | Constraints |
| --- | --- | --- |
| `site_name` | Wordmark | "Curious Shit". Small caps, text only for v1. |
| `search_input` | Free-text query box | Up to 100 characters. Results update about 150 ms after typing stops. Placeholder in the museum-placard voice, e.g. "Search every word on every wall", 40 characters max. |
| `result_status` | Count shown while a search is active | Format: "N exhibits". Hidden when the box is empty. |
| `clear_control` | Resets the feed | Icon button with an accessible label. |
| `auth_control` | Sign-in or account button | Signed out: "Sign in to react". Signed in: avatar or initial, plus sign-out. |

### 2. Gallery feed (one poster card per image)

| Field | Description | Constraints |
| --- | --- | --- |
| `image` | The poster | Responsive WebP at 2–3 widths via `srcset`. Width and height set up front so the page doesn't jump. Landscape only (aspect ratio at least 1.2); anything else is rejected at build. Lazy-loaded except the first card. |
| `alt` | Accessible description | 125 characters max. Defaults to the title; hand-written alt text comes later with the sidecar file. |
| `title` | Placard label under the image | Built from the filename: hyphens become spaces, title case. 80 characters max. Small caps, muted. |
| `reaction_bar` | See section 3 | — |

The search fields `ocr_text` and `keywords` never appear on the card; they live only in the index.

### 3. Reaction bar (one per card)

| Field | Description | Constraints |
| --- | --- | --- |
| `reaction_types` | Fixed set of emoji | Seven keys, each with an emoji and a screen-reader label: like, hate, angry, wtf, mind-blown, lol, shit. One config file shared by the frontend and the Worker. |
| `count` (per type) | Total reactions | Whole number, shortened at 1,000 and up ("1.2k"). Hidden when zero. |
| `user_state` (per type) | Whether the current user has reacted; tapping again removes it | Boolean, shown only when signed in, as a subtle highlight. |
| `signed_out_prompt` | Shown when a signed-out user taps an emoji | One line, e.g. "Sign in to leave your mark". 40 characters max. |

### 4. Feed status (bottom of the feed)

| Field | Description | Constraints |
| --- | --- | --- |
| `loading` | Shown while the next batch loads | Quiet animation, no text. |
| `end_of_feed` | Shown when a search runs out of results | One wry line, e.g. "You've reached the back wall." 50 characters max. The unfiltered feed loops, so it never shows there. |
| `no_results` | Shown when a search finds nothing | One line plus a suggestion. 80 characters max. |

### 5. Sign-in dialog

| Field | Description | Constraints |
| --- | --- | --- |
| `heading` | Dialog title | 30 characters max. |
| `providers` | Sign-in options | Google and email magic link. |
| `privacy_note` | What gets stored | One sentence: only an anonymous ID is kept. Links to the privacy page. |

### 6. Reactions-unavailable state

When the Worker or Firebase is down, reaction bars simply don't render and no message is shown, per the graceful-degradation constraint.

### Data record: Poster (static JSON index, written at build time)

| Field | Description | Constraints |
| --- | --- | --- |
| `id` | Stable key, also used in D1 | URL-safe slug. Assigned once in the manifest at first ingest and never changed, even if the file is renamed. |
| `title` | Display name | Built from the filename. 80 characters max. |
| `keywords` | Filename words | Lowercase, stop words removed. |
| `ocr_text` | Text read from the image | From OCR, or from the poster's correction file when one exists. Plain text, whitespace collapsed. Capped at about 5,000 characters per poster. |
| `src` | Image variants | Paths for each width, e.g. 800, 1600 and 2400 pixels. |
| `width` / `height` | Original size | Whole numbers, in pixels. |
| `added_at` | Publish date | ISO 8601, recorded in the manifest at first ingest. Feed shows newest first. |

### Data record: Reaction (D1 table)

| Field | Description | Constraints |
| --- | --- | --- |
| `poster_id` | Which poster | Must match a poster `id`. |
| `emoji` | Which reaction | Must be a key in `reaction_types`. |
| `uid` | Who reacted | Firebase user ID. |
| `created_at` | When | ISO 8601. |

The table is unique on (`poster_id`, `emoji`, `uid`).

## Decisions

All ten gaps found while mapping the content model are resolved as follows; the Must-Have list and content model above reflect them.

1. **Stable poster IDs:** a manifest file fixes each poster's ID at first ingest, so renames never orphan reactions.
2. **Alt text:** the title serves as alt text for now; hand-written alt text arrives with the sidecar file (Should-Have).
3. **Reaction set:** like 👍, hate 👎, angry 😡, wtf 😳, mind-blown 🤯, lol 😂, shit 💩.
4. **Feed order:** newest first, by the `added_at` date recorded in the manifest.
5. **Removing a reaction:** a second tap removes it; the Worker supports add and remove.
6. **Email sign-in:** magic link, no passwords.
7. **Privacy page:** added as a Must-Have.
8. **Feed batch size:** 8 posters.
9. **Non-landscape images:** rejected at build with a clear error.
10. **OCR correction:** an optional per-poster text file overrides OCR output, added as a Must-Have.
