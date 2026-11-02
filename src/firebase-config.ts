// Firebase web app config. These values identify the project to the browser and are public by design;
// access is controlled by Firebase Authentication's authorized domains, not by keeping them secret.

import type { FirebaseOptions } from "firebase/app";

/** Set by `npm run dev:emulator` to use the local Auth emulator instead of the real project. */
export const AUTH_EMULATOR_URL: string | undefined = import.meta.env.VITE_AUTH_EMULATOR;

const production: FirebaseOptions = {
  apiKey: "AIzaSyARLGKUJJUk2sT7nZBu4ceEiUng-xBcbd8",
  authDomain: "curious-shit.firebaseapp.com",
  projectId: "curious-shit",
  appId: "1:742779553729:web:75c3f4d22c461254909140",
};

const emulator: FirebaseOptions = {
  apiKey: "demo-key",
  authDomain: "demo-curious-shit.firebaseapp.com",
  projectId: "demo-curious-shit",
  appId: "demo-app",
};

export const firebaseConfig: FirebaseOptions = AUTH_EMULATOR_URL ? emulator : production;
