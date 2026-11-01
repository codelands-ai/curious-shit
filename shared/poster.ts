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
export const INDEX_URL = "/generated/index.json";
