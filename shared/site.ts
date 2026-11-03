// Site-wide constants. Change SITE_URL when a custom domain is added.
export const SITE_URL = "https://curious-shit.smokeraven667.workers.dev";
export const SITE_NAME = "Curious Shit";
export const SITE_DESCRIPTION =
  "A curiosity cabinet built for the scroll age: oversized landscape posters about deep time, dead religions and odd science, with a search bar that reads every word on every image.";
/** A poster's permanent address. IDs never change, so these links never break while the poster exists. */
export function permalinkPath(id: string): string {
  return `/p/${encodeURIComponent(id)}`;
}
