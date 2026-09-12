# Atlas History

Atlas History is a cinematic walkthrough of historical front pages. The runnable browser piece is stored in `walkthrough`. The application source handoff is stored separately in `typescript-handoff`.

## Walkthrough

Run `npm run walkthrough` from the repository root, then open `http://localhost:5187/Front%20Pages.dc.html`. The catalogue contains twelve events, with playable Apollo 11 and Berlin Wall sequences backed by the supplied local page and audio assets.

![Front Pages catalogue](preview.png)

## Application

The `typescript-handoff` folder holds the React, React Three Fiber and Tone.js application. Run `npm install` and `npm run dev` inside it, then open `http://localhost:5173`. It serves the `walkthrough` folder as its public root, so both pieces share the catalogue, the scenario files and the assets. Raw source media is intentionally excluded from version control. Asset substitutions are recorded in `walkthrough/PLACEHOLDERS.md`, the asset list in `INVENTORY.md`, and the state of the data branch in `DATA_BRANCH.md`.
