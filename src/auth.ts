// Firebase Authentication, loaded on demand by account.ts (never on the critical path).
// Nothing from Firebase is stored by this site; the Worker (phase 6) only ever sees the ID token.

import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  initializeAuth,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { AUTH_EMULATOR_URL, firebaseConfig } from "./firebase-config.ts";

// Firebase's recommended pattern: remember the address between sending the link and opening it,
// then delete it. It never leaves the browser.
const EMAIL_KEY = "cs.emailForSignIn";

export interface Viewer {
  uid: string;
  initial: string;
  label: string;
}

export interface AuthApi {
  onChange(listener: (viewer: Viewer | null) => void): void;
  signInWithGoogle(): Promise<void>;
  sendEmailLink(email: string): Promise<void>;
  /** True when the current URL is a sign-in link that still needs completing. */
  hasPendingEmailLink(): boolean;
  /** The address saved when the link was sent, if this is the same browser. */
  savedEmail(): string | null;
  completeEmailLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  getIdToken(): Promise<string | null>;
}

export function createAuth(): AuthApi {
  const app = initializeApp(firebaseConfig);
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  if (AUTH_EMULATOR_URL) connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });

  const toViewer = (user: User | null): Viewer | null => {
    if (!user) return null;
    const label = user.displayName || user.email || "Signed in";
    return { uid: user.uid, label, initial: (label.trim()[0] ?? "?").toUpperCase() };
  };

  return {
    onChange(listener) {
      onAuthStateChanged(auth, (user) => listener(toViewer(user)));
    },

    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    },

    async sendEmailLink(email) {
      await sendSignInLinkToEmail(auth, email, {
        // Come back to the gallery itself; account.ts completes the sign-in on load.
        url: `${location.origin}/`,
        handleCodeInApp: true,
      });
      localStorage.setItem(EMAIL_KEY, email);
    },

    hasPendingEmailLink() {
      return isSignInWithEmailLink(auth, location.href);
    },

    savedEmail() {
      return localStorage.getItem(EMAIL_KEY);
    },

    async completeEmailLink(email) {
      await signInWithEmailLink(auth, email, location.href);
      localStorage.removeItem(EMAIL_KEY);
      // Drop the one-time code from the address bar and history.
      history.replaceState(history.state, "", `${location.origin}/`);
    },

    async signOut() {
      await firebaseSignOut(auth);
    },

    async getIdToken() {
      await auth.authStateReady();
      return auth.currentUser ? auth.currentUser.getIdToken() : null;
    },
  };
}

/** A short, human message for a Firebase Auth error. */
export function describeAuthError(err: unknown): string | null {
  const code = (err as { code?: string }).code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return null; // the visitor changed their mind; say nothing
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
    case "auth/invalid-email":
    case "auth/missing-email":
      return "That doesn't look like an email address.";
    case "auth/quota-exceeded":
      return "Email sign-in is full for today. Try Google, or come back tomorrow.";
    case "auth/invalid-action-code":
    case "auth/expired-action-code":
      return "That sign-in link has expired or was already used. Ask for a new one.";
    case "auth/network-request-failed":
      return "Couldn't reach the sign-in service. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/unauthorized-domain":
    case "auth/unauthorized-continue-uri":
      return "Sign-in isn't set up for this address yet.";
    default:
      return "Sign-in didn't work. Try again in a moment.";
  }
}
