# Curious Shit — Design Standard

**Atmosphere:** A curiosity cabinet built for the scroll age: oversized landscape posters about deep time, dead religions and odd science, laid out like a never-ending gallery hallway with a search bar that reads every word on every image.

**In one line:** a museum after closing time. Dark walls, warm picture lights, quiet placards. The posters are the only color in the building; everything else steps back. The one exception is the reactions, which are allowed a small wink.

This is the reference for every visual decision. If something isn't covered here, choose the quieter option. All values are defined as CSS custom properties in [Tokens](#tokens); use the tokens, never raw values.

---

## 1. Colour palette

The site is **dark only**. There is no light mode; the hallway is always after hours. All colors are warm (tilted toward brown and amber), never blue-gray.

### Backgrounds

| Token | Hex | Use |
| --- | --- | --- |
| `--wall` | `#121110` | Page background. The gallery wall. |
| `--wall-deep` | `#0B0A09` | Vignette edges, and the solid fallback for the search bar when `backdrop-filter` is unsupported. |
| `--plinth` | `#1C1A17` | Raised surfaces: search input, sign-in dialog, reaction pills at rest, image placeholders while loading. |
| `--plinth-raised` | `#26231F` | Hover state of any `--plinth` surface. |
| `--rule` | `#34302A` | 1px borders and dividers. The only line color. |

### Text

| Token | Hex | Contrast on `--wall` | Use |
| --- | --- | --- | --- |
| `--text-primary` | `#E8E1D3` | ~14:1 | Wordmark, input text, dialog headings, prose. Bone or old paper, never pure white. |
| `--text-secondary` | `#A39A8A` | ~6.7:1 | Placard titles, reaction counts, result status, `auth_control` label. |
| `--text-faint` | `#847D71` | ~4.6:1 | Placeholders, disabled states, end-of-feed and no-results lines. Never smaller than 14px. |

### Accents

| Token | Value | Use |
| --- | --- | --- |
| `--brass` | `#C9A15B` | The only accent. Focus rings, the count of a reaction the user has made, links, the loading dot. Never a fill larger than a 32px pill, never on a poster. |
| `--brass-dim` | `#8A6F3F` | Border of an active reaction pill. |
| `--brass-wash` | `rgba(201, 161, 91, 0.10)` | Background of an active reaction pill. |
| `--spot` | `rgba(255, 214, 160, 0.06)` | The picture-light glow behind each poster (see Texture). Rises to `--spot-hover` `rgba(255, 214, 160, 0.10)` on hover. |
| `--oxblood` | `#B5523B` | Errors only, such as a failed sign-in. Text and 1px borders, never a fill. |

**Rules**

- No pure black (`#000`) or pure white (`#FFF`) anywhere except inside shadows.
- No second accent. If something needs emphasis and brass is already used nearby, use `--text-primary` instead.
- Emoji keep their native colors. They are the wink.

---

## 2. Typography

Three families, all from Google Fonts, loaded with `display=swap` and Latin subset only.

| Role | Family | Weights | Where |
| --- | --- | --- | --- |
| Display | **Cormorant Garamond** | 500, 600 | Wordmark, dialog heading, privacy page headings. |
| Placard | **Cormorant SC** (true small caps) | 500 | Poster titles, result status ("12 exhibits"). Never set with fake small caps via `font-variant`. |
| Interface | **IBM Plex Sans** | 400, 500 | Search input, buttons, reaction counts, prose body, all other text. |

Fallback stacks: `"Cormorant Garamond", Georgia, serif`, `"Cormorant SC", Georgia, serif`, `"IBM Plex Sans", system-ui, sans-serif`.

### Type scale

Base 16px, ratio 1.25 (major third). Sizes are rounded to whole pixels and set in `rem`.

| Token | Size | Family / weight | Line height | Letter spacing | Use |
| --- | --- | --- | --- | --- | --- |
| `--fs-h1` | 39px / 2.441rem | Cormorant Garamond 600 | 1.15 | -0.01em | Privacy page title. |
| `--fs-h2` | 31px / 1.953rem | Cormorant Garamond 600 | 1.15 | -0.01em | Dialog heading, privacy page sections. |
| `--fs-h3` | 25px / 1.563rem | Cormorant Garamond 500 | 1.2 | 0 | Privacy page subsections. |
| `--fs-wordmark` | 25px / 1.563rem | Cormorant SC 500 | 1 | 0.12em | "Curious Shit" in the search bar. |
| `--fs-placard` | 20px / 1.25rem | Cormorant SC 500 | 1.3 | 0.08em | Poster titles. 16px below 768px. |
| `--fs-body` | 16px / 1rem | IBM Plex Sans 400 | 1.6 | 0 | Prose, search input, dialog body. |
| `--fs-small` | 14px / 0.875rem | IBM Plex Sans 400 or 500 | 1.4 | 0.01em | Reaction counts (500), result status, feed status lines, privacy note. |
| `--fs-micro` | 12px / 0.75rem | IBM Plex Sans 500 | 1.3 | 0.06em, uppercase | Tooltips and screen-reader-visible labels only. Never for content. |

**Rules**

- Counts and any changing numbers use `font-variant-numeric: tabular-nums` so pills don't jitter.
- Prose (privacy page, dialog body) is capped at `max-width: 65ch`.
- Never bold Cormorant above 600 or Plex above 500. Weight is not how this site shouts; it doesn't shout.
- No italics in the interface. Italics are allowed only inside privacy page prose for emphasis.

---

## 3. Spacing

**Philosophy:** tight within an exhibit, generous between exhibits. A poster, its placard and its reactions read as one object; the space between posters is the walk down the hallway and should feel like it.

**Base unit: 4px.** Every margin, padding, gap and fixed height is a value from this scale:

| Token | Value |
| --- | --- |
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-12` | 48px |
| `--space-16` | 64px |
| `--space-24` | 96px |
| `--space-32` | 128px |

### Breakpoints

`--bp-md: 768px`, `--bp-lg: 1280px`. Mobile first.

### Standard values

| Element | Below 768px | 768–1279px | 1280px and up |
| --- | --- | --- | --- |
| Page side gutter | 16px | 32px | 64px |
| Poster max width | full width minus gutters | full width minus gutters | 1600px, centered |
| Gap between exhibits | 64px | 96px | 128px |
| Space above first exhibit (below search bar) | 32px | 48px | 64px |
| Image to placard title | 12px | 16px | 16px |
| Placard title to reaction bar | 8px | 8px | 8px |

| Component | Value |
| --- | --- |
| Search bar strip | 64px tall, full viewport width, input centered with `max-width: 560px`. Wordmark left-aligned at the page gutter; `auth_control` right-aligned at the page gutter. Below 768px the wordmark hides and the input fills the space between gutter and `auth_control`. |
| Search input | 40px tall, padding `0 16px`, 1px `--rule` border. |
| Reaction pill | 32px tall, padding `0 12px`, 4px between emoji and count, 8px between pills. Pills wrap onto a second row on narrow screens; they never scroll horizontally. |
| Sign-in dialog | `max-width: 400px`, padding 32px (24px below 768px), 24px between stacked elements, buttons 44px tall. |
| Minimum touch target | 44 × 44px. A 32px pill gets its target from invisible padding. |

### Corners

| Element | Radius |
| --- | --- |
| Posters | 0. They are prints on a wall. |
| Search input, dialog, buttons | 2px. Almost square, like museum fixtures. |
| Reaction pills | 999px (fully round). The only round thing on the page, on purpose. |

---

## 4. Texture and atmosphere

Five effects carry the world. Use exactly these, and add no others.

### 4.1 Film grain

A fixed, full-viewport overlay above everything, including posters.

- Source: an inline SVG `feTurbulence` noise (`baseFrequency="0.8"`, `numOctaves="3"`, `stitchTiles="stitch"`) as a `background-image` on `body::after`.
- `opacity: 0.04`, `mix-blend-mode: overlay`, `pointer-events: none`, `position: fixed`, `inset: 0`, `z-index` above content but below the dialog.
- Static, never animated.

### 4.2 Vignette

The hallway darkens at its edges.

- `body::before`, fixed, full viewport, `pointer-events: none`, behind content.
- `background: radial-gradient(ellipse 120% 90% at 50% 40%, transparent 55%, rgba(11, 10, 9, 0.55) 100%);`

### 4.3 Picture light (per poster)

Each poster has a warm glow behind its top edge, as if lit by a brass picture lamp.

- A pseudo-element behind the image, extending 48px past it on the top, left and right.
- `background: radial-gradient(ellipse 70% 60% at 50% 0%, var(--spot), transparent 70%);`
- Fades in when the poster enters the viewport (see Interactions) and brightens to `--spot-hover` on hover.

### 4.4 Poster shadow

Posters hang off the wall slightly.

- `box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4), 0 24px 48px -12px rgba(0, 0, 0, 0.6);`
- No border, no outline, no frame.

### 4.5 Search bar glass

The only blurred surface on the site.

- `background: rgba(18, 17, 16, 0.72); backdrop-filter: blur(12px) saturate(0.8);` with a 1px `--rule` bottom border.
- Fallback when `backdrop-filter` is unsupported: solid `--wall-deep`.

### Not allowed

Colored or glowing shadows, gradients on buttons or text, glassmorphism anywhere except the search bar, animated grain, parallax, decorative illustrations or borders, skeleton shimmer.

### Loading placeholder

While an image loads, its box is filled with `--plinth` at the image's exact aspect ratio (from `width`/`height` in the index). No shimmer.

---

## 5. Interactions

**Emotional quality:** measured and unhurried, like a docent walking you through the rooms. Things settle into place rather than arrive. Nothing bounces, slides in from offscreen or calls attention to itself, except the reaction tap, which gets one small, cheeky overshoot.

### Timing

| Token | Duration | Use |
| --- | --- | --- |
| `--dur-fast` | 120ms | Color and background changes on hover; count number change. |
| `--dur-base` | 200ms | Focus rings, dialog open, search results fading in. |
| `--dur-exit` | 150ms | Anything leaving: dialog close, old search results fading out. |
| `--dur-slow` | 400ms | Poster entrance, picture-light hover change. |
| `--dur-lights` | 700ms | Picture light fading up. |

### Easing

| Token | Curve | Use |
| --- | --- | --- |
| `--ease-settle` | `cubic-bezier(0.2, 0, 0, 1)` | Default for everything entering or changing. Fast start, long soft landing. |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Anything leaving. |
| `--ease-wink` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Reaction tap only. The only overshoot on the site. |

Never use `linear` (except the loading dot) or the browser default `ease`.

### Behaviors

**Poster entrance** (once per poster, never on scroll back up)

- Triggered when 15% of the poster enters the viewport (`IntersectionObserver`, `threshold: 0.15`).
- Image: `opacity 0 → 1` and `translateY(16px) → 0` over `--dur-slow`, `--ease-settle`.
- Picture light: `opacity 0 → 1` over `--dur-lights`, starting 100ms after the image. The lights come up as you approach.
- The first poster on page load skips the animation and appears immediately, so it doesn't delay LCP.

**Poster hover** (pointer devices only, inside `@media (hover: hover)`)

- The picture light brightens from `--spot` to `--spot-hover` over `--dur-slow`.
- No scale, zoom, lift or cursor change. The poster itself never moves.

**Placard title:** no hover state.

**Reaction pill**

- Hover: background `--plinth` → `--plinth-raised`, count color `--text-secondary` → `--text-primary`, over `--dur-fast`, `--ease-settle`.
- Tap (adding): the emoji scales `1 → 1.18 → 1` over 240ms with `--ease-wink`; the pill switches to active state immediately (optimistic update) over `--dur-fast`.
- Tap (removing): no wink. The pill returns to rest over `--dur-fast`.
- Active state: background `--brass-wash`, 1px `--brass-dim` border, count in `--brass`.
- Count change: the old number fades out and the new one in over `--dur-fast`. No counting-up animation.
- Signed out: tapping shows `signed_out_prompt` as a tooltip above the pill, which fades in over `--dur-base` and stays for 3 seconds.

**Search**

- Input focus: border `--rule` → `--brass` over `--dur-base`. No glow.
- New results: the current feed fades out over `--dur-exit`, the page jumps instantly to the top of the feed (no smooth scroll), and the results fade in over `--dur-base`. Results don't use the entrance animation.
- Clearing the search uses the same transition back to the full feed.

**Sign-in dialog**

- Open: backdrop fades to `rgba(11, 10, 9, 0.7)`, and the panel goes `opacity 0 → 1` and `translateY(8px) → 0`, over `--dur-base`, `--ease-settle`.
- Close: the reverse, over `--dur-exit`, `--ease-exit`.

**Loading indicator:** a single 6px `--brass` dot, centered below the last poster, pulsing opacity `0.3 ↔ 1` over 1.6s, `linear`, infinite.

**Focus:** every focusable element uses `outline: 2px solid var(--brass); outline-offset: 3px;` on `:focus-visible` only. Never remove focus outlines.

### Reduced motion

Under `@media (prefers-reduced-motion: reduce)`:

- No translate, scale or wink. Opacity changes only.
- Posters and picture lights appear at full opacity with no entrance animation.
- The loading dot stays at opacity 1 without pulsing.
- Grain and vignette remain, since they are static.

---

## Tokens

Copy this block into the root stylesheet as-is.

```css
:root {
  color-scheme: dark;

  /* Colour */
  --wall: #121110;
  --wall-deep: #0B0A09;
  --plinth: #1C1A17;
  --plinth-raised: #26231F;
  --rule: #34302A;
  --text-primary: #E8E1D3;
  --text-secondary: #A39A8A;
  --text-faint: #847D71;
  --brass: #C9A15B;
  --brass-dim: #8A6F3F;
  --brass-wash: rgba(201, 161, 91, 0.10);
  --spot: rgba(255, 214, 160, 0.06);
  --spot-hover: rgba(255, 214, 160, 0.10);
  --oxblood: #B5523B;

  /* Type */
  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-placard: "Cormorant SC", Georgia, serif;
  --font-ui: "IBM Plex Sans", system-ui, sans-serif;
  --fs-h1: 2.441rem;
  --fs-h2: 1.953rem;
  --fs-h3: 1.563rem;
  --fs-wordmark: 1.563rem;
  --fs-placard: 1.25rem;
  --fs-body: 1rem;
  --fs-small: 0.875rem;
  --fs-micro: 0.75rem;

  /* Space */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
  --space-32: 128px;
  --gutter: var(--space-4);
  --exhibit-gap: var(--space-16);
  --poster-max: 1600px;
  --radius-fixture: 2px;
  --radius-pill: 999px;

  /* Motion */
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-exit: 150ms;
  --dur-slow: 400ms;
  --dur-lights: 700ms;
  --ease-settle: cubic-bezier(0.2, 0, 0, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-wink: cubic-bezier(0.34, 1.56, 0.64, 1);
}

@media (min-width: 768px) {
  :root { --gutter: var(--space-8); --exhibit-gap: var(--space-24); }
}

@media (min-width: 1280px) {
  :root { --gutter: var(--space-16); --exhibit-gap: var(--space-32); }
}

body {
  background: var(--wall);
  color: var(--text-primary);
  font: 400 var(--fs-body)/1.6 var(--font-ui);
}
```
