import { startAccount } from "./account.ts";
import { attachReactions, startReactions } from "./reactions.ts";
import { Gallery, LINES, loadFeed } from "./gallery.ts";
import { hasInitialQuery, startSearch } from "./search.ts";
import { startSharing } from "./share.ts";
import type { FeedPoster } from "../shared/poster.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const gallery = new Gallery($("feed"), $("feed-status"), attachReactions);
const searching = hasInitialQuery();
if (searching) gallery.showLoading();

// On a permalink (/p/<id>) the hallway starts at that poster and carries on in feed order, looping.
function startingAt(posters: FeedPoster[]): FeedPoster[] {
  const match = /^\/p\/([^/]+)$/.exec(location.pathname);
  const index = match ? posters.findIndex((p) => p.id === decodeURIComponent(match[1]!)) : -1;
  return index > 0 ? [...posters.slice(index), ...posters.slice(0, index)] : posters;
}

const feedReady = loadFeed().then(
  (feed) => {
    const posters = startingAt(feed);
    if (!searching) gallery.show(posters, { loop: true, entrance: true });
    return posters;
  },
  (err: unknown) => {
    console.error("Couldn't load the feed", err);
    if (!searching) gallery.showLine(LINES.feedUnavailable);
    return null;
  },
);

const search = startSearch(gallery, feedReady, {
  form: $("search"),
  input: $("search-input"),
  clear: $("search-clear"),
  resultStatus: $("result-status"),
  hallway: $("hallway"),
});

startAccount();
startReactions();
startSharing();

// Tapping a poster (or Enter/Space on it) opens the full-screen viewer, loaded on first use.
const openPoster = async (frame: HTMLElement) => {
  const card = frame.closest<HTMLElement>(".exhibit");
  const poster = ((await feedReady) ?? []).find((p) => p.id === card?.dataset.posterId);
  if (!card || !poster) return;
  const { openViewer } = await import("./viewer.ts");
  openViewer(poster, card);
};
document.addEventListener("click", (e) => {
  const frame = (e.target as Element).closest<HTMLElement>(".exhibit__frame");
  if (frame) void openPoster(frame);
});
document.addEventListener("keydown", (e) => {
  const frame = (e.target as Element).closest?.<HTMLElement>(".exhibit__frame");
  if (frame && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    void openPoster(frame);
  }
});

// Topic links (the filter row and the tags on each poster) filter in place instead of reloading.
document.addEventListener("click", (e) => {
  const link = (e.target as Element).closest<HTMLAnchorElement>("a[data-tag]");
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  search.setTag(link.dataset.tag || null);
});
