// Per-request dependencies for the API: which token verifier to use, and the list of known posters.

import type { Deps } from "./api.ts";
import { emulatorVerifier, firebaseVerifier } from "./auth.ts";

const FEED_PATH = "/generated/feed.json";
const FEED_TTL_MS = 60_000;

let feedCache: { ids: Set<string>; at: number } | null = null;

export function depsFor(url: URL, env: Env): Deps {
  // Emulator tokens are unsigned: accept them only on localhost and only with the dev-only flag from .dev.vars.
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const allowEmulator = (env as Env & { ALLOW_EMULATOR_TOKENS?: string }).ALLOW_EMULATOR_TOKENS === "1" && local;
  return {
    verify: allowEmulator ? emulatorVerifier() : firebaseVerifier(env.FIREBASE_PROJECT_ID),
    posterIds: () => posterIds(env, url),
  };
}

/** Poster IDs from the deployed feed.json, cached briefly per isolate. */
async function posterIds(env: Env, url: URL): Promise<Set<string>> {
  if (feedCache && Date.now() - feedCache.at < FEED_TTL_MS) return feedCache.ids;
  const response = await env.ASSETS.fetch(new Request(new URL(FEED_PATH, url.origin)));
  if (!response.ok) throw new Error(`feed.json returned ${response.status}`);
  const { posters } = (await response.json()) as { posters: { id: string }[] };
  feedCache = { ids: new Set(posters.map((p) => p.id)), at: Date.now() };
  return feedCache.ids;
}
