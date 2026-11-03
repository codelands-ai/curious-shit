# Curious Shit

A curiosity cabinet built for the scroll age: oversized landscape posters about deep time, dead religions and odd science, laid out like a never-ending gallery hallway with a search bar that reads every word on every image.

Live at https://curious-shit.smokeraven667.workers.dev

## Publishing a poster

1. Put the image in `posters/` (JPEG, PNG or WebP; landscape, at least 1.2 times wider than tall). The filename becomes the title: `geologic-time-scale.webp` → "Geologic Time Scale".
2. On an up-to-date `main`, run:

   ```sh
   npm run deploy
   ```

That's it. The deploy reads the poster's text (OCR), makes the AVIF and WebP images, rebuilds the search index, runs the tests, uploads everything, then commits the poster and its manifest entry and pushes them to `main`. It takes under a minute.

The deploy refuses to run if you're not on `main`, if `main` isn't in sync with GitHub, or if there are uncommitted changes outside `posters/` and `data/manifest.json`. Code changes go through pull requests; posters don't need one.

**Renaming** a poster keeps its ID and its reactions. **Don't rename and edit a poster in the same deploy**: it will look like a new poster and lose its reactions. **Removing** a file hides the poster; its ID is never reused, and putting the file back restores it.

### Fixing OCR mistakes

If search misses a word that's on a poster, put the poster's full text in a correction file next to it, named after the image: `posters/geologic-time-scale.ocr.txt`. It replaces the OCR text entirely. Rename it along with its poster.

Add a few words you can read on each new poster to `data/search-check.json`, then run `npm run check:search` to confirm search finds them. The PRD target is at least 90% of posters.

### Titles, alt text and topics

Give a poster a sidecar file next to it, named after the image, `posters/geologic-time-scale.yml`:

```yaml
title: Geologic Time Scale          # proper title, punctuation allowed (80 max)
alt: Chart of Earth's history by eon, era and period   # what a screen reader says (125 max)
tags: [deep-time, earth-science]    # topics, from data/tags.yml
description: Optional link-preview text for this poster (200 max)
```

All fields are optional. Tags must be listed in `data/tags.yml` (`slug: Display name`); add new topics there first. A typo fails the publish with a suggestion, and nothing is half-published. Changing a title never changes the poster's link or its reactions. Rename the sidecar along with its poster.

## Sharing a poster

Every poster has a permanent link, `/p/<id>` (for example `/p/geologic-time-scale`), which opens the gallery at that poster. The link icon after each title shares or copies it. Shared links show the poster's title and image in previews. A removed poster's link shows the 404 page. `sitemap.xml` lists every poster for search engines.

## Reading small print

Tapping a poster opens it full screen. Pinch, scroll or double-tap to zoom, drag to move around, and close with ×, Escape or Back. Zoom stops where more would only blur, at 2 screen pixels per image pixel, so a sharper original zooms further. Originals wider than 2400px get an extra zoom-only image of up to 4096px, which is downloaded only when someone opens the viewer.

## Trying changes before they go live

```sh
npm run deploy:preview
```

uploads the current branch to `https://<branch>-curious-shit.smokeraven667.workers.dev` without touching the live site. Two things to know:

- **Previews use the real reactions database.** Votes cast on a preview are real.
- **Sign-in on a preview** needs its address in Firebase: console → Security → Authentication → Settings → Authorized domains.

## Deleting someone's data

The privacy page promises deletion on request (to willt@codelands.ai). Find their user ID in the Firebase console (Authentication → Users), then:

```sh
npm run delete-user -- <uid>
```

That removes their reactions and fixes the counts. Then delete the account itself in the Firebase console.

## Local development

Needs Node 24 and Tesseract (`sudo apt install -y tesseract-ocr`).

```sh
npm install
npm run ingest            # posters → public/generated (needed after a fresh clone)
npm run dev               # the site at http://localhost:5173, without sign-in or reactions
```

For the full stack (sign-in and reactions) locally, use three terminals:

```sh
cp .dev.vars.example .dev.vars   # once: lets the local Worker accept emulator sign-ins
npm run emulators                # Firebase Auth emulator
npm run dev:api                  # reactions Worker + local database on :8787
npm run dev:emulator             # the site, signed in through the emulator
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Reactions Worker tests (one reaction per user per emoji, auth, rate limits) |
| `npm run typecheck` | TypeScript for the site and the Worker |
| `npm run check:search` | Search finds every poster by words read off it |
| `npm run bench:search` | Search speed with 1,000 synthetic posters |

## How it fits together

- **Site:** static files on Cloudflare (Workers static assets). No server rendering.
- **Reactions:** `/api/reactions` in the same Worker (`worker/`), with a Cloudflare D1 database that stores only reactions and Firebase user IDs.
- **Sign-in:** Firebase Authentication (Google and email link). The free plan sends at most 5 sign-in emails a day.
- **Search:** in the browser, over an index that ingest builds from filenames and OCR text.

Project docs live in `.claude/`: the PRD, the content model, the design standard and the working tracker (`00-mission-control.md`). `CLAUDE.md` has the stack and the hard rules.
