import { startAccount } from "./account.ts";
import { Gallery, LINES, loadFeed } from "./gallery.ts";
import { hasInitialQuery, startSearch } from "./search.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const gallery = new Gallery($("feed"), $("feed-status"));
const searching = hasInitialQuery();
if (searching) gallery.showLoading();

const feedReady = loadFeed().then(
  (posters) => {
    if (!searching) gallery.show(posters, { loop: true, entrance: true });
    return posters;
  },
  (err: unknown) => {
    console.error("Couldn't load the feed", err);
    if (!searching) gallery.showLine(LINES.feedUnavailable);
    return null;
  },
);

startSearch(gallery, feedReady, {
  form: $("search"),
  input: $("search-input"),
  clear: $("search-clear"),
  resultStatus: $("result-status"),
  hallway: $("hallway"),
});

startAccount();
