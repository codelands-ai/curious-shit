// Firebase ID token verification. Only the token's uid is used; nothing else is read or kept.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library

import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

/** Returns the Firebase uid for a valid ID token, or null for anything else. */
export type VerifyToken = (token: string) => Promise<string | null>;

const GOOGLE_KEYS = new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");

// Module scope: jose caches the key set across requests in the same isolate and refetches on rotation.
const googleKeys = createRemoteJWKSet(GOOGLE_KEYS, { cooldownDuration: 30_000, cacheMaxAge: 6 * 60 * 60_000 });

export function firebaseVerifier(projectId: string, keys: Parameters<typeof jwtVerify>[1] = googleKeys): VerifyToken {
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ["RS256"],
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
        clockTolerance: 5,
        requiredClaims: ["sub", "iat", "exp", "auth_time"],
      });
      const now = Date.now() / 1000;
      if (typeof payload.auth_time !== "number" || payload.auth_time > now + 5) return null;
      return validUid(payload.sub);
    } catch {
      return null;
    }
  };
}

/**
 * Local development only: the Firebase Auth emulator issues unsigned tokens. index.ts uses this only when
 * ALLOW_EMULATOR_TOKENS is "1" (set in .dev.vars, never in wrangler.toml) and the request is to localhost.
 */
export function emulatorVerifier(): VerifyToken {
  return async (token) => {
    try {
      const payload = decodeJwt(token);
      if (typeof payload.iss !== "string" || !payload.iss.startsWith("https://securetoken.google.com/demo-")) return null;
      return validUid(payload.sub);
    } catch {
      return null;
    }
  };
}

// Firebase uids are 1–128 characters.
function validUid(sub: unknown): string | null {
  return typeof sub === "string" && sub.length > 0 && sub.length <= 128 ? sub : null;
}
