// Firebase web app config. These values identify the project to the browser and are public by design;
// access is controlled by Firebase Authentication's authorized domains, not by keeping them secret.

import type { FirebaseOptions } from "firebase/app";

/** Set by `npm run dev:emulator` to use the local Auth emulator instead of the real project. */
export const AUTH_EMULATOR_URL: string | undefined = import.meta.env.VITE_AUTH_EMULATOR;

const production: FirebaseOptions = {
  // Filled in by phase 5.3 (firebase apps:sdkconfig).
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};

const emulator: FirebaseOptions = {
  apiKey: "demo-key",
  authDomain: "demo-curious-shit.firebaseapp.com",
  projectId: "demo-curious-shit",
  appId: "demo-app",
};

export const firebaseConfig: FirebaseOptions = AUTH_EMULATOR_URL ? emulator : production;
