// Share buttons in the placard panels. Touch devices get the native share sheet; everything else copies the
// poster's permalink and says so briefly.

import { permalinkPath } from "../shared/site.ts";

const COPIED_MS = 2000;

export function startSharing(): void {
  document.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>(".exhibit__share");
    const card = button?.closest<HTMLElement>(".exhibit");
    if (!button || !card?.dataset.posterId) return;
    const title = card.querySelector(".exhibit__title")?.textContent ?? document.title;
    const url = new URL(permalinkPath(card.dataset.posterId), location.origin).href;
    void share(button, title, url);
  });
}

async function share(button: HTMLButtonElement, title: string, url: string): Promise<void> {
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return; // closed the sheet
      // Otherwise fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    confirm(button, "Link copied");
  } catch {
    confirm(button, "Couldn't copy the link");
  }
}

function confirm(button: HTMLButtonElement, text: string): void {
  const heading = button.closest(".exhibit__heading")!;
  heading.querySelector(".exhibit__copied")?.remove();
  const note = document.createElement("span");
  note.className = "exhibit__copied";
  note.setAttribute("role", "status");
  note.textContent = text;
  heading.append(note);
  requestAnimationFrame(() => note.classList.add("is-visible"));
  window.setTimeout(() => {
    note.classList.remove("is-visible");
    window.setTimeout(() => note.remove(), 300);
  }, COPIED_MS);
}
