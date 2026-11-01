# Curious Shit

A curiosity cabinet built for the scroll age: oversized landscape posters about deep time, dead religions and odd science, laid out like a never-ending gallery hallway with a search bar that reads every word on every image.

Single-curator gallery. Only the owner publishes posters, through the repo and build. Visitors scroll, search the text inside every image, and sign in to react with emoji.

## Stack

| Layer          | Choice                                          | Constraints                                                                                                                                                                                                  |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hosting        | Cloudflare Workers static assets                | Serves all HTML, JS, images and the search index as static files, with no Worker script. No server rendering. Cloudflare's successor to Pages.                                                                 |
| Server code    | One Cloudflare Worker                           | The only server-side code. Handles reactions only: add, remove, counts. Rate-limited.                                                                                                                        |
| Database       | Cloudflare D1 (SQLite)                          | Reactions only, unique on (`poster_id`, `emoji`, `uid`). Poster content and OCR text never go in D1.                                                                                                         |
| Auth           | Firebase Authentication                         | Google and email magic link. The Worker verifies ID tokens against Google's public keys. Store nothing beyond the Firebase UID.                                                                              |
| OCR and ingest | Build-time script (Tesseract or similar)        | Runs in CI or locally, never in the browser or Worker. Rejects images with aspect ratio below 1.2. Assigns permanent IDs and publish dates in a manifest. A per-poster correction file overrides OCR output. |
| Search         | Client-side (MiniSearch or Pagefind)            | Searches a static JSON index of filename keywords and OCR text. No search service.                                                                                                                           |
| Images         | WebP at 2–3 widths, lazy-loaded in batches of 8 | Originals move from git to Cloudflare R2 past about 1 GB.                                                                                                                                                    |

Hard rules:

- Must run on Cloudflare and Firebase free tiers.
- If the Worker or Firebase is down, scrolling and search still work and reaction bars are hidden.
- Poster IDs never change after first ingest, even if the file is renamed. Reactions depend on them.
- No public upload path of any kind.

## Supporting documents

These are the source of truth. Follow them, and update them when a decision changes.

- `.claude/PRD.md`: vision, personas, prioritized features, success criteria.
- `.claude/content-model.md`: page sections, fields, data records and their constraints.
- `.claude/design-standard.md`: colors, type, spacing, texture, motion, and the CSS tokens. Use the tokens; never hard-code visual values.
