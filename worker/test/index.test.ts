// The emulator escape hatch must never apply outside localhost, whatever the environment says.

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { depsFor } from "../src/deps.ts";

function unsignedToken(iss: string): string {
  const b64url = (text: string) => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss, aud: "demo-curious-shit", sub: "emulator-user", iat: now, exp: now + 3600, auth_time: now };
  return `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.`;
}

describe("emulator tokens", () => {
  const emulatorToken = unsignedToken("https://securetoken.google.com/demo-curious-shit");
  // Set and clear the flag explicitly: a developer's .dev.vars is loaded into the test env too.
  const withFlag = { ...env, ALLOW_EMULATOR_TOKENS: "1" } as Env;
  const withoutFlag = { ...env, ALLOW_EMULATOR_TOKENS: undefined } as Env;

  it("are accepted on localhost when ALLOW_EMULATOR_TOKENS=1", async () => {
    expect(await depsFor(new URL("http://localhost:8787/api/reactions"), withFlag).verify(emulatorToken)).toBe("emulator-user");
  });

  it("are rejected on any other host, even with the flag set", async () => {
    expect(await depsFor(new URL("https://curious-shit.smokeraven667.workers.dev/api/reactions"), withFlag).verify(emulatorToken)).toBeNull();
  });

  it("are rejected on localhost without the flag", async () => {
    expect(await depsFor(new URL("http://localhost:8787/api/reactions"), withoutFlag).verify(emulatorToken)).toBeNull();
  });

  it("must come from a demo- project even in dev", async () => {
    const real = unsignedToken("https://securetoken.google.com/curious-shit");
    expect(await depsFor(new URL("http://localhost:8787/api/reactions"), withFlag).verify(real)).toBeNull();
  });
});
