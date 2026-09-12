# Atlas History application

The React, React Three Fiber and Tone.js application behind the front page sequences. It serves the shared `walkthrough` folder as its public root, so the catalogue, the scenario files and the event assets are the same files the static piece uses.

## Commands

`npm install` installs the dependencies. `npm run dev` serves the application on port 5173 with the mock Reactor proxied from port 8787, which `npm run reactor` starts. `npm run build` type checks and builds to `dist`. `npm test` runs the unit tests for the beat tracks, the veil, the master clock and the subtitle cues. `npm run shotlist` prints the shot list from the scenario files.

Two query parameters help review. `speed` multiplies frame time, and `startAt` seeks to a timeline second when the sequence begins. `live=0` bypasses the Reactor and uses the fallback source directly.

## Layers

`src/sequence` holds the beat tracks with the shared curve and the minimum cut, the veil windows, the master clock and the alignment. `src/audio` holds the bus table, the ducker, the drones, the riser and the room tone. `src/scene` holds the page, ghost, photograph and world surfaces and the camera rig. `src/subtitles` and `src/overlay` hold the two lanes and the cards. `src/world` holds the world source with the live Reactor and the fallback swap. `src/data` holds the scenario schema, the catalogue client and the preloader.

## Assets

Raw recordings, scans and archive bundles are not stored in Git. Place those inputs in a local `raw` folder before running `npm run assets`. Substitutions in the current asset set are recorded in `../walkthrough/PLACEHOLDERS.md`.
