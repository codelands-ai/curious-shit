// Publish the site to Cloudflare (Workers static assets, configured in wrangler.toml).
//
//   npm run deploy           production, from main; commits and pushes new posters afterwards
//   npm run deploy:preview   uploads the current branch as a preview version; production is untouched
//
// See .claude/00-mission-control.md, phase 4.

import { spawn, spawnSync } from "node:child_process";

const PRODUCTION_BRANCH = "main";
// Paths a production deploy may find changed: they're what publishing a poster changes.
const PUBLISHABLE = (path: string) => path.startsWith("posters/") || path === "data/manifest.json";

const preview = process.argv.includes("--preview");
const started = Date.now();

function main(): Promise<void> | void {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (preview) {
    if (branch === PRODUCTION_BRANCH) fail(`Preview deploys come from a branch other than ${PRODUCTION_BRANCH}. Use npm run deploy for production.`);
  } else {
    checkProductionTree(branch);
  }
  checkLogin();

  step("Ingest");
  run("npx", ["tsx", "scripts/ingest.ts"]);
  step("Type-check and build");
  run("npx", ["tsc", "--noEmit"]);
  run("npx", ["vite", "build", "--logLevel", "warn"]);

  step(preview ? `Upload preview of ${branch}` : "Upload to production");
  return upload(preview ? branch : null).then((url) => {
    if (preview) {
      if (publishableChanges().length > 0) {
        console.log("\nNote: posters or the manifest changed locally. They'll be committed when you deploy from main.");
      }
    } else {
      commitPosters();
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`\nLive${preview ? " (preview)" : ""}: ${url}\nDone in ${seconds}s`);
  });
}

// ---------- Checks ----------

function checkLogin(): void {
  const result = spawnSync("npx", ["wrangler", "whoami"], { encoding: "utf8" });
  if (result.status !== 0 || /not authenticated/i.test(result.stdout + result.stderr)) {
    fail("Wrangler isn't logged in to Cloudflare. Run: npx wrangler login");
  }
}

function checkProductionTree(branch: string): void {
  if (branch !== PRODUCTION_BRANCH) {
    fail(`Production deploys run from ${PRODUCTION_BRANCH}; you're on ${branch}. Use npm run deploy:preview for a branch.`);
  }

  const blocking = changedPaths().filter((p) => !PUBLISHABLE(p));
  if (blocking.length > 0) {
    fail(
      `Uncommitted changes outside posters/ and data/manifest.json:\n${blocking.map((p) => `  ${p}`).join("\n")}\n` +
        "Commit them through a PR, or stash them, so the live site matches the repo.",
    );
  }

  // The manifest on main is the source of poster IDs; deploying from a stale copy could reuse an ID.
  git("fetch", "--quiet", "origin", PRODUCTION_BRANCH);
  const local = git("rev-parse", "HEAD");
  const remote = git("rev-parse", `origin/${PRODUCTION_BRANCH}`);
  if (local !== remote) {
    const behind = git("rev-list", "--count", `HEAD..origin/${PRODUCTION_BRANCH}`);
    const ahead = git("rev-list", "--count", `origin/${PRODUCTION_BRANCH}..HEAD`);
    fail(`Local ${PRODUCTION_BRANCH} isn't in sync with GitHub (${behind} behind, ${ahead} ahead). Run git pull (or push) first.`);
  }
}

// ---------- Upload ----------

/** Production deploy when previewBranch is null; otherwise a preview version aliased to the branch. */
function upload(previewBranch: string | null): Promise<string> {
  const args = previewBranch
    ? ["wrangler", "versions", "upload", "--preview-alias", previewAlias(previewBranch), "--message", `Preview of ${previewBranch}`]
    : ["wrangler", "deploy", "--message", `Deploy ${git("rev-parse", "--short", "HEAD")}`];
  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, { stdio: ["inherit", "pipe", "pipe"] });
    let output = "";
    const tee = (chunk: Buffer, to: NodeJS.WriteStream) => {
      output += chunk.toString();
      to.write(chunk);
    };
    child.stdout.on("data", (c: Buffer) => tee(c, process.stdout));
    child.stderr.on("data", (c: Buffer) => tee(c, process.stderr));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`wrangler ${args[1]} exited with ${code}`));
      const urls = output.match(/https:\/\/[\w.-]+\.workers\.dev/g) ?? [];
      // A preview upload prints the version URL, then the alias URL; prefer the alias.
      const alias = previewBranch ? urls.find((u) => u.includes(`//${previewAlias(previewBranch)}-`)) : undefined;
      resolve(alias ?? urls[0] ?? "(see Wrangler output above)");
    });
  });
}

// Preview aliases become part of a hostname: lowercase letters, digits and hyphens.
function previewAlias(branch: string): string {
  return branch.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "preview";
}

// ---------- Commit published posters ----------

function commitPosters(): void {
  if (publishableChanges().length === 0) {
    console.log("\nNo poster changes to commit.");
    return;
  }
  git("add", "--all", "--", "posters", "data/manifest.json");
  const staged = git("diff", "--cached", "--name-status", "-M", "--", "posters")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
  const describe = (status: string, paths: string[]) => {
    const name = (p: string) => p.replace(/^posters\//, "");
    if (status.startsWith("R")) return `rename ${name(paths[0]!)} → ${name(paths[1]!)}`;
    if (status === "A") return `add ${name(paths[0]!)}`;
    if (status === "D") return `remove ${name(paths[0]!)}`;
    return `update ${name(paths[0]!)}`;
  };
  const lines = staged.map(([status, ...paths]) => describe(status!, paths));
  const subject = lines.length === 1 ? `Publish posters: ${lines[0]}` : `Publish posters: ${lines.length} changes`;
  const body = lines.length > 0 ? lines.map((l) => `- ${l}`).join("\n") : "- manifest update";

  git("commit", "--quiet", "-m", subject, "-m", body);
  step("Push poster changes to GitHub");
  const push = spawnSync("git", ["push", "--quiet", "origin", PRODUCTION_BRANCH], { stdio: "inherit" });
  if (push.status !== 0) {
    console.error(
      "\nThe site is live and the poster changes are committed locally, but the push failed.\n" +
        `Push them before anything else changes the manifest: git push origin ${PRODUCTION_BRANCH}`,
    );
    process.exitCode = 1;
  } else {
    console.log(`Committed and pushed: ${subject}`);
  }
}

// ---------- Helpers ----------

function changedPaths(): string[] {
  // -z: NUL-separated, unquoted paths. A rename entry ("R  new") is followed by its old path.
  const result = spawnSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { encoding: "utf8" });
  if (result.status !== 0) fail(`git status failed:\n${result.stderr.trim()}`);
  const fields = result.stdout.split("\0").filter(Boolean);
  const paths: string[] = [];
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i]!;
    paths.push(entry.slice(3));
    if (entry[0] === "R" || entry[0] === "C") paths.push(fields[++i]!);
  }
  return paths;
}

function publishableChanges(): string[] {
  return changedPaths().filter(PUBLISHABLE);
}

function git(...args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) fail(`git ${args.join(" ")} failed:\n${result.stderr.trim()}`);
  return result.stdout.trim();
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed`);
}

function step(label: string): void {
  console.log(`\n▸ ${label}`);
}

function fail(message: string): never {
  console.error(`\ndeploy failed: ${message}`);
  process.exit(1);
}

await Promise.resolve(main()).catch((err: unknown) => fail((err as Error).message));
