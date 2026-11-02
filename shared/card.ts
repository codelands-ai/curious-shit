// Poster card markup, shared by the build (the first card is written into index.html so it
// paints without waiting for JavaScript) and the browser (every other card).

import { POSTER_SIZES, type FeedPoster } from "./poster.ts";
import { REACTIONS } from "./reactions.ts";

export function cardHtml(poster: FeedPoster, first: boolean): string {
  const variants = [...poster.src].sort((a, b) => a.width - b.width);
  const img: Record<string, string | number> = {
    class: "exhibit__image",
    alt: poster.title,
    width: poster.width,
    height: poster.height,
    sizes: POSTER_SIZES,
    srcset: variants.map((v) => `${v.url} ${v.width}w`).join(", "),
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
    `<div class="exhibit__frame"><img ${attrs}></div>` +
    `<figcaption class="exhibit__title">${escape(poster.title)}</figcaption>` +
    reactionBarHtml() +
    `</figure>`
  );
}

// The bar is part of the card from the start, invisible until counts load, so it never shifts the layout.
// src/reactions.ts attaches to it; if the API is down it simply stays invisible.
function reactionBarHtml(): string {
  const pills = REACTIONS.map(
    ({ key, emoji, label }) =>
      `<button type="button" class="pill" data-key="${key}" aria-pressed="false" aria-label="${escape(label)}">` +
      `<span class="pill__emoji" aria-hidden="true">${emoji}</span><span class="pill__count" aria-hidden="true" hidden></span></button>`,
  ).join("");
  return `<div class="reactions is-pending" role="group" aria-label="Reactions">${pills}</div>`;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
