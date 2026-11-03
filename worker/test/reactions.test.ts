// Worker tests against a local D1 (Miniflare), with real RS256 tokens signed by a test key.
// The PRD success criterion: each signed-in user can hold only one of each emoji per poster.

import { env } from "cloudflare:test";
import { SignJWT, generateKeyPair, type CryptoKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { REACTIONS } from "../../shared/reactions.ts";
import { MAX_IDS, handleApi, type Deps } from "../src/api.ts";
import { firebaseVerifier } from "../src/auth.ts";

const PROJECT = "curious-shit";
const POSTERS = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota"];
const ORIGIN = "https://curious-shit.example";

let privateKey: CryptoKey;
let deps: Deps;
let seq = 0;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  deps = {
    verify: firebaseVerifier(PROJECT, pair.publicKey),
    posterIds: async () => new Set(POSTERS),
  };
});

/** A fresh uid per call, so rate limits and data never leak between tests. */
function newUid(): string {
  return `user-${Date.now()}-${seq++}`;
}

async function token(uid: string, overrides: { iss?: string; aud?: string; exp?: number; key?: CryptoKey; alg?: string } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ auth_time: now - 10 })
    .setProtectedHeader({ alg: overrides.alg ?? "RS256" })
    .setIssuer(overrides.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(overrides.aud ?? PROJECT)
    .setSubject(uid)
    .setIssuedAt(now - 10)
    .setExpirationTime(overrides.exp ?? now + 3600)
    .sign(overrides.key ?? privateKey);
}

async function call(method: string, path: string, auth?: string, ip = "203.0.113.1") {
  const headers = new Headers({ "cf-connecting-ip": ip });
  if (auth) headers.set("authorization", `Bearer ${auth}`);
  const response = await handleApi(new Request(`${ORIGIN}${path}`, { method, headers }), env, deps);
  return { status: response.status, body: (await response.json()) as any };
}

const put = async (uid: string, poster: string, emoji: string) => call("PUT", `/api/reactions/${poster}/${emoji}`, await token(uid));
const del = async (uid: string, poster: string, emoji: string) => call("DELETE", `/api/reactions/${poster}/${emoji}`, await token(uid));

async function rowCount(poster: string, emoji: string, uid?: string): Promise<number> {
  const sql = uid
    ? "SELECT COUNT(*) AS n FROM reactions WHERE poster_id = ? AND emoji = ? AND uid = ?"
    : "SELECT COUNT(*) AS n FROM reactions WHERE poster_id = ? AND emoji = ?";
  const row = await env.DB.prepare(sql).bind(poster, emoji, ...(uid ? [uid] : [])).first<{ n: number }>();
  return row!.n;
}

describe("one of each emoji per user per poster", () => {
  it("adding the same reaction twice keeps exactly one", async () => {
    const uid = newUid();
    const first = await put(uid, "alpha", "like");
    const second = await put(uid, "alpha", "like");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.counts.like).toBe(1);
    expect(second.body.mine).toEqual(["like"]);
    expect(await rowCount("alpha", "like", uid)).toBe(1);
  });

  it("concurrent duplicate adds still keep exactly one", async () => {
    const uid = newUid();
    const results = await Promise.all(Array.from({ length: 10 }, () => put(uid, "beta", "wtf")));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await rowCount("beta", "wtf", uid)).toBe(1);
    const { body } = await call("GET", "/api/reactions?ids=beta");
    expect(body.counts.beta.wtf).toBe(1);
  });

  it("the database itself rejects a duplicate row", async () => {
    const uid = newUid();
    const insert = () =>
      env.DB.prepare("INSERT INTO reactions (poster_id, emoji, uid, created_at) VALUES (?, ?, ?, ?)").bind("gamma", "lol", uid, new Date().toISOString()).run();
    await insert();
    await expect(insert()).rejects.toThrow(/UNIQUE|constraint/i);
  });

  it("one user can hold all seven different reactions on a poster", async () => {
    const uid = newUid();
    for (const { key } of REACTIONS) expect((await put(uid, "delta", key)).status).toBe(200);
    const { body } = await del(uid, "delta", "like").then(() => put(uid, "delta", "like"));
    expect(body.mine.sort()).toEqual(REACTIONS.map((r) => r.key).sort());
  });

  it("different users' reactions add up", async () => {
    const [a, b, c] = [newUid(), newUid(), newUid()];
    await put(a, "epsilon", "shit");
    await put(b, "epsilon", "shit");
    const { body } = await put(c, "epsilon", "shit");
    expect(body.counts.shit).toBe(3);
    expect(body.mine).toEqual(["shit"]);
  });
});

describe("removing", () => {
  it("removes only the caller's reaction and updates the count", async () => {
    const [a, b] = [newUid(), newUid()];
    await put(a, "zeta", "angry");
    await put(b, "zeta", "angry");
    const { status, body } = await del(a, "zeta", "angry");
    expect(status).toBe(200);
    expect(body.counts.angry).toBe(1);
    expect(body.mine).toEqual([]);
    expect(await rowCount("zeta", "angry", b)).toBe(1);
  });

  it("removing twice is harmless and the count never goes negative", async () => {
    const uid = newUid();
    await put(uid, "eta", "hate");
    await del(uid, "eta", "hate");
    const { status, body } = await del(uid, "eta", "hate");
    expect(status).toBe(200);
    expect(body.counts.hate).toBeUndefined();
    const row = await env.DB.prepare("SELECT count FROM counts WHERE poster_id = 'eta' AND emoji = 'hate'").first();
    expect(row).toBeNull();
  });

  it("deleting a user's rows (privacy request) fixes the counts", async () => {
    const [a, b] = [newUid(), newUid()];
    await put(a, "theta", "like");
    await put(a, "theta", "lol");
    await put(b, "theta", "like");
    await env.DB.prepare("DELETE FROM reactions WHERE uid = ?").bind(a).run();
    const { body } = await call("GET", "/api/reactions?ids=theta");
    expect(body.counts.theta).toEqual({ like: 1 });
  });
});

describe("reading counts", () => {
  it("returns counts for several posters, with empty objects for none", async () => {
    const uid = newUid();
    await put(uid, "iota", "mind_blown");
    const { status, body } = await call("GET", "/api/reactions?ids=iota,alpha,nope");
    expect(status).toBe(200);
    expect(body.counts.iota.mind_blown).toBeGreaterThanOrEqual(1);
    expect(Object.keys(body.counts).sort()).toEqual(["alpha", "iota"]); // unknown IDs are dropped
    expect(body.mine).toBeNull();
  });

  it("includes the caller's own reactions with a token", async () => {
    const uid = newUid();
    await put(uid, "alpha", "lol");
    const { body } = await call("GET", "/api/reactions?ids=alpha,beta", await token(uid));
    expect(body.mine).toEqual({ alpha: ["lol"], beta: [] });
  });

  it(`rejects more than ${MAX_IDS} ids or none`, async () => {
    expect((await call("GET", `/api/reactions?ids=${POSTERS.join(",")}`)).status).toBe(400);
    expect((await call("GET", "/api/reactions")).status).toBe(400);
  });

  it("sends no-store so counts are never cached", async () => {
    const response = await handleApi(new Request(`${ORIGIN}/api/reactions?ids=alpha`), env, deps);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("validation and auth", () => {
  it("rejects writes without a token", async () => {
    expect((await call("PUT", "/api/reactions/alpha/like")).status).toBe(401);
  });

  it("rejects a token signed by another key", async () => {
    const other = await generateKeyPair("RS256");
    const bad = await token(newUid(), { key: other.privateKey });
    expect((await call("PUT", "/api/reactions/alpha/like", bad)).status).toBe(401);
  });

  it("rejects wrong audience, wrong issuer and expired tokens", async () => {
    const uid = newUid();
    const now = Math.floor(Date.now() / 1000);
    for (const bad of [
      await token(uid, { aud: "someone-else" }),
      await token(uid, { iss: "https://securetoken.google.com/someone-else" }),
      await token(uid, { exp: now - 600 }),
    ]) {
      expect((await call("PUT", "/api/reactions/alpha/like", bad)).status).toBe(401);
    }
  });

  it("rejects an unsigned token", async () => {
    const [header, payload] = (await token(newUid())).split(".");
    const b64url = (text: string) => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const unsigned = `${b64url(JSON.stringify({ alg: "none" }))}.${payload}.`;
    expect(header).toBeTruthy();
    expect((await call("PUT", "/api/reactions/alpha/like", unsigned)).status).toBe(401);
  });

  it("an invalid token on a read is an error, not silently anonymous", async () => {
    expect((await call("GET", "/api/reactions?ids=alpha", "garbage")).status).toBe(401);
  });

  it("rejects unknown emoji and unknown posters", async () => {
    const uid = newUid();
    expect((await put(uid, "alpha", "heart")).status).toBe(400);
    expect((await put(uid, "not-a-poster", "like")).status).toBe(404);
    expect(await rowCount("not-a-poster", "like")).toBe(0);
  });

  it("answers 405 and 404 for other methods and paths", async () => {
    expect((await call("POST", "/api/reactions/alpha/like", await token(newUid()))).status).toBe(405);
    expect((await call("GET", "/api/other")).status).toBe(404);
  });
});

describe("rate limiting", () => {
  it("limits one user's changes", async () => {
    const uid = newUid();
    const auth = await token(uid);
    const statuses: number[] = [];
    for (let i = 0; i < 70; i++) statuses.push((await call(i % 2 ? "DELETE" : "PUT", "/api/reactions/beta/lol", auth)).status);
    expect(statuses).toContain(429);
    expect(statuses.slice(0, 50).every((s) => s === 200)).toBe(true);
    // Another user is unaffected.
    expect((await put(newUid(), "beta", "lol")).status).toBe(200);
  });

  it("limits reads per IP", async () => {
    const ip = `198.51.100.${(seq++ % 250) + 1}`;
    const statuses: number[] = [];
    for (let i = 0; i < 320; i++) statuses.push((await call("GET", "/api/reactions?ids=alpha", undefined, ip)).status);
    expect(statuses).toContain(429);
    expect((await call("GET", "/api/reactions?ids=alpha", undefined, "192.0.2.77")).status).toBe(200);
  });
});
