# Atlas History

Atlas History is a cinematic walkthrough of historical front pages. The runnable browser piece is stored in `walkthrough`. The application source handoff is stored separately in `typescript-handoff`.

## Walkthrough

Run `npm install` once, then run `npm run dev` and open the localhost address printed by Vite. The primary interface is a compiled React and TypeScript application. It presents the catalogue as a reading shelf, opens each available newspaper in a smooth zoomable reader, and keeps playback behind a separate Begin control.

Run `npm run build` to produce the static deployment in `dist`. The build uses a relative base path so it can be hosted at a domain root or beneath a project path. The earlier standalone walkthrough remains available at `Front%20Pages.dc.html` through the same development server.

![Front Pages catalogue](preview.png)

## TypeScript handoff

The `typescript-handoff` folder preserves the React, React Three Fiber, Theatre, audio, data, scenario, shader, overlay and mock Reactor source. Raw source media is intentionally excluded from version control. Remaining asset substitutions are recorded in `walkthrough/PLACEHOLDERS.md`.

## Newspaper previews

Run `npm run fetch:ia` to refresh Internet Archive front page previews for catalogue events without playable scenarios. Use `npm run fetch:ia -- --event titanic1912` to refresh one event. Each successful fetch writes a local page image and a source manifest. A preview does not mark an event playable because a complete scenario and illustration crop are still required.

## Narration

Run `npm run voices` with `ELEVENLABS_API_KEY` in the environment to refresh the opening narration. The selected voice and model are fixed in `voices.json`. Per event hashes prevent unchanged lines from being generated again. The key is read from the environment and is never written to the repository.
