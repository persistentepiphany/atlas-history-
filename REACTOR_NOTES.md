# Reactor notes

Verified against `@reactor-team/js-sdk` 3.0.2 and the typed model packages `@reactor-models/lingbot-world-2` 1.0.1 and `@reactor-models/lingbot` 1.0.1, read from the installed type definitions and compiled sources in `node_modules` on 12 September 2026. The registry versions were the current ones at that date. The API is experimental and bills per session second while a graphics processor is held, so a session is opened at the door beat and closed on return rather than held for the length of a visit.

## Authentication

The server mints a session token with `POST https://api.reactor.inc/tokens`, carrying the key in the `Reactor-API-Key` header. The response body is `{ "jwt": "..." }` and the token is valid for six hours. The request body scopes the token, and the scope this application sends limits it to one model and two sessions.

```
{ "authorization_details": [ { "type": "session", "resources": { "models": { "match": ["reactor/lingbot-world-2"] } }, "constraints": { "max_sessions": 2 } } ] }
```

The key is read from `REACTOR_API_KEY` in the server process and never reaches the browser. The browser receives only the token, which it passes to the SDK constructor as `jwt`.

## Client surface

The imperative class is `Reactor`, constructed with `{ modelName, jwt, modelTracks, apiUrl?, readyTimeoutMs?, logLevel? }`. Declaring `modelTracks` in the constructor lets the transport prepare its offer while the session is still being created, which shortens the wait for the first frame. The calls this application uses are `connect()`, `uploadFile(file, { name })`, `sendCommand(name, data)`, `disconnect()` and `[Symbol.dispose]()`, with `getStatus()`, `getLastError()` and the `statusChanged`, `trackReceived`, `message` and `error` events for state.

Two behaviours shape the wrapper. First, `sendCommand` never rejects. A failure is reported through `getLastError()` and the `error` event while the call itself resolves undefined, so the wrapper reads the error after every command and converts it into a thrown one. Second, the model publishes its picture on a named track rather than a URL, delivered by `trackReceived` as a `MediaStream`, which the world layer assigns to the video element's `srcObject`.

## Command names and payloads

The typed packages are thin wrappers that call `sendCommand` with the wire names below, which were read out of their compiled sources rather than inferred from the documentation. The world layer sends these names through the base SDK, so no per model package is a dependency.

LingBot World 2 accepts `set_image` with `{ image }` where the value is the `FileRef` returned by `uploadFile`, `set_prompt` with `{ prompt }`, `start`, `pause`, `resume`, `reset`, `set_seed` with `{ seed }`, `set_attn_window`, `set_kv_cache_reset`, `trigger_kv_cache_reset`, and the camera commands `set_camera_pose`, `set_move_longitudinal`, `set_move_lateral`, `set_look_horizontal`, `set_look_vertical` and `set_rotation_speed_deg`. LingBot accepts the same seeding and lifecycle commands, with `set_movement` in place of the two translation commands and no pose channel.

The pose payload is `{ camera_pose: number[] }`, a flat list whose length is a multiple of six. Each group of six is `[rx, ry, rz, tx, ty, tz]`, a rotation in radians relative to the camera's current orientation followed by a translation relative to its current position. Six values apply one motion across the next chunk, one group per frame gives per frame control, and any other length is resampled to the chunk. An empty list returns control to the discrete move and look commands. Values are clamped by the model, rotations to a half turn and translations to one hundred units, so any payload is safe to send. The rail therefore sends one six value group per tick and lets the model spread it over the next chunk.

The messages the world layer listens for are `state`, `command_error`, `chunk_complete`, `image_accepted`, `prompt_accepted`, `conditions_ready`, `generation_started` and `generation_complete`. The video track is named `main_video` and is receive only.

## Sequence for one stop

A stop is seeded by uploading its image, sending `set_image` with the returned reference, sending `set_prompt` with the shot card, then `start`. A reference image is required before generation begins and a change of image during generation has no effect, so moving to the next stop sends `reset`, seeds again, clears the accumulated context with `trigger_kv_cache_reset` so the new picture is not haunted by the previous one, and starts again. A prompt may be changed at any time and takes effect on the next chunk, which is what allows a stop to be steered without a reset.

## Limitations

The token endpoint and the model hosts were unreachable from the environment where this work was carried out, so the live path is exercised against the recorded command surface rather than a running session, and the numbers in `reactor.config.json` govern the timeouts that decide when it is abandoned. Because generation restarts automatically when a run completes while the session is still started, a long stop continues without further commands, and the cost of a visit is therefore the length of the world phase rather than the number of stops.
