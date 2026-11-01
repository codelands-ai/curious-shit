// The fixed reaction set, shared by the frontend and the Worker.
// Keys are stored in D1, so never rename or remove one once reactions exist.
export const REACTIONS = [
  { key: "like", emoji: "👍", label: "Like" },
  { key: "hate", emoji: "👎", label: "Hate" },
  { key: "angry", emoji: "😡", label: "Angry" },
  { key: "wtf", emoji: "😳", label: "WTF" },
  { key: "mind_blown", emoji: "🤯", label: "Mind-blown" },
  { key: "lol", emoji: "😂", label: "LOL" },
  { key: "shit", emoji: "💩", label: "Shit" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];

const KEYS: ReadonlySet<string> = new Set(REACTIONS.map((r) => r.key));

export function isReactionKey(value: unknown): value is ReactionKey {
  return typeof value === "string" && KEYS.has(value);
}
