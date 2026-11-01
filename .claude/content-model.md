# Curious Shit — Content Model

The page has six sections, top to bottom, fed by two data records. Only Must-Have features are covered. Source of truth: the [PRD](https://claude.ai/artifact/93uDkxQHT25FBAzsKhvTKm).

## 1. Search bar (pinned to the top)

| Field | Description | Constraints |
| --- | --- | --- |
| `site_name` | Wordmark | "Curious Shit". Small caps, text only for v1. |
| `search_input` | Free-text query box | Up to 100 characters. Results update about 150 ms after typing stops. Placeholder in the museum-placard voice, e.g. "Search every word on every wall", 40 characters max. |
| `result_status` | Count shown while a search is active | Format: "N exhibits". Hidden when the box is empty. |
| `clear_control` | Resets the feed | Icon button with an accessible label. |
| `auth_control` | Sign-in or account button | Signed out: "Sign in to react". Signed in: avatar or initial, plus sign-out. |

## 2. Gallery feed (one poster card per image)

| Field | Description | Constraints |
| --- | --- | --- |
| `image` | The poster | Responsive WebP at 2–3 widths via `srcset`. Width and height set up front so the page doesn't jump. Landscape only (aspect ratio at least 1.2); anything else is rejected at build. Lazy-loaded except the first card, in batches of 8. |
| `alt` | Accessible description | 125 characters max. Defaults to the title; hand-written alt text comes later with the sidecar file. |
| `title` | Placard label under the image | Built from the filename: hyphens become spaces, title case. 80 characters max. Small caps, muted. |
| `reaction_bar` | See section 3 | — |

The search fields `ocr_text` and `keywords` never appear on the card; they live only in the index.

## 3. Reaction bar (one per card)

| Field | Description | Constraints |
| --- | --- | --- |
| `reaction_types` | Fixed set of emoji | Seven keys, each with an emoji and a screen-reader label (see table below). One config file shared by the frontend and the Worker. |
| `count` (per type) | Total reactions | Whole number, shortened at 1,000 and up ("1.2k"). Hidden when zero. |
| `user_state` (per type) | Whether the current user has reacted; tapping again removes it | Boolean, shown only when signed in, as a subtle highlight. |
| `signed_out_prompt` | Shown when a signed-out user taps an emoji | One line, e.g. "Sign in to leave your mark". 40 characters max. |

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
| `no_results` | Shown when a search finds nothing | One line plus a suggestion. 80 characters max. |

## 5. Sign-in dialog

| Field | Description | Constraints |
| --- | --- | --- |
| `heading` | Dialog title | 30 characters max. |
| `providers` | Sign-in options | Google and email magic link. |
| `privacy_note` | What gets stored | One sentence: only an anonymous ID is kept. Links to the privacy page. |

## 6. Reactions-unavailable state

When the Worker or Firebase is down, reaction bars simply don't render and no message is shown, per the graceful-degradation constraint.

## Data record: Poster (static JSON index, written at build time)

| Field | Description | Constraints |
| --- | --- | --- |
| `id` | Stable key, also used in D1 | URL-safe slug. Assigned once in the manifest at first ingest and never changed, even if the file is renamed. |
| `title` | Display name | Built from the filename. 80 characters max. |
| `keywords` | Filename words | Lowercase, stop words removed. |
| `ocr_text` | Text read from the image | From OCR, or from the poster's correction file when one exists. Plain text, whitespace collapsed. Capped at about 5,000 characters per poster. |
| `src` | Image variants | Paths for each width, e.g. 800, 1600 and 2400 pixels. |
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
