// Search bar: lazy-loads the index, filters the gallery, and keeps the query in ?q=.

import { SEARCH_INDEX_URL, type FeedPoster } from "../shared/poster.ts";
import type { PosterSearch } from "../shared/search.ts";
import { LINES, type Gallery } from "./gallery.ts";

const DEBOUNCE_MS = 150;
const SEARCH_UNAVAILABLE = "Search is closed for a moment. Shit happens.";

interface Elements {
  form: HTMLFormElement;
  input: HTMLInputElement;
  clear: HTMLButtonElement;
  resultStatus: HTMLElement;
  hallway: HTMLElement;
}

export function startSearch(gallery: Gallery, feedReady: Promise<FeedPoster[] | null>, el: Elements): void {
  type Loaded = {
    search: PosterSearch;
    run: (search: PosterSearch, query: string) => string[];
    byId: Map<string, FeedPoster>;
  };
  let index: Promise<Loaded | null> | null = null;
  let timer: number | undefined;
  let shown = ""; // the query currently on screen; "" means the full feed
  let token = 0; // guards against an older, slower search finishing last

  // The pre-built index and the search library load together, on first use, so neither delays the first
  // poster. Results are shown from feed.json, which the page already has.
  const loadIndex = () =>
    (index ??= Promise.all([
      fetch(SEARCH_INDEX_URL).then((r) => {
        if (!r.ok) throw new Error(`${SEARCH_INDEX_URL} returned ${r.status}`);
        return r.text();
      }),
      import("../shared/search.ts"),
      feedReady,
    ])
      .then(([json, lib, posters]): Loaded => {
        if (!posters) throw new Error("feed.json is unavailable");
        return { search: lib.loadSearch(json), run: lib.runSearch, byId: new Map(posters.map((p) => [p.id, p])) };
      })
      .catch((err: unknown) => {
        console.error("Couldn't load the search index", err);
        index = null; // try again on the next search
        return null;
      }));

  const apply = async (raw: string): Promise<void> => {
    const query = raw.trim();
    const mine = ++token;
    writeUrl(query);

    if (!query) {
      if (shown === "") {
        el.resultStatus.hidden = true;
        return;
      }
      shown = "";
      const posters = await feedReady;
      if (mine !== token) return;
      await transition(el.hallway, () => {
        el.resultStatus.hidden = true;
        if (posters) gallery.show(posters, { loop: true, entrance: true });
        else gallery.showLine(LINES.feedUnavailable);
      });
      return;
    }

    const loaded = await loadIndex();
    if (mine !== token) return;
    if (!loaded) {
      setStatus(el.resultStatus, SEARCH_UNAVAILABLE, true);
      return;
    }

    const t0 = performance.now();
    const posters = loaded.run(loaded.search, query).flatMap((id) => loaded.byId.get(id) ?? []);
    if (import.meta.env.DEV) console.debug(`search "${query}": ${posters.length} in ${(performance.now() - t0).toFixed(1)}ms`);

    shown = query;
    await transition(el.hallway, () => {
      setStatus(el.resultStatus, `${posters.length} ${posters.length === 1 ? "exhibit" : "exhibits"}`, false);
      gallery.show(posters, { loop: false, entrance: false, emptyLine: LINES.noResults });
    });
  };

  const schedule = () => {
    el.clear.hidden = el.input.value === "";
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void apply(el.input.value), DEBOUNCE_MS);
  };

  const clear = () => {
    el.input.value = "";
    el.clear.hidden = true;
    window.clearTimeout(timer);
    void apply("");
  };

  el.input.addEventListener("focus", () => void loadIndex(), { once: true });
  el.input.addEventListener("input", schedule);
  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.input.value) {
      e.preventDefault();
      clear();
    }
  });
  el.clear.addEventListener("click", () => {
    clear();
    el.input.focus();
  });
  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    window.clearTimeout(timer);
    void apply(el.input.value);
  });

  // A shared ?q= link runs its search straight away.
  const initial = new URLSearchParams(location.search).get("q")?.trim() ?? "";
  if (initial) {
    el.input.value = initial.slice(0, el.input.maxLength);
    el.clear.hidden = false;
    void apply(el.input.value);
  }
}

/** True when the page opened with a search in the URL, so the full feed shouldn't render first. */
export function hasInitialQuery(): boolean {
  return Boolean(new URLSearchParams(location.search).get("q")?.trim());
}

function writeUrl(query: string): void {
  const url = new URL(location.href);
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  if (url.href !== location.href) history.replaceState(history.state, "", url);
}

function setStatus(node: HTMLElement, text: string, isError: boolean): void {
  node.textContent = text;
  node.classList.toggle("is-error", isError);
  node.hidden = false;
}

/** Fade the hallway out, swap its contents, jump to the top, fade back in. */
async function transition(hallway: HTMLElement, swap: () => void): Promise<void> {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  hallway.classList.add("is-leaving");
  if (!reduce) await waitForOpacity(hallway);
  swap();
  window.scrollTo({ top: 0, behavior: "instant" });
  hallway.classList.remove("is-leaving");
}

function waitForOpacity(node: HTMLElement): Promise<void> {
  const duration = parseFloat(getComputedStyle(node).transitionDuration) * 1000 || 0;
  return new Promise((resolve) => {
    if (duration === 0) return resolve();
    const done = () => {
      node.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallback);
      resolve();
    };
    const onEnd = (e: TransitionEvent) => e.target === node && e.propertyName === "opacity" && done();
    const fallback = window.setTimeout(done, duration + 50);
    node.addEventListener("transitionend", onEnd);
  });
}
