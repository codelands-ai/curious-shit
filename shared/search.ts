// Search configuration shared by the browser and scripts/bench-search.ts.

import MiniSearch from "minisearch";
import type { IndexPoster } from "./poster.ts";

export const QUERY_MAX_CHARS = 100;

export type PosterSearch = MiniSearch<IndexPoster>;

export function buildSearch(posters: IndexPoster[]): PosterSearch {
  const search = new MiniSearch<IndexPoster>({
    idField: "id",
    fields: ["title", "keywords", "ocr_text"],
    extractField: (doc, field) => {
      const value = doc[field as keyof IndexPoster];
      return Array.isArray(value) ? value.join(" ") : String(value ?? "");
    },
    searchOptions: {
      boost: { title: 3, keywords: 2 },
      // Every word must match, so extra words narrow the results.
      combineWith: "AND",
      // "geolo" finds "geologic"; very short words match exactly so they don't flood results.
      prefix: (term) => term.length >= 3,
      // About one typo per five letters, for OCR misreads like "Pieistocene".
      fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
    },
  });
  search.addAll(posters);
  return search;
}

/** Poster IDs matching the query, best match first. */
export function runSearch(search: PosterSearch, query: string): string[] {
  const q = query.trim().slice(0, QUERY_MAX_CHARS);
  if (!q) return [];
  return search.search(q).map((r) => String(r.id));
}
