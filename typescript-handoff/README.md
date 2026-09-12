# Application source

This folder holds the application. The scene, sequence, audio, catalogue, overlay, world and data layers are here, `scenarios` holds the event contracts, `server` holds the Reactor session endpoint, and `scripts` holds the asset, seed, pre-render, verification and shot list utilities. The browser walkthrough beside it is reference only and is not edited by this application, though the application serves its assets, so a page, photograph, recording or film dropped into `walkthrough/assets` is immediately available under `/assets`.

## Running

Install the dependencies with `npm install`, then `npm run dev` and open the address it prints. The development server also answers the scenario requests and the Reactor session request, so nothing else needs to be started. Without a key the session endpoint answers in mock mode and the world plays from the pre-rendered film.

Query parameters steer a visit. `event` opens a named scenario, including one not listed in `scenarios/index.json`. `live=1` forces the live model first and `live=0` forces the pre-rendered film. `autostart=1` with `at` starts at a second. `speed` multiplies the clock, `debug=1` publishes the sequence and world state for the verification script, `studio=1` loads the keyframe editor, and `prerender=1` mounts the world alone for recording.

## The world

An event's world is described entirely by the `world` block of its scenario. The block names the fallback film and the offsets of each stop within it, the objective, the surface grade, and the stops. A stop carries its time and label, its seed as an image path or an instruction to continue from the previous frame, its shot card and the clause of what must not appear, its camera rail, the hold before it can be advanced, the archival recording and narrator line that lead it, and whether its last frame is kept for the provenance mark.

Four implementations sit behind one interface. The live source streams a Reactor session, seeding each stop and playing its rail as pose commands. The pre-rendered source plays the recorded film and seeks by the recorded offsets. The seed source draws the stop seeds under the same rail and is the floor, so a visit always has a picture. The orchestrator owns the active source, the swap between them when one fails, the crossfade, the audio lead, the grade and the frame kept for the mark. Model choice and every timing constant come from `reactor.config.json`.

The pre-rendered film is the default path. `reactor.config.json` carries `preferFallback` and `liveCleanRunsRequired`, and the recorded film leads the chain until the live model has carried a visit through every stop without a swap that many times. A clean visit is counted on the return beat and the count is kept in the browser, so the demonstration machine promotes the live path only once it has earned it, and `live=1` forces the live path at any time.

## Commands

`npm run dev` serves the application. `npm run typecheck` checks the types. `npm run server` runs the session endpoint alone. `npm run seeds` writes the placeholder seed images named by the scenarios. `npm run prerender` records each event's world to its fallback film and writes the stop offsets back into the scenario. `npm run verify` plays each event end to end, checks the stops, the source and the captured frame, and then kills the network in the middle of the world and checks that the swap keeps the picture alive. `npm run shotlist` prints the shot list. `npm run assets` prepares the source media from a local `raw` folder.

The pre-render and verification scripts drive a browser. Set `PRERENDER_BROWSER` to a Chromium executable when the environment does not carry the one the browser driver expects.

## Reactor

The key is read from `REACTOR_API_KEY` in the server process, which mints a session scoped token and returns it to the browser. The key never appears in a file, in the browser or in the recorded film. Setting `REACTOR_MOCK=1` answers with a mock token and makes the browser fall through to the pre-rendered film, which is how the application runs with no key. The verified command surface of the software development kit is recorded in `REACTOR_NOTES.md` at the repository root.

## Media

Raw recordings, scans and archive bundles are not stored in version control. Place those inputs in a local `raw` folder before running the asset preparation script.
