// The reactions API. Routes:
//   GET    /api/reactions?ids=a,b,c        counts for up to 8 posters; plus the caller's own with a token
//   PUT    /api/reactions/:poster/:emoji   add the caller's reaction (no-op if it exists)
//   DELETE /api/reactions/:poster/:emoji   remove it (no-op if it doesn't)

import { isReactionKey, type ReactionKey } from "../../shared/reactions.ts";
import type { VerifyToken } from "./auth.ts";

export const MAX_IDS = 8;

export interface Deps {
  verify: VerifyToken;
  /** IDs of posters that can be reacted to (from feed.json). */
  posterIds: () => Promise<Set<string>>;
  now?: () => Date;
}

type Counts = Partial<Record<ReactionKey, number>>;

export async function handleApi(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api", "reactions", poster?, emoji?]
  if (parts[0] !== "api" || parts[1] !== "reactions") return error(404, "not_found");

  try {
    if (parts.length === 2 && request.method === "GET") return await list(request, url, env, deps);
    if (parts.length === 4 && (request.method === "PUT" || request.method === "DELETE")) {
      return await change(request, decodeURIComponent(parts[2]!), decodeURIComponent(parts[3]!), env, deps);
    }
    if (parts.length === 2 || parts.length === 4) return error(405, "method_not_allowed");
    return error(404, "not_found");
  } catch (err) {
    console.error("reactions api error", err);
    return error(500, "server_error");
  }
}

async function list(request: Request, url: URL, env: Env, deps: Deps): Promise<Response> {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await env.READ_LIMITER.limit({ key: ip })).success) return error(429, "rate_limited");

  const ids = [...new Set((url.searchParams.get("ids") ?? "").split(",").filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_IDS) return error(400, "bad_ids");
  const known = await deps.posterIds();
  const valid = ids.filter((id) => known.has(id));

  // Optional: with a valid token, also say which reactions are the caller's. An invalid token is an error
  // rather than silently anonymous, so the client knows to refresh it.
  let uid: string | null = null;
  if (request.headers.has("authorization")) {
    uid = await authenticate(request, deps);
    if (!uid) return error(401, "bad_token");
  }

  const counts: Record<string, Counts> = Object.fromEntries(valid.map((id) => [id, {}]));
  const mine: Record<string, ReactionKey[]> | null = uid ? Object.fromEntries(valid.map((id) => [id, []])) : null;
  if (valid.length > 0) {
    const marks = valid.map(() => "?").join(",");
    const statements = [env.DB.prepare(`SELECT poster_id, emoji, count FROM counts WHERE poster_id IN (${marks})`).bind(...valid)];
    if (uid) statements.push(env.DB.prepare(`SELECT poster_id, emoji FROM reactions WHERE uid = ? AND poster_id IN (${marks})`).bind(uid, ...valid));
    const [countRows, mineRows] = await env.DB.batch<{ poster_id: string; emoji: string; count?: number }>(statements);
    for (const row of countRows!.results) if (isReactionKey(row.emoji)) counts[row.poster_id]![row.emoji] = row.count!;
    if (mine) for (const row of mineRows!.results) if (isReactionKey(row.emoji)) mine[row.poster_id]!.push(row.emoji);
  }
  return json({ counts, mine });
}

async function change(request: Request, posterId: string, emoji: string, env: Env, deps: Deps): Promise<Response> {
  const uid = await authenticate(request, deps);
  if (!uid) return error(401, "bad_token");
  if (!(await env.WRITE_LIMITER.limit({ key: uid })).success) return error(429, "rate_limited");
  if (!isReactionKey(emoji)) return error(400, "bad_emoji");
  if (!(await deps.posterIds()).has(posterId)) return error(404, "unknown_poster");

  const write =
    request.method === "PUT"
      ? env.DB.prepare("INSERT INTO reactions (poster_id, emoji, uid, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING").bind(
          posterId,
          emoji,
          uid,
          (deps.now?.() ?? new Date()).toISOString(),
        )
      : env.DB.prepare("DELETE FROM reactions WHERE poster_id = ? AND emoji = ? AND uid = ?").bind(posterId, emoji, uid);

  // One batch = one transaction: the write (and its count trigger) and the fresh state for this poster.
  const [, countRows, mineRows] = await env.DB.batch<{ emoji: string; count?: number }>([
    write,
    env.DB.prepare("SELECT emoji, count FROM counts WHERE poster_id = ?").bind(posterId),
    env.DB.prepare("SELECT emoji FROM reactions WHERE poster_id = ? AND uid = ?").bind(posterId, uid),
  ]);
  const counts: Counts = {};
  for (const row of countRows!.results) if (isReactionKey(row.emoji)) counts[row.emoji] = row.count!;
  const mine = mineRows!.results.map((r) => r.emoji).filter(isReactionKey);
  return json({ poster_id: posterId, counts, mine });
}

async function authenticate(request: Request, deps: Deps): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? deps.verify(match[1]!) : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function error(status: number, code: string): Response {
  return json({ error: code }, status);
}
