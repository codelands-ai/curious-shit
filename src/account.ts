// auth_control and the sign-in dialog. Firebase itself lives in auth.ts and loads only when needed:
// on "Sign in to react", after the first paint for a visitor who signed in before, or when an email
// sign-in link is opened. If it can't load, the control disappears and the gallery carries on.

import type { AuthApi, Viewer } from "./auth.ts";

const SIGNED_IN_FLAG = "cs.signedIn"; // "1" while signed in, so we know to load Firebase early

type Panel = "choose" | "sent" | "confirm";
const HEADINGS: Record<Panel, string> = {
  choose: "Sign in to react",
  sent: "Check your email",
  confirm: "Confirm your email",
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let loading: Promise<AuthApi | null> | null = null;
let load: () => Promise<AuthApi | null> = () => Promise.resolve(null); // replaced by startAccount()
let openDialogRef: (() => void) | null = null;

/** Open the sign-in dialog (used by the reaction bar's signed-out prompt). */
export function openSignIn(): void {
  openDialogRef?.();
}
let current: Viewer | null = null;
const listeners = new Set<(viewer: Viewer | null) => void>();

/** The signed-in visitor's Firebase ID token, or null. Doesn't load Firebase for signed-out visitors. */
export async function getIdToken(): Promise<string | null> {
  if (!loading && localStorage.getItem(SIGNED_IN_FLAG) !== "1") return null;
  const api = await load();
  return api ? api.getIdToken() : null;
}

/** Called now with the current state and again whenever someone signs in or out. */
export function onViewerChange(listener: (viewer: Viewer | null) => void): void {
  listeners.add(listener);
  listener(current);
}

export function startAccount(): void {
  const ui = {
    signIn: $<HTMLButtonElement>("auth-signin"),
    account: $("auth-account"),
    avatar: $<HTMLButtonElement>("auth-avatar"),
    initial: $("auth-initial"),
    label: $("auth-label"),
    menu: $("auth-menu"),
    who: $("auth-who"),
    signOut: $<HTMLButtonElement>("auth-signout"),
    dialog: $<HTMLDialogElement>("signin"),
    heading: $("signin-heading"),
    google: $<HTMLButtonElement>("signin-google"),
    emailForm: $<HTMLFormElement>("signin-email-form"),
    email: $<HTMLInputElement>("signin-email"),
    sentTo: $("signin-sent-to"),
    confirmForm: $<HTMLFormElement>("signin-confirm-form"),
    confirmEmail: $<HTMLInputElement>("signin-confirm-email"),
    error: $("signin-error"),
  };

  // ---------- Rendering ----------

  const render = (viewer: Viewer | null) => {
    current = viewer;
    if (viewer) localStorage.setItem(SIGNED_IN_FLAG, "1");
    else localStorage.removeItem(SIGNED_IN_FLAG);

    ui.signIn.hidden = viewer !== null;
    ui.account.hidden = viewer === null;
    if (viewer) {
      ui.initial.textContent = viewer.initial;
      ui.label.textContent = `Account: ${viewer.label}`;
      ui.who.textContent = viewer.label;
      if (ui.dialog.open) closeDialog();
    } else {
      closeMenu();
    }
    listeners.forEach((l) => l(viewer));
  };

  const hideControl = () => {
    ui.signIn.hidden = true;
    ui.account.hidden = true;
    if (ui.dialog.open) closeDialog();
  };

  const showError = (message: string | null) => {
    ui.error.textContent = message ?? "";
    ui.error.hidden = !message;
  };

  const setBusy = (busy: boolean) => {
    ui.dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input").forEach((el) => {
      if (!el.matches(".signin__close")) el.disabled = busy;
    });
    ui.dialog.toggleAttribute("aria-busy", busy);
  };

  // ---------- Loading Firebase ----------

  load = () =>
    (loading ??= import("./auth.ts").then(
      (mod) => {
        const api = mod.createAuth();
        describe = mod.describeAuthError;
        api.onChange(render);
        return api;
      },
      (err: unknown) => {
        console.error("Couldn't load sign-in", err);
        hideControl();
        return null;
      },
    ));
  let describe: (err: unknown) => string | null = () => "Sign-in didn't work. Try again in a moment.";

  const attempt = async (action: (api: AuthApi) => Promise<void>, onDone?: () => void) => {
    showError(null);
    setBusy(true);
    try {
      const api = await load();
      if (!api) return;
      await action(api);
      onDone?.();
    } catch (err) {
      console.error("Sign-in failed", err);
      showError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  // ---------- Dialog ----------

  const showPanel = (panel: Panel) => {
    ui.heading.textContent = HEADINGS[panel];
    ui.dialog.querySelectorAll<HTMLElement>("[data-panel]").forEach((el) => {
      el.hidden = el.dataset.panel !== panel;
    });
  };

  const openDialog = (panel: Panel = "choose") => {
    showError(null);
    showPanel(panel);
    if (!ui.dialog.open) {
      ui.dialog.showModal();
      requestAnimationFrame(() => ui.dialog.classList.add("is-open"));
    }
    void load();
  };

  const closeDialog = () => {
    if (!ui.dialog.open || ui.dialog.classList.contains("is-closing")) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    ui.dialog.classList.remove("is-open");
    ui.dialog.classList.add("is-closing");
    const finish = () => {
      ui.dialog.classList.remove("is-closing");
      ui.dialog.close();
    };
    if (reduce) finish();
    else window.setTimeout(finish, parseFloat(getComputedStyle(ui.dialog).transitionDuration) * 1000 || 0);
  };

  openDialogRef = () => openDialog();
  ui.signIn.addEventListener("pointerenter", () => void load(), { once: true });
  ui.signIn.addEventListener("focus", () => void load(), { once: true });
  ui.signIn.addEventListener("click", () => openDialog());

  ui.dialog.addEventListener("cancel", (e) => {
    e.preventDefault(); // Escape: run our closing fade instead of closing instantly
    closeDialog();
  });
  ui.dialog.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target === ui.dialog || target.closest("[data-close]")) closeDialog(); // backdrop or close buttons
  });

  ui.google.addEventListener("click", () => void attempt((api) => api.signInWithGoogle()));

  ui.emailForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = ui.email.value.trim();
    void attempt(
      (api) => api.sendEmailLink(email),
      () => {
        ui.sentTo.textContent = email;
        showPanel("sent");
      },
    );
  });

  ui.confirmForm.addEventListener("submit", (e) => {
    e.preventDefault();
    void attempt((api) => api.completeEmailLink(ui.confirmEmail.value.trim()));
  });

  // ---------- Account menu ----------

  function closeMenu() {
    ui.menu.hidden = true;
    ui.avatar.setAttribute("aria-expanded", "false");
  }

  ui.avatar.addEventListener("click", () => {
    const opening = ui.menu.hidden;
    ui.menu.hidden = !opening;
    ui.avatar.setAttribute("aria-expanded", String(opening));
    if (opening) ui.signOut.focus();
  });
  document.addEventListener("click", (e) => {
    if (!ui.menu.hidden && !ui.account.contains(e.target as Node)) closeMenu();
  });
  ui.account.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !ui.menu.hidden) {
      closeMenu();
      ui.avatar.focus();
    }
  });
  ui.signOut.addEventListener("click", () => {
    closeMenu();
    void load().then((api) => api?.signOut());
  });

  // ---------- Start ----------

  const params = new URLSearchParams(location.search);
  if (params.get("mode") === "signIn" && params.has("oobCode")) {
    // Arrived from an email sign-in link.
    void load().then((api) => {
      if (!api?.hasPendingEmailLink()) return;
      const saved = api.savedEmail();
      if (saved) {
        api.completeEmailLink(saved).catch((err: unknown) => {
          console.error("Email link sign-in failed", err);
          openDialog("choose");
          showError(describe(err));
        });
      } else {
        openDialog("confirm"); // different browser or device: Firebase needs the address again
      }
    });
  } else if (localStorage.getItem(SIGNED_IN_FLAG) === "1") {
    // Signed in before: keep the control hidden until Firebase says who, after the first poster paints.
    const later = () => ("requestIdleCallback" in window ? requestIdleCallback(() => void load()) : setTimeout(() => void load(), 1));
    if (document.readyState === "complete") later();
    else addEventListener("load", later, { once: true });
  } else {
    ui.signIn.hidden = false;
  }
}
