// The endless gallery feed: renders posters in batches of 8 and loops back to the newest.

import { FEED_URL, type FeedPoster } from "../shared/poster.ts";

const BATCH_SIZE = 8;
const FEED_UNAVAILABLE = "The gallery is closed for a moment. Shit happens.";

// Rendered image width: full width minus gutters (16/32/64px), capped at --poster-max.
const SIZES = "(min-width: 1280px) min(calc(100vw - 128px), 1600px), (min-width: 768px) calc(100vw - 64px), calc(100vw - 32px)";

export async function startGallery(feed: HTMLElement, status: HTMLElement): Promise<void> {
  let posters: FeedPoster[];
  try {
    posters = await loadFeed();
  } catch (err) {
    console.error("Couldn't load the feed", err);
    showLine(status, FEED_UNAVAILABLE);
    return;
  }
  if (posters.length === 0) return;

  let next = 0;
  let rendered = 0;

  const entrance = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-lit");
        entrance.unobserve(entry.target);
      }
    },
    { threshold: 0.15 },
  );

  const appendBatch = (): void => {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < BATCH_SIZE; i++) {
      const card = createCard(posters[next]!, rendered === 0);
      if (rendered === 0) card.classList.add("is-first", "is-lit");
      else entrance.observe(card);
      fragment.append(card);
      next = (next + 1) % posters.length;
      rendered++;
    }
    feed.append(fragment);
  };

  // The loading dot doubles as the sentinel: when it comes within a screen of view, add a batch.
  const dot = document.createElement("div");
  dot.className = "feed-status__dot";
  status.replaceChildren(dot);

  const nearBottom = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      appendBatch();
      // Re-observe so a still-visible sentinel fires again after the batch lays out.
      nearBottom.unobserve(dot);
      nearBottom.observe(dot);
    },
    { rootMargin: "0px 0px 100% 0px" },
  );

  appendBatch();
  nearBottom.observe(dot);
}

async function loadFeed(): Promise<FeedPoster[]> {
  const response = await fetch(FEED_URL);
  if (!response.ok) throw new Error(`${FEED_URL} returned ${response.status}`);
  const data = (await response.json()) as { posters?: FeedPoster[] };
  if (!Array.isArray(data.posters)) throw new Error(`${FEED_URL} has no posters array`);
  return data.posters;
}

function createCard(poster: FeedPoster, first: boolean): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "exhibit";
  figure.dataset.posterId = poster.id;

  const frame = document.createElement("div");
  frame.className = "exhibit__frame";

  const img = document.createElement("img");
  img.className = "exhibit__image";
  img.alt = poster.title;
  img.width = poster.width;
  img.height = poster.height;
  img.decoding = "async";
  if (first) {
    img.loading = "eager";
    img.fetchPriority = "high";
  } else {
    img.loading = "lazy";
  }
  const variants = [...poster.src].sort((a, b) => a.width - b.width);
  img.sizes = SIZES;
  img.srcset = variants.map((v) => `${v.url} ${v.width}w`).join(", ");
  img.src = variants[variants.length - 1]!.url;

  const caption = document.createElement("figcaption");
  caption.className = "exhibit__title";
  caption.textContent = poster.title;

  frame.append(img);
  figure.append(frame, caption);
  return figure;
}

function showLine(status: HTMLElement, text: string): void {
  const line = document.createElement("p");
  line.className = "feed-status__line";
  line.textContent = text;
  status.replaceChildren(line);
}
