# Reactions Worker

The only server-side code: `/api/reactions` (see `src/api.ts`), running in the site's Worker for `/api/*` only. Static files never invoke it.

- `src/auth.ts`: Firebase ID token verification (`jose`, Google's public keys).
- `src/deps.ts`: per-request setup; the dev-only emulator escape hatch.
- `migrations/`: the D1 schema. Production deploys apply new migrations automatically.
- `test/`: `npm test` from the repo root.
