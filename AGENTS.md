# AGENTS.md

## Cursor Cloud specific instructions

LocTag is a pure frontend SPA (React + TypeScript + Vite). There is **no local backend**: it talks directly to a **live, hosted Firebase project** (`loctag-p84-p85`) for Auth, Firestore, and Storage. No Firebase emulator is configured, so running locally still hits production Firebase.

- Standard commands live in `package.json`/`README.md`: `npm run dev` (Vite dev server on port **5173**), `npm run lint`, `npm run build` (runs `tsc -b` then `vite build`).
- Firebase credentials are **hardcoded fallbacks** in `src/services/firebase/config.ts`, so the app runs without any `.env`. Optional overrides come from `VITE_FIREBASE_*` env vars.
- Core functionality (tag search, region/PDF viewing, admin) is **gated behind Google sign-in plus membership in the Firestore `authorizedUsers` collection**. Without an authorized Google account you can only verify that the app loads and that clicking "Entrar com Google" opens the Firebase/Google auth flow — the search box stays disabled (`disabled={!user}`) until a user is signed in. The `/admin` link only renders for `leojaime20@gmail.com`.
- Firebase CLI files (`.firebaserc`, `firebase.json`, `firestore.rules`, `storage.rules`) are for deploy/provisioning only and are not needed for `npm run dev`.
