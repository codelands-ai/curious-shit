// Poster card markup, shared by the build (the first card is written into index.html so it
// paints without waiting for JavaScript) and the browser (every other card).

import { POSTER_SIZES, type FeedPoster } from "./poster.ts";

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
    `</figure>`
  );
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
