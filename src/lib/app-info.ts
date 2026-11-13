// The product name, in one place for code that renders it. (The desktop app,
// installers, Docker and docs carry the name in their own config files — see
// electron-builder.yml, electron/main.js's APP_NAME, README.md.)
//
// Deliberately NOT renamed, because existing installs depend on them:
//   • the desktop data folder (…/BuildVerse) and `buildverse.db` / `buildverse-*.db` file names
//   • BUILDVERSE_DATA_DIR, the `bv_session` cookie, `bv-*` localStorage keys
//   • the electron appId (com.buildverse.app), the repo, and the Docker image path
export const APP_NAME = "Upshift Garage";
export const APP_NAME_SHORT = "Upshift";
