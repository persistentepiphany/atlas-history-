# Placeholders

Each entry names an asset that is not yet real, what stands in for it, and what replaces it.

## Apollo 11

- A01 Canberra Times front page. The supplied file is a screenshot of the One Giant Leap editorial clipping at 624 by 1352 pixels, not the Trove page scan. The read, the ghost and the return play on this clipping. Word boxes were derived from measured line bands and the transcribed text, not from OCR. Because the clipping carries no photograph, the door beat pushes into the Washington Post photograph on A02 instead. Dropping the Trove JP2 into raw and rerunning the asset script restores the specified framing.
- A03 Los Angeles Times. Grey frame. The Internet Archive zip was not in the pack.
- G01 onboard photograph. Mid grey frame.
- V01 narrator lines, V02 column read, V03 memo read. No voice files were supplied, so these play silent with captions. The word highlight runs on a synthetic alignment at 2.6 words per second from 0:30. The memo clause is highlighted from real word boxes in the Safire PDF.
- N01 to N05. The one hour highlight reel was not supplied. The five onboard recordings 11_highlight_1 to 5 stand in, one per beat, played from their start and faded at the beat end.
- R01 fallback world. A dark grain field over the A04 crop, drawn in the browser. No MP4 was rendered.
- F01 to F04 foley and B01 bed. Synthesised at runtime with Web Audio at the specified levels.

## Berlin 1989

- B01 word boxes. The ZEFYS PDF carries no text layer, so the read drifts down forty synthetic line boxes in the lead column while captions carry the transcribed opening sentences.
- B03 Tagesspiegel, B04 New York Times, B05 press conference still, K02 Tagesschau title. Grey frames.
- K01, K02, K03 archive audio and W01 to W03 voices. Not supplied. Silent with captions.
- R02 fallback world. Dark grain field, no seed.

## Frame

- The hub is drawn by the same camera as the sequence at z 7 rather than by OpenSeadragon, so the handoff is a camera move rather than a viewer crossfade. The handoff source in src/hub/Hub.tsx wraps OpenSeadragon as specified.
- Rack focus, warmth, vignette and grain are DOM compositing layers in the browser piece and postprocessing effects in the handoff source.

## Added in the second pass

- Catalogue. Twelve clusters are listed from catalogue.json. Ten are not yet harvested and open nothing. The list, filters and search follow the design in the reference screenshot.
- English rendering. Neues Deutschland blocks are replaced with an English typeset overlay when the camera closes in. The translations were written by hand for this pass and carry the layer generated, so the provenance key hides them.
- Living photograph. When the door opens on a photograph the crop drifts, gains scanlines and a slow light sweep, and the world plane continues the motion. This is a placeholder for the generated segment and is labelled on screen.
- Kennedy. The Rice University passage plays from the Internet Archive highlights reel at 31:30 under the memo beat. It streams from archive.org directly, so it needs a network connection and is bypassed by the Web Audio filter chain.

## World seeds and films

- Honeysuckle Creek, Houston and wire room seeds for Apollo, and the Bornholmer bridge seed for Berlin. Drawn by `npm run seeds` from the photographs already in the pack, flattened and graded to the tonal range each shot card asks for. A real photograph dropped at the same path replaces the placeholder with no other change.
- Regulation crop for Berlin. Cut by the same script from the column region of the Neues Deutschland page, so it is a real crop rather than a placeholder.
- R01 and R02 fallback films. Recorded by `npm run prerender` from the seed source, because the network policy of the environment denies the model host, so no live session could be recorded. Rerunning the script where the host is reachable replaces both films with the live film and rewrites the stop offsets.
- Each film is written twice, once as the H.264 file the scenario names and once as a companion in the free encoding beside it, because a browser build without the patented decoder can play only the second.
