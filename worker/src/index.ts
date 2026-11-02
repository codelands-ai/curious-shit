// Worker entry. Only /api/* reaches this script (run_worker_first in wrangler.toml); every other path is
// served straight from the static assets.

import { handleApi } from "./api.ts";
import { depsFor } from "./deps.ts";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    return handleApi(request, env, depsFor(url, env));
  },
} satisfies ExportedHandler<Env>;
