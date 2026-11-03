# Curious Shit — Content Model

The page has six sections, top to bottom, fed by two data records. Only Must-Have features are covered. Source of truth: the [PRD](PRD.md).

## 1. Search bar (pinned to the top)

| Field | Description | Constraints |
| --- | --- | --- |
| `site_name` | Wordmark | "Curious Shit". Small caps, text only for v1. |
| `search_input` | Free-text query box | Up to 100 characters. Results update about 150 ms after typing stops. The query is kept in the URL as `?q=` so searches can be shared. Placeholder in the museum-placard voice, e.g. "Search every word on every wall", 40 characters max. |
| `result_status` | Count shown while a search is active | Format: "N exhibits" ("1 exhibit"). Hidden when the box is empty. If the search index can't be loaded: "Search is closed for a moment. Shit happens." |
| `clear_control` | Resets the feed | Icon button with an accessible label. |
| `auth_control` | Sign-in or account button | Signed out: "Sign in to vote". Signed in: the user's initial on a square fixture, opening a menu with their name or email and "Sign out". |

## 2. Gallery feed (one poster card per image)

| Field | Description | Constraints |
| --- | --- | --- |
| `image` | The poster | Responsive AVIF (WebP fallback) at 2–3 widths via `<picture>` and `srcset`. Width and height set up front so the page doesn't jump. Landscape only (aspect ratio at least 1.2); anything else is rejected at build. Lazy-loaded except the first card, in batches of 8. |
| `alt` | Accessible description | 125 characters max. Defaults to the title; hand-written alt text comes later with the sidecar file. |
| `title` | Placard label above the image, in a header row with the reaction bar | Built from the filename: hyphens become spaces, title case. 80 characters max. Small caps, large and bright. |
| `share_control` | Link icon after the title | Opens the native share sheet on touch devices; elsewhere copies the poster's permalink and shows "Link copied" for 2 seconds. Accessible label "Share <title>". |
| `reaction_bar` | See section 3 | — |

The search fields `ocr_text` and `keywords` never appear on the card; they live only in the index.

## 3. Reaction bar (one per card)

| Field | Description | Constraints |
| --- | --- | --- |
| `reaction_types` | Fixed set of emoji | Seven keys, each with an emoji and a screen-reader label (see table below). One config file shared by the frontend and the Worker. |
| `count` (per type) | Total reactions | Whole number, shortened at 1,000 and up ("1.2k"). Always shown, including 0, to signed-in and signed-out visitors. |
| `user_state` (per type) | Whether the current user has reacted; tapping again removes it | Boolean, shown only when signed in, as a subtle highlight. |
| `signed_out_tap` | What a signed-out tap does | Opens the sign-in dialog. (Replaced the "Sign in to leave your mark" tooltip on 2026-11-02.) |

| Key | Emoji | Label |
| --- | --- | --- |
| `like` | 👍 | Like |
| `hate` | 👎 | Hate |
| `angry` | 😡 | Angry |
| `wtf` | 😳 | WTF |
| `mind_blown` | 🤯 | Mind-blown |
| `lol` | 😂 | LOL |
| `shit` | 💩 | Shit |

## 4. Feed status (bottom of the feed)

| Field | Description | Constraints |
| --- | --- | --- |
| `loading` | Shown while the next batch loads | Quiet animation, no text. |
| `end_of_feed` | Shown when a search runs out of results | One wry line, e.g. "You've reached the back wall." 50 characters max. The unfiltered feed loops, so it never shows there. |
| `no_results` | Shown when a search finds nothing | "Can't find any curious shit. Try something else." |
| `feed_unavailable` | Shown in place of the feed when the poster list can't be loaded | "The gallery is closed for a moment. Shit happens." |

## 5. Sign-in dialog

| Field | Description | Constraints |
| --- | --- | --- |
| `heading` | Dialog title | 30 characters max. "Sign in to vote"; "Check your email" after a link is sent; "Confirm your email" when a link is opened on another device. |
| `providers` | Sign-in options | Google (popup) and email magic link. Email links are capped at 5 a day on the free plan; past that the dialog says "Email sign-in is full for today. Try Google, or come back tomorrow." |
| `privacy_note` | What gets stored | "We keep only an anonymous ID. Your email stays with Google's Firebase." Links to `/privacy.html`. |

## 6. Reactions-unavailable state

When the Worker is down, reaction bars simply don't render and no message is shown. When Firebase is down, counts still show (they come from the Worker) and only sign-in fails, with a short error in the dialog.

## Permalink page (one per poster, at `/p/<id>`)

Static HTML written after the build (`scripts/permalinks.ts`), so link previews work without JavaScript.

| Field | Description | Constraints |
| --- | --- | --- |
| `page_title` | Tab title and preview title | "<title> · Curious Shit". |
| `preview` | Open Graph and Twitter card | The poster's `og` image (1200×630), the site description, canonical URL `/p/<id>`. |
| `start` | Where the hallway begins | That poster first, then the feed in its usual order, looping. |
| `gone` | A removed or unknown poster | The 404 page ("Nothing hangs here"), status 404. |

The site also publishes `sitemap.xml` (home plus every permalink) and `robots.txt`.

## Data record: Poster (static JSON index, written at build time)

| Field | Description | Constraints |
| --- | --- | --- |
| `id` | Stable key, also used in D1 | URL-safe slug. Assigned once in the manifest at first ingest and never changed, even if the file is renamed. |
| `title` | Display name | Built from the filename. 80 characters max. |
| `keywords` | Filename words | Lowercase, stop words removed. |
| `ocr_text` | Text read from the image | From OCR, or from the poster's correction file when one exists. Plain text, whitespace collapsed. Capped at about 5,000 characters per poster. |
| `src` | WebP variants | Paths for each width, e.g. 800, 1600 and 2400 pixels, plus the original width when it's under 2400. |
| `avif` | AVIF variants | Same widths as `src`; about 45% smaller. Browsers without AVIF use `src`. |
| `og` | Link-preview image | 1200×630 JPEG cropped from the top of the poster, named with a content hash. |
| `width` / `height` | Original size | Whole numbers, in pixels. |
| `added_at` | Publish date | ISO 8601, recorded in the manifest at first ingest. Feed shows newest first. |

## Data record: Reaction (D1 table)

| Field | Description | Constraints |
| --- | --- | --- |
| `poster_id` | Which poster | Must match a poster `id`. |
| `emoji` | Which reaction | Must be a key in `reaction_types`. |
| `uid` | Who reacted | Firebase user ID. |
| `created_at` | When | ISO 8601. |

The table is unique on (`poster_id`, `emoji`, `uid`). A second tap deletes the row.
