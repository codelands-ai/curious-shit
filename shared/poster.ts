// Poster records written by scripts/ingest.ts and read by the frontend.
// Field definitions: .claude/content-model.md, "Data record: Poster".

export interface Tag {
  slug: string;
  name: string;
}

export interface PosterVariant {
  width: number;
  url: string;
}

/** What a gallery card needs. Written to /generated/feed.json. */
export interface FeedPoster {
  id: string;
  title: string;
  /** Screen-reader description of the image (sidecar `alt`, else the title). */
  alt: string;
  /** Topic tags, in the order the sidecar lists them. */
  tags: Tag[];
  /** Link-preview text for this poster's permalink (sidecar `description`), if any. */
  description?: string;
  /** WebP at each width: the fallback every browser can show. */
  src: PosterVariant[];
  /** AVIF at the same widths: about 40% smaller, used where the browser supports it. */
  avif: PosterVariant[];
  /** 1200×630 link-preview image (Open Graph), cropped from the top of the poster. */
  og: string;
  width: number;
  height: number;
  added_at: string;
}

/** The full record including search fields. Written to /generated/index.json. */
export interface IndexPoster extends FeedPoster {
  keywords: string[];
  ocr_text: string;
}

/** feed.json: the posters, newest first, and every tag in use with its poster count. */
export interface FeedFile {
  posters: FeedPoster[];
  tags: (Tag & { count: number })[];
}

export const FEED_URL = "/generated/feed.json";

// Rendered poster width: full width minus gutters (16/32/64px), capped at --poster-max (1600px).
export const POSTER_SIZES =
  "(min-width: 1280px) min(calc(100vw - 128px), 1600px), (min-width: 768px) calc(100vw - 64px), calc(100vw - 32px)";
export const INDEX_URL = "/generated/index.json";
/** The MiniSearch index, pre-built by ingest. The browser loads this instead of index.json. */
export const SEARCH_INDEX_URL = "/generated/search-index.json";
