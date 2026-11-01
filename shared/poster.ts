// Poster records written by scripts/ingest.ts and read by the frontend.
// Field definitions: .claude/content-model.md, "Data record: Poster".

export interface PosterVariant {
  width: number;
  url: string;
}

/** What a gallery card needs. Written to /generated/feed.json. */
export interface FeedPoster {
  id: string;
  title: string;
  src: PosterVariant[];
  width: number;
  height: number;
  added_at: string;
}

/** The full record including search fields. Written to /generated/index.json. */
export interface IndexPoster extends FeedPoster {
  keywords: string[];
  ocr_text: string;
}

export const FEED_URL = "/generated/feed.json";

// Rendered poster width: full width minus gutters (16/32/64px), capped at --poster-max (1600px).
export const POSTER_SIZES =
  "(min-width: 1280px) min(calc(100vw - 128px), 1600px), (min-width: 768px) calc(100vw - 64px), calc(100vw - 32px)";
export const INDEX_URL = "/generated/index.json";
