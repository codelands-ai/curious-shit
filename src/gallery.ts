// The gallery feed: renders posters in batches of 8. The full feed loops forever;
// search results are a finite list that ends at the back wall.

import { FEED_URL, type FeedPoster } from "../shared/poster.ts";

const BATCH_SIZE = 8;

export const LINES = {
  feedUnavailable: "The gallery is closed for a moment. Shit happens.",
  endOfResults: "You've reached the back wall.",
  noResults: "Can't find any curious shit. Try something else.",
};

// Rendered image width: full width minus gutters (16/32/64px), capped at --poster-max.
const SIZES = "(min-width: 1280px) min(calc(100vw - 128px), 1600px), (min-width: 768px) calc(100vw - 64px), calc(100vw - 32px)";

export interface ShowOptions {
  /** Start over from the top after the last poster (full feed only). */
  loop: boolean;
  /** Fade posters in as they scroll into view (full feed only; results skip it). */
  entrance: boolean;
  /** Line shown when the list is empty. */
  emptyLine?: string;
}

export class Gallery {
  private posters: FeedPoster[] = [];
  private options: ShowOptions = { loop: true, entrance: true };
  private next = 0;
  private rendered = 0;
  private readonly dot = document.createElement("div");
  private readonly entrance: IntersectionObserver;
  private readonly nearBottom: IntersectionObserver;

  constructor(
    private readonly feed: HTMLElement,
    private readonly status: HTMLElement,
  ) {
    this.dot.className = "feed-status__dot";

    this.entrance = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-lit");
          this.entrance.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );

    // The loading dot doubles as the sentinel: when it comes within a screen of view, add a batch.
    this.nearBottom = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.appendBatch();
        // Re-observe so a still-visible sentinel fires again after the batch lays out.
        if (this.hasMore()) {
          this.nearBottom.unobserve(this.dot);
          this.nearBottom.observe(this.dot);
        }
      },
      { rootMargin: "0px 0px 100% 0px" },
    );
  }

  /** Replace whatever is showing with these posters. */
  show(posters: FeedPoster[], options: ShowOptions): void {
    this.entrance.disconnect();
    this.nearBottom.disconnect();
    this.posters = posters;
    this.options = options;
    this.next = 0;
    this.rendered = 0;
    this.feed.replaceChildren();

    if (posters.length === 0) {
      if (options.emptyLine) this.showLine(options.emptyLine);
      else this.status.replaceChildren();
      return;
    }
    this.appendBatch();
  }

  showLine(text: string): void {
    const line = document.createElement("p");
    line.className = "feed-status__line";
    line.textContent = text;
    this.status.replaceChildren(line);
  }

  showLoading(): void {
    this.feed.replaceChildren();
    this.status.replaceChildren(this.dot);
  }

  private hasMore(): boolean {
    return this.options.loop || this.next < this.posters.length;
  }

  private appendBatch(): void {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < BATCH_SIZE && this.hasMore(); i++) {
      const first = this.rendered === 0;
      const card = createCard(this.posters[this.next]!, first);
      if (first || !this.options.entrance) card.classList.add("is-lit", "is-still");
      else this.entrance.observe(card);
      fragment.append(card);
      this.next++;
      if (this.options.loop) this.next %= this.posters.length;
      this.rendered++;
    }
    this.feed.append(fragment);

    if (this.hasMore()) {
      this.status.replaceChildren(this.dot);
      this.nearBottom.observe(this.dot);
    } else {
      this.nearBottom.disconnect();
      this.showLine(LINES.endOfResults);
    }
  }
}

export async function loadFeed(): Promise<FeedPoster[]> {
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
