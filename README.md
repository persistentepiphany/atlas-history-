# Atlas History

Atlas History is a cinematic walkthrough of historical front pages. The runnable browser piece is stored in `walkthrough`. The application source handoff is stored separately in `typescript-handoff`.

## Walkthrough

Run `npm run walkthrough` from the repository root, then open `http://localhost:5187/Front%20Pages.dc.html`. The catalogue contains twelve events, with playable Apollo 11 and Berlin Wall sequences backed by the supplied local page and audio assets.

![Front Pages catalogue](preview.png)

## Application

The `typescript-handoff` folder holds the application, built with React, React Three Fiber, Theatre and Tone, and now carries the generated world. Install its dependencies and run `npm run dev` from that folder. The world of an event is described entirely by the `world` block of its scenario file, so a new event is a new scenario file and nothing else, and both existing events run through the same code. The verified Reactor command surface is recorded in `REACTOR_NOTES.md`. Raw source media is intentionally excluded from version control, and remaining asset substitutions are recorded in `walkthrough/PLACEHOLDERS.md`.
