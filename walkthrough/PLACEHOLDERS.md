# Placeholders

Each entry names an asset that is not yet real, what stands in for it, and what replaces it. The application and the static walkthrough share these files.

## Apollo 11

- A01 Canberra Times front page. The supplied file is a screenshot of the One Giant Leap editorial clipping at 1872 by 4056 pixels, not the Trove page scan. The read, the ghost and the return play on this clipping. Word boxes were derived from measured line bands and the transcribed text, not from OCR. Because the clipping carries no photograph, the door beat pushes into the Washington Post photograph on A02 instead. Dropping the Trove JP2 into raw and rerunning the asset script restores the specified framing.
- A03 Los Angeles Times. Grey frame. The Internet Archive zip was not in the pack.
- G01 onboard photograph. Mid grey frame.
- V01 narrator lines, V02 column read, V03 memo read. No voice files were supplied, so the master clock runs on frame time and the lanes carry the text. The word wash runs on a synthetic alignment at 2.6 words per second from 0:30. The memo clause is highlighted from real word boxes in the Safire PDF. When a voice file is listed in the scenario audio table under the line id it drives the clock, and an alignment file beside a column read drives the wash.
- N01 to N05. The one hour highlight reel was not supplied. The five onboard recordings stand in, one per beat, played from their start on the archive bus and faded at the beat end.
- R01 fallback world. No MP4 exists at `assets/apollo11/video/r01.mp4`, so the world source resolves to no video within the 1500 ms swap window and the world plane carries the A04 crop with the television treatment.
- JFK. The Rice University passage streams from archive.org and enters the graph through a media element with anonymous CORS. Where the network blocks the file, the memo plays without it.

## Berlin 1989

- B01 word boxes. The ZEFYS PDF carries no text layer, so the read drifts down forty synthetic line boxes in the lead column while the dialogue lane carries the transcribed opening sentences.
- B03 Tagesspiegel, B04 New York Times, B05 press conference still, K02 Tagesschau title. Grey frames.
- K01, K02, K03 archive audio and W01 to W03 voices. Not supplied. The lanes carry the text.
- R02 fallback world. No MP4 and no seed, so the world plane carries a dark grey field with the film treatment.

## Audio generated at runtime

- Room tone. Brown noise through a low pass, rendered once per session and looped on the bed bus, until a recorded bed is placed under `assets/library/beds`.
- Room impulse. A four second decaying noise tail with a slow low pass stands in for the OpenAIR measurement inside the world convolver.
- Foley F01 to F04. Short filtered noise bursts and a sine tone at the foley trim, panned toward the object, until sample files are placed under `assets/library/foley`.
- Drones and riser. These are synthesised in the graph as specified and are not placeholders.

## Frame

- The hub is drawn by the same camera as the sequence at z 7, so the handoff into the read is a camera move rather than a viewer crossfade.
- Rack focus, warmth, vignette and grain are postprocessing effects in the application and DOM compositing layers in the static walkthrough.
- The English rendering over Neues Deutschland blocks was written by hand and carries the generated layer, so the provenance key hides it.
