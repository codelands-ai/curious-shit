// Reaction bars under each poster card. Counts load once per batch of cards; taps update instantly and
// roll back if the Worker says no. If the API can't be reached, bars stay invisible (their space is
// reserved, so nothing shifts) and the gallery carries on.

import { REACTIONS, type ReactionKey } from "../shared/reactions.ts";
import { getIdToken, onViewerChange, openSignIn } from "./account.ts";

const API = "/api/reactions";
const MAX_IDS = 8;
const PROMPT = "Sign in to leave your mark";
const PROMPT_MS = 3000;

type Counts = Partial<Record<ReactionKey, number>>;
interface PosterState {
  counts: Counts;
  mine: Set<ReactionKey>;
}

const state = new Map<string, PosterState>();
const bars = new Map<string, Set<HTMLElement>>(); // a poster can appear several times in the looping feed
let signedIn = false;

export function startReactions(): void {
  onViewerChange((viewer) => {
    const was = signedIn;
    signedIn = viewer !== null;
    if (signedIn && !was) void refreshMine([...bars.keys()]);
    if (!signedIn && was) {
      for (const [id, s] of state) {
        s.mine.clear();
        render(id);
      }
    }
  });
}

/** Hook up the reaction bars of freshly rendered cards (the markup comes with the card) and load counts. */
export function attachReactions(cards: HTMLElement[]): void {
  const ids: string[] = [];
  for (const card of cards) {
    const id = card.dataset.posterId;
    const bar = card.querySelector<HTMLElement>(".reactions");
    if (!id || !bar || bar.dataset.bound) continue;
    bar.dataset.bound = "1";
    bar.addEventListener("click", (e) => {
      const pill = (e.target as Element).closest<HTMLButtonElement>(".pill");
      if (pill) tap(id, pill.dataset.key as ReactionKey, pill);
    });
    if (!bars.has(id)) bars.set(id, new Set());
    bars.get(id)!.add(bar);
    if (state.has(id)) render(id);
    else ids.push(id);
  }
  // Drop bars whose cards have left the page (search results replaced, etc.).
  for (const [id, set] of bars) {
    for (const bar of set) if (!bar.isConnected) set.delete(bar);
    if (set.size === 0) bars.delete(id);
  }
  void load([...new Set(ids)]);
}

// ---------- Network ----------

async function load(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += MAX_IDS) {
    const chunk = ids.slice(i, i + MAX_IDS);
    const data = await fetchReactions(chunk, signedIn);
    if (!data) continue; // API unreachable: those bars stay invisible
    apply(data);
  }
}

async function refreshMine(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += MAX_IDS) {
    const data = await fetchReactions(ids.slice(i, i + MAX_IDS), true);
    if (data) apply(data);
  }
}

interface ListResponse {
  counts: Record<string, Counts>;
  mine: Record<string, ReactionKey[]> | null;
}

async function fetchReactions(ids: string[], withToken: boolean): Promise<ListResponse | null> {
  try {
    const headers: HeadersInit = {};
    const token = withToken ? await getIdToken() : null;
    if (token) headers.authorization = `Bearer ${token}`;
    let response = await fetch(`${API}?ids=${ids.map(encodeURIComponent).join(",")}`, { headers });
    if (response.status === 401 && token) response = await fetch(`${API}?ids=${ids.map(encodeURIComponent).join(",")}`);
    if (!response.ok) return null;
    return (await response.json()) as ListResponse;
  } catch {
    return null;
  }
}

function apply(data: ListResponse): void {
  for (const [id, counts] of Object.entries(data.counts)) {
    const s = state.get(id) ?? { counts: {}, mine: new Set<ReactionKey>() };
    // Don't overwrite a poster with taps in flight; their responses will set the truth.
    if (!flights.has(id)) {
      s.counts = counts;
      if (data.mine) s.mine = new Set(data.mine[id] ?? []);
    }
    state.set(id, s);
    render(id);
  }
}

// ---------- Tapping ----------

// Taps in flight per poster. While any are pending, background count loads leave the poster alone; when the
// last one settles, the server's answer becomes the truth (or, if any failed, a fresh read does).
interface Flight {
  count: number;
  failed: boolean;
  last: PosterState | null;
  snapshot: PosterState;
}
const flights = new Map<string, Flight>();
const queues = new Map<string, Promise<unknown>>(); // per poster+emoji: keep add/remove in tap order

function tap(id: string, key: ReactionKey, pill: HTMLButtonElement): void {
  if (!signedIn) {
    showPrompt(pill);
    return;
  }
  const s = state.get(id);
  if (!s) return;
  const adding = !s.mine.has(key);

  let flight = flights.get(id);
  if (!flight) {
    flight = { count: 0, failed: false, last: null, snapshot: { counts: { ...s.counts }, mine: new Set(s.mine) } };
    flights.set(id, flight);
  }
  flight.count++;

  // Optimistic update.
  if (adding) s.mine.add(key);
  else s.mine.delete(key);
  s.counts[key] = Math.max(0, (s.counts[key] ?? 0) + (adding ? 1 : -1));
  render(id, adding ? key : undefined);

  const slot = `${id}/${key}`;
  const queued = (queues.get(slot) ?? Promise.resolve()).then(() => send(id, key, adding ? "PUT" : "DELETE"));
  queues.set(slot, queued);
  void queued.then(async (result) => {
    if (queues.get(slot) === queued) queues.delete(slot);
    const f = flights.get(id)!;
    if (result) f.last = result;
    else f.failed = true;
    if (--f.count > 0) return;
    flights.delete(id);
    if (!f.failed && f.last) {
      state.set(id, f.last);
    } else {
      // Something was refused or failed: ask the server what's true; if it's unreachable, undo our taps.
      const fresh = await fetchReactions([id], true);
      if (fresh && fresh.counts[id]) state.set(id, { counts: fresh.counts[id], mine: new Set(fresh.mine?.[id] ?? []) });
      else state.set(id, f.snapshot);
    }
    render(id);
  });
}

async function send(id: string, key: ReactionKey, method: "PUT" | "DELETE"): Promise<PosterState | null> {
  try {
    const token = await getIdToken();
    if (!token) return null;
    const response = await fetch(`${API}/${encodeURIComponent(id)}/${key}`, { method, headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const body = (await response.json()) as { counts: Counts; mine: ReactionKey[] };
    return { counts: body.counts, mine: new Set(body.mine) };
  } catch {
    return null;
  }
}

// ---------- Rendering ----------

function render(id: string, winkKey?: ReactionKey): void {
  const s = state.get(id);
  const set = bars.get(id);
  if (!s || !set) return;
  for (const bar of set) {
    bar.classList.remove("is-pending");
    for (const pill of bar.querySelectorAll<HTMLButtonElement>(".pill")) {
      const key = pill.dataset.key as ReactionKey;
      const { label } = REACTIONS.find((r) => r.key === key)!;
      const count = s.counts[key] ?? 0;
      const mine = signedIn && s.mine.has(key);
      const countEl = pill.querySelector<HTMLElement>(".pill__count")!;
      const text = count > 0 ? formatCount(count) : "";
      if (countEl.textContent !== text) {
        countEl.textContent = text;
        restartAnimation(countEl, "is-changing");
      }
      countEl.hidden = count === 0;
      pill.classList.toggle("is-active", mine);
      pill.setAttribute("aria-pressed", String(mine));
      pill.setAttribute("aria-label", count > 0 ? `${label}, ${count}` : label);
      if (winkKey === key) restartAnimation(pill.querySelector(".pill__emoji")!, "is-winking");
    }
  }
}

function restartAnimation(el: Element, cls: string): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth; // reflow so the animation plays again
  el.classList.add(cls);
}

/** 999 → "999", 1234 → "1.2k", 12345 → "12k", 1234567 → "1.2M". */
export function formatCount(n: number): string {
  const short = (value: number, unit: string) => `${value >= 10 ? Math.floor(value) : Math.floor(value * 10) / 10}${unit}`;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return short(n / 1000, "k");
  return short(n / 1_000_000, "M");
}

// ---------- Signed-out prompt ----------

let promptTimer: number | undefined;

function showPrompt(pill: HTMLButtonElement): void {
  document.querySelectorAll(".reactions__prompt").forEach((el) => el.remove());
  window.clearTimeout(promptTimer);
  const prompt = document.createElement("button");
  prompt.type = "button";
  prompt.className = "reactions__prompt";
  prompt.textContent = PROMPT;
  prompt.addEventListener("click", () => {
    prompt.remove();
    openSignIn();
  });
  const bar = pill.closest(".reactions")!;
  bar.append(prompt);
  // Center above the tapped pill, but keep the whole tooltip on screen.
  const barBox = bar.getBoundingClientRect();
  const pillBox = pill.getBoundingClientRect();
  const half = prompt.offsetWidth / 2;
  const center = pillBox.left + pillBox.width / 2;
  const margin = 8;
  const clamped = Math.min(Math.max(center, half + margin), document.documentElement.clientWidth - half - margin);
  prompt.style.left = `${clamped - barBox.left}px`;
  requestAnimationFrame(() => prompt.classList.add("is-visible"));
  promptTimer = window.setTimeout(() => {
    prompt.classList.remove("is-visible");
    window.setTimeout(() => prompt.remove(), 300);
  }, PROMPT_MS);
}
