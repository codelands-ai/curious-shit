// Full-screen poster viewer with zoom and pan. Loaded on first open (src/main.ts), so it never costs the
// first poster anything. Pointer events and CSS transforms; no dependencies.
//
// Model: the image is laid out at its natural size (W×H CSS px) at the stage's top-left and transformed by
// translate(tx, ty) scale(s). "Fit" is the scale that shows the whole poster; the most we zoom in is
// 2 screen pixels per image pixel, past which only blur is added.

import type { FeedPoster } from "../shared/poster.ts";

const DOUBLE_ZOOM = 2.5; // double-tap / double-click target, relative to fit
const STEP = 1.5; // + and − buttons and keys
const WHEEL_SPEED = 0.0025;
const PAN_STEP = 0.1; // arrow keys move a tenth of the stage
const TAP_MS = 300;
const TAP_SLOP = 24;

let viewer: Viewer | null = null;

/** Open the viewer for this poster; `card` is the gallery element focus returns to. */
export function openViewer(poster: FeedPoster, card: HTMLElement): void {
  viewer ??= new Viewer();
  viewer.open(poster, card);
}

class Viewer {
  private readonly dialog: HTMLDialogElement;
  private readonly stage: HTMLElement;
  private readonly image: HTMLImageElement;
  private readonly title: HTMLElement;
  private readonly level: HTMLElement;
  private readonly fullscreen: HTMLButtonElement;

  private poster: FeedPoster | null = null;
  private returnTo: HTMLElement | null = null;
  private w = 1; // natural image size in CSS px
  private h = 1;
  private s = 1; // current scale
  private tx = 0;
  private ty = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { distance: number; s: number; mid: { x: number; y: number } } | null = null;
  private lastTap = { t: 0, x: 0, y: 0 };
  private moved = false;
  private closing = false;
  private pendingClose: number | undefined; // a backdrop tap waits briefly in case it's a double-tap
  private lastPointerType = "mouse";
  private scrollY = 0; // where the hallway was, restored on close

  constructor() {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "viewer";
    this.dialog.setAttribute("aria-labelledby", "viewer-title");
    this.dialog.innerHTML = `
      <header class="viewer__bar">
        <h2 id="viewer-title" class="viewer__title"></h2>
        <button type="button" class="viewer__button viewer__close" data-action="close" aria-label="Close">${icon("close")}</button>
      </header>
      <div class="viewer__stage"><img class="viewer__image" alt="" draggable="false" /></div>
      <div class="viewer__controls" role="toolbar" aria-label="Zoom">
        <button type="button" class="viewer__button" data-action="out" aria-label="Zoom out">${icon("minus")}</button>
        <output class="viewer__level" aria-live="polite">100%</output>
        <button type="button" class="viewer__button" data-action="in" aria-label="Zoom in">${icon("plus")}</button>
        <button type="button" class="viewer__button viewer__text" data-action="fit">Fit</button>
        <button type="button" class="viewer__button viewer__text" data-action="fullscreen" hidden>Full screen</button>
      </div>`;
    document.body.append(this.dialog);
    this.stage = this.dialog.querySelector(".viewer__stage")!;
    this.image = this.dialog.querySelector(".viewer__image")!;
    this.title = this.dialog.querySelector(".viewer__title")!;
    this.level = this.dialog.querySelector(".viewer__level")!;
    this.fullscreen = this.dialog.querySelector('[data-action="fullscreen"]')!;
    // Phones already get the whole screen; the real full-screen mode is offered on desktop.
    this.fullscreen.hidden = !(document.fullscreenEnabled && matchMedia("(pointer: fine)").matches);

    this.dialog.addEventListener("click", (e) => {
      const action = (e.target as Element).closest<HTMLElement>("[data-action]")?.dataset.action;
      if (action === "close") this.requestClose();
      else if (action === "in") this.zoomBy(STEP, true);
      else if (action === "out") this.zoomBy(1 / STEP, true);
      else if (action === "fit") this.fit(true);
      else if (action === "fullscreen") void this.toggleFullscreen();
    });
    this.dialog.addEventListener("cancel", (e) => {
      e.preventDefault(); // Escape: close through history, like every other way
      this.requestClose();
    });
    this.dialog.addEventListener("keydown", (e) => this.onKey(e));
    document.addEventListener("fullscreenchange", () => {
      this.fullscreen.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
      requestAnimationFrame(() => this.refit());
    });
    addEventListener("resize", () => this.dialog.open && this.refit());
    // Back closes the viewer: opening pushed a history entry.
    addEventListener("popstate", () => this.dialog.open && this.close());

    this.stage.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    this.stage.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.stage.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.stage.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.stage.addEventListener("pointercancel", (e) => this.onPointerUp(e));
    // Mouse double-click. Touch double-taps are handled in onPointerUp; Chrome also fires dblclick for them.
    this.stage.addEventListener("dblclick", (e) => this.lastPointerType !== "touch" && this.toggleZoomAt(this.point(e), true));
  }

  open(poster: FeedPoster, card: HTMLElement): void {
    this.poster = poster;
    this.returnTo = card.querySelector<HTMLElement>(".exhibit__frame") ?? card;
    this.title.textContent = poster.title;
    this.image.alt = poster.alt ?? poster.title;

    // Lay out at the zoom image's size; show the gallery's already-loaded image at once, then swap in the
    // sharpest version (AVIF if this browser chose AVIF in the gallery) when it arrives.
    this.w = poster.zoom.width;
    this.h = Math.round((poster.zoom.width * poster.height) / poster.width);
    this.image.style.width = `${this.w}px`;
    this.image.style.height = `${this.h}px`;
    const shown = card.querySelector<HTMLImageElement>(".exhibit__image");
    const avif = shown?.currentSrc.endsWith(".avif") ?? false;
    const sharp = avif ? poster.zoom.avif : poster.zoom.webp;
    this.image.src = shown?.currentSrc || sharp;
    if (this.image.src !== new URL(sharp, location.href).href) {
      const full = new Image();
      full.onload = () => {
        if (this.poster === poster) this.image.src = sharp;
      };
      full.src = sharp;
    }

    this.scrollY = scrollY;
    document.documentElement.classList.add("viewer-open");
    this.closing = false;
    this.dialog.showModal();
    history.pushState({ ...(history.state ?? {}), viewer: poster.id }, "");
    requestAnimationFrame(() => {
      this.fit(false);
      this.dialog.classList.add("is-open");
      this.dialog.querySelector<HTMLElement>(".viewer__close")!.focus();
    });
  }

  /** Every close goes through history, so the entry opening pushed is always consumed. */
  private requestClose(): void {
    if (this.closing) return;
    this.closing = true;
    if (history.state?.viewer) history.back();
    else this.close();
  }

  private close(): void {
    window.clearTimeout(this.pendingClose);
    if (!this.dialog.open) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    this.dialog.classList.remove("is-open");
    const finish = () => {
      this.dialog.close(); // the browser restores focus here, which can scroll the poster into view…
      document.documentElement.classList.remove("viewer-open");
      this.returnTo?.focus({ preventScroll: true });
      window.scrollTo({ top: this.scrollY, behavior: "instant" }); // …so put the hallway back exactly
      this.poster = null;
      this.closing = false;
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else window.setTimeout(finish, parseFloat(getComputedStyle(this.dialog).transitionDuration) * 1000 || 0);
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.dialog.requestFullscreen();
    } catch {
      this.fullscreen.hidden = true; // not allowed here; the overlay already fills the window
    }
  }

  // ---------- Geometry ----------

  private get box(): DOMRect {
    return this.stage.getBoundingClientRect();
  }

  private get fitScale(): number {
    const { width, height } = this.box;
    return Math.min(width / this.w, height / this.h);
  }

  private get maxScale(): number {
    return Math.max(this.fitScale, 2 / devicePixelRatio);
  }

  private point(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const box = this.box;
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  private fit(animate: boolean): void {
    this.s = this.fitScale;
    this.tx = (this.box.width - this.w * this.s) / 2;
    this.ty = (this.box.height - this.h * this.s) / 2;
    this.apply(animate);
  }

  /** Keep the same relative zoom and centre when the stage changes size. */
  private refit(): void {
    const relative = this.s / this.fitScale || 1;
    this.s = this.fitScale * relative;
    this.clamp();
    this.apply(false);
  }

  private zoomTo(scale: number, at: { x: number; y: number }, animate: boolean): void {
    const next = Math.min(Math.max(scale, this.fitScale), this.maxScale);
    this.tx = at.x - ((at.x - this.tx) * next) / this.s;
    this.ty = at.y - ((at.y - this.ty) * next) / this.s;
    this.s = next;
    this.clamp();
    this.apply(animate);
  }

  private zoomBy(factor: number, animate: boolean, at?: { x: number; y: number }): void {
    const box = this.box;
    this.zoomTo(this.s * factor, at ?? { x: box.width / 2, y: box.height / 2 }, animate);
  }

  private toggleZoomAt(at: { x: number; y: number }, animate: boolean): void {
    if (this.s > this.fitScale * 1.05) this.fit(animate);
    else this.zoomTo(this.fitScale * DOUBLE_ZOOM, at, animate);
  }

  /** Centre an image smaller than the stage; otherwise keep its edges from coming inside the stage. */
  private clamp(): void {
    const { width, height } = this.box;
    const sw = this.w * this.s;
    const sh = this.h * this.s;
    this.tx = sw <= width ? (width - sw) / 2 : Math.min(0, Math.max(width - sw, this.tx));
    this.ty = sh <= height ? (height - sh) / 2 : Math.min(0, Math.max(height - sh, this.ty));
  }

  private apply(animate: boolean): void {
    this.image.classList.toggle("is-animating", animate && !matchMedia("(prefers-reduced-motion: reduce)").matches);
    this.image.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.s})`;
    this.dialog.classList.toggle("is-zoomed", this.s > this.fitScale * 1.01);
    this.level.textContent = `${Math.round((this.s / this.fitScale) * 100)}%`;
  }

  // ---------- Input ----------

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    // Trackpad pinch arrives as ctrl+wheel with small deltas; mouse wheels as larger ones.
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.zoomBy(Math.exp(-delta * WHEEL_SPEED * (e.ctrlKey ? 4 : 1)), false, this.point(e));
  }

  private onPointerDown(e: PointerEvent): void {
    this.lastPointerType = e.pointerType;
    this.stage.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, this.point(e));
    this.moved = false;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), s: this.s, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const now = this.point(e);
    this.pointers.set(e.pointerId, now);
    if (Math.hypot(now.x - prev.x, now.y - prev.y) > 0) this.moved = this.moved || Math.hypot(now.x - prev.x, now.y - prev.y) > 2;

    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // Pan by how far the midpoint moved, then zoom around it.
      this.tx += mid.x - this.pinch.mid.x;
      this.ty += mid.y - this.pinch.mid.y;
      this.pinch.mid = mid;
      this.zoomTo(this.pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.distance), mid, false);
    } else if (this.pointers.size === 1) {
      this.tx += now.x - prev.x;
      this.ty += now.y - prev.y;
      this.clamp();
      this.apply(false);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const at = this.pointers.get(e.pointerId) ?? this.point(e);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.moved || this.pointers.size > 0) return;

    if (e.pointerType === "touch") {
      // Double-tap toggles zoom (mouse uses dblclick).
      const now = performance.now();
      if (now - this.lastTap.t < TAP_MS && Math.hypot(at.x - this.lastTap.x, at.y - this.lastTap.y) < TAP_SLOP) {
        window.clearTimeout(this.pendingClose);
        this.lastTap.t = 0;
        this.toggleZoomAt(at, true);
        return;
      }
      this.lastTap = { t: now, x: at.x, y: at.y };
    }
    // A tap on the backdrop (outside the poster) closes, but only when not zoomed in. On touch it waits
    // out the double-tap window first.
    const inside = at.x >= this.tx && at.x <= this.tx + this.w * this.s && at.y >= this.ty && at.y <= this.ty + this.h * this.s;
    if (!inside && !this.dialog.classList.contains("is-zoomed")) {
      window.clearTimeout(this.pendingClose);
      this.pendingClose = window.setTimeout(() => this.requestClose(), e.pointerType === "touch" ? TAP_MS : 0);
    }
  }

  private onKey(e: KeyboardEvent): void {
    if ((e.target as Element).closest("button") && (e.key === "Enter" || e.key === " ")) return;
    const box = this.box;
    const pan = (dx: number, dy: number) => {
      this.tx += dx * box.width * PAN_STEP;
      this.ty += dy * box.height * PAN_STEP;
      this.clamp();
      this.apply(true);
    };
    const keys: Record<string, () => void> = {
      "+": () => this.zoomBy(STEP, true),
      "=": () => this.zoomBy(STEP, true),
      "-": () => this.zoomBy(1 / STEP, true),
      _: () => this.zoomBy(1 / STEP, true),
      "0": () => this.fit(true),
      ArrowLeft: () => pan(1, 0),
      ArrowRight: () => pan(-1, 0),
      ArrowUp: () => pan(0, 1),
      ArrowDown: () => pan(0, -1),
    };
    const run = keys[e.key];
    if (run && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      run();
    }
  }
}

function icon(name: "close" | "plus" | "minus"): string {
  const paths = {
    close: "M5 5l10 10M15 5L5 15",
    plus: "M10 4v12M4 10h12",
    minus: "M4 10h12",
  };
  return `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="${paths[name]}"/></svg>`;
}
