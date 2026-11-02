// Delete everything stored about one visitor: their reactions (counts are fixed by the D1 triggers).
// Backs the privacy page's promise. Find the uid in the Firebase console (Authentication → Users),
// then delete the account there too.
//
//   npm run delete-user -- <uid>           production database
//   npm run delete-user -- <uid> --local   local development database

import { spawnSync } from "node:child_process";

const DATABASE = "curious-shit-reactions";
const args = process.argv.slice(2);
const local = args.includes("--local");
const uid = args.find((a) => !a.startsWith("--"));

// Firebase uids are letters, digits, '-' and '_'. Checking this also makes the SQL below safe,
// since `wrangler d1 execute --command` takes plain SQL with no parameters.
if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
  console.error("Usage: npm run delete-user -- <firebase-uid> [--local]");
  process.exit(1);
}

function sql(command: string): { count?: number; changes?: number } {
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", DATABASE, local ? "--local" : "--remote", "--json", "--command", command],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }
  const [first] = JSON.parse(result.stdout) as { results: { count?: number }[]; meta: { changes?: number } }[];
  return { count: first?.results[0]?.count, changes: first?.meta.changes };
}

const where = `uid = '${uid}'`;
const before = sql(`SELECT COUNT(*) AS count FROM reactions WHERE ${where}`).count ?? 0;
console.log(`${local ? "Local" : "Production"} database: ${before} reaction(s) for ${uid}`);
if (before === 0) process.exit(0);

sql(`DELETE FROM reactions WHERE ${where}`);
const after = sql(`SELECT COUNT(*) AS count FROM reactions WHERE ${where}`).count ?? 0;
if (after !== 0) {
  console.error(`Expected 0 reactions after deleting, found ${after}.`);
  process.exit(1);
}
console.log(`Deleted ${before} reaction(s); counts updated. Now delete the account in the Firebase console.`);
