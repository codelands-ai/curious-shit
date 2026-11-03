// Poster card markup, shared by the build (the first card is written into index.html so it
// paints without waiting for JavaScript) and the browser (every other card).

import { POSTER_SIZES, type FeedFile, type FeedPoster } from "./poster.ts";
import { REACTIONS } from "./reactions.ts";

/**
 * Attributes for <link rel="preload"> of a poster's image: the format the <picture> will pick (AVIF if there
 * is one; browsers without AVIF skip a typed preload), at high priority. Marked data-poster-preload so
 * scripts/permalinks.ts can swap it per page.
 */
export function posterPreloadAttrs(poster: FeedPoster): Record<string, string> {
  const variants = [...(poster.avif?.length ? poster.avif : poster.src)].sort((a, b) => a.width - b.width);
  return {
    rel: "preload",
    as: "image",
    ...(poster.avif?.length ? { type: "image/avif" } : {}),
    href: variants[variants.length - 1]!.url,
    imagesrcset: srcset(variants),
    imagesizes: POSTER_SIZES,
    fetchpriority: "high",
    "data-poster-preload": "",
  };
}

export function attrsHtml(attrs: Record<string, string | number>): string {
  return Object.entries(attrs)
    .map(([k, v]) => (v === "" ? k : `${k}="${escape(String(v))}"`))
    .join(" ");
}

export function srcset(variants: FeedPoster["src"]): string {
  return [...variants]
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(", ");
}

export function cardHtml(poster: FeedPoster, first: boolean): string {
  const variants = [...poster.src].sort((a, b) => a.width - b.width);
  const img: Record<string, string | number> = {
    class: "exhibit__image",
    alt: poster.alt ?? poster.title,
    width: poster.width,
    height: poster.height,
    sizes: POSTER_SIZES,
    srcset: srcset(variants),
    src: variants[variants.length - 1]!.url,
    // The first poster is the LCP element: load it now, at high priority, and paint it as soon as it decodes.
    // Lazy images near the viewport still load early, so low priority keeps them out of its way.
    ...(first ? { loading: "eager", fetchpriority: "high" } : { loading: "lazy", fetchpriority: "low", decoding: "async" }),
  };
  const attrs = Object.entries(img)
    .map(([k, v]) => `${k}="${escape(String(v))}"`)
    .join(" ");
  const classes = first ? "exhibit is-lit is-still" : "exhibit";
  return (
    `<figure class="${classes}" data-poster-id="${escape(poster.id)}">` +
    `<figcaption class="exhibit__header"><div class="exhibit__label"><span class="exhibit__heading">${headingHtml(poster)}</span>${tagsHtml(poster)}</div>${reactionBarHtml()}</figcaption>` +
    // AVIF where supported (about 40% smaller), WebP everywhere else.
    // The poster opens the full-screen viewer (src/viewer.ts): focusable, with an accessible name.
    `<div class="exhibit__frame" role="button" tabindex="0" aria-label="View ${escape(poster.title)} full screen" aria-haspopup="dialog"><picture>` +
    (poster.avif?.length ? `<source type="image/avif" srcset="${escape(srcset(poster.avif))}" sizes="${escape(POSTER_SIZES)}">` : "") +
    `<img ${attrs}></picture></div>` +
    `</figure>`
  );
}

// Topic tags under the title; each links to that topic's filter (src/main.ts filters in place).
function tagsHtml(poster: FeedPoster): string {
  if (!poster.tags?.length) return "";
  const items = poster.tags.map((t) => `<li><a class="tag" href="/?tag=${encodeURIComponent(t.slug)}" data-tag="${escape(t.slug)}">${escape(t.name)}</a></li>`);
  return `<ul class="exhibit__tags" aria-label="Topics">${items.join("")}</ul>`;
}

/** The filter row under the top bar: "All", then every topic in use with its poster count. */
export function topicsHtml(tags: FeedFile["tags"]): string {
  if (tags.length === 0) return "";
  const link = (slug: string, label: string, count?: number) =>
    `<a class="topic" href="${slug ? `/?tag=${encodeURIComponent(slug)}` : "/"}" data-tag="${escape(slug)}"${slug ? "" : ' aria-current="true"'}>` +
    `${escape(label)}${count === undefined ? "" : `<span class="topic__count">${count}</span>`}</a>`;
  return [link("", "All"), ...tags.map((t) => link(t.slug, t.name, t.count))].join("");
}

// The title, with its last word and the share icon bound together so the icon never wraps onto a line alone.
function headingHtml(poster: FeedPoster): string {
  const words = poster.title.split(" ");
  const last = words.pop() ?? "";
  const lead = words.length ? `${escape(words.join(" "))} ` : "";
  return `<span class="exhibit__title">${lead}<span class="exhibit__last">${escape(last)}${shareButtonHtml(poster)}</span></span>`;
}

// A link icon next to the title; src/share.ts opens the share sheet or copies the poster's permalink.
function shareButtonHtml(poster: FeedPoster): string {
  return (
    `<button type="button" class="exhibit__share" aria-label="Share ${escape(poster.title)}">` +
    `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">` +
    `<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/>` +
    `</svg></button>`
  );
}

// The bar is part of the card from the start, invisible until counts load, so it never shifts the layout.
// src/reactions.ts attaches to it; if the API is down it simply stays invisible.
function reactionBarHtml(): string {
  const pills = REACTIONS.map(
    ({ key, emoji, label }) =>
      `<button type="button" class="pill" data-key="${key}" aria-pressed="false" aria-label="${escape(label)}">` +
      `<span class="pill__emoji" aria-hidden="true">${emoji}</span><span class="pill__count" aria-hidden="true">0</span></button>`,
  ).join("");
  return `<div class="reactions is-pending" role="group" aria-label="Reactions">${pills}</div>`;
}

export function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
