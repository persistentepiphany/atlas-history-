# Historical 3D Learning Pack

Ten source-led events for interactive learning worlds (6 well-known, 4 niche). Each world is an interpretive model: facts, press accounts, later commentary, archival images, and inferred set dressing stay labelled as such.

**Pack contents:** 10 research briefs · multi-newspaper narratives in [`event-narratives.json`](event-narratives.json) · 26 downloaded archival images · 2 Library of Congress references left source-only (host returned 403). Partition has one rights-cleared still; other events have three. No unverified newspaper pads, no distressing video stills. Full rights metadata: [`ASSET_MANIFEST.md`](ASSET_MANIFEST.md).

## Events

| Tier | Event | Date | Scene | Press |
| --- | --- | --- | --- | --- |
| Popular | [Apollo 11](research/01-apollo-11.md) | 20 Jul 1969 | *Eagle* touchdown, Sea of Tranquility | NYT, Guardian, Washington Post |
| Popular | [Berlin Wall](research/02-berlin-wall.md) | 9 Nov 1989 | Bornholmer Straße | NYT, Guardian |
| Popular | [D-Day](research/03-d-day.md) | 6 Jun 1944 | Omaha Beach, Easy Red | NYT, Guardian |
| Popular | [March on Washington](research/04-march-on-washington.md) | 28 Aug 1963 | National Mall / Lincoln Memorial | NYT, Washington Post |
| Popular | [Partition of India](research/05-partition-india.md) | 14–15 Aug 1947 | Delhi, Lahore, Punjab nodes | NYT, Manchester Guardian, Dawn |
| Popular | [Armistice 1918](research/06-armistice-1918.md) | 11 Nov 1918 | Compiègne + city windows | NYT, Manchester Guardian, New-York Tribune |
| Niche | [San Francisco 1906](research/07-san-francisco-1906.md) | 18–21 Apr 1906 | Golden Gate Park relief camp | San Francisco Call, NYT |
| Niche | [Triangle Fire](research/08-triangle-fire.md) | 25 Mar 1911 | Asch / Brown Building | New-York Tribune, Washington Herald, NYT |
| Niche | [Bandung 1955](research/09-bandung-1955.md) | 18–24 Apr 1955 | Merdeka Building | NYT, Guardian |
| Niche | [Windrush](research/10-windrush-1948.md) | 22 Jun 1948 | Tilbury Docks | Guardian, Independent |

A newspaper is a perspective, not an omniscient narrator. Each brief says whether the press piece is contemporary report, editorial, archive reprint, or later retrospective.

## Per-event brief

Each `research/NN-*.md` file holds:

- Heading, summary, full article
- Citations + press-comparison table
- Asset refs
- Full Reactor world prompt (copy whole block; keep exclusions)
- Three VEED avatar prompts (historian host, composite historical role, modern educator)
- Interaction ideas + principal caveat

Image rights live in [`ASSET_MANIFEST.md`](ASSET_MANIFEST.md) and the summary table below. Local copies are under `assets/images/`.

## Production flow

1. Write source-led narrative  
2. Fill verification ledger  
3. Build Reactor prompt + pull rights-screened images  
4. Prototype interactions  
5. Historical + accessibility review  
6. Release

## Reactor and VEED

- Paste the **full** world prompt from the event file. Prompts lock time window, place, POV, built environment, crowd level, hotspots, accessibility, and bans.
- Banned by design: anachronistic props, invented dialogue, heroic combat, trauma spectacle, fake certainty where sources are thin.
- VEED: historian host first. Label the historical-role avatar as a **composite reconstruction**; the second guide as a **modern educator**, not a witness.
- No real historical figures’ voice or face without separate legal/ethical/technical approval.

## Release checks

Ship only if the world:

- Holds the selected time-state
- Shows a visible source layer
- Labels reconstructed people and environments
- Offers captions and a low-stimulation or read-only path for trauma-adjacent material
- Blocks violence, rescue, conquest, escape, or collectible “change history” loops
- Distinguishes direct record, contemporary reporting, later interpretation, and design reconstruction on content panels

## Image library

26 files in `assets/images/`. Two rows are **source-only** (LOC host 403). Each pick rests on its **individual** source-record rights statement—not on “the article is public.” Local files are copies of the linked originals; metadata here is production notes, not a wider licence grant.

**Hard rules:** Newspaper page access ≠ image clearance. Keep creator, repository, source page, licence, and attribution in CMS. U.S. public domain ≠ automatic global clearance. NASA: attribute; no NASA logo or endorsement implication. Check share-alike before shipping derivatives.

| # | File | Event | Rights | Use boundary |
| --- | --- | --- | --- | --- |
| 01 | [`assets/images/01-apollo-aldrin-near-eagle.jpg`](assets/images/01-apollo-aldrin-near-eagle.jpg) | Apollo 11 | NARA unrestricted | Aldrin near *Eagle*, 20 Jul 1969 — post-EVA, not touchdown |
| 02 | [`assets/images/02-apollo-aldrin-full-frame.jpg`](assets/images/02-apollo-aldrin-full-frame.jpg) | Apollo 11 | PD US (NASA) | Suit / regolith / scale ref; cite NASA |
| 03 | [`assets/images/03-apollo-lm-surface.jpg`](assets/images/03-apollo-lm-surface.jpg) | Apollo 11 | NASA media rules | LM surface; no logo/endorsement; not pre-EVA |
| 04 | [`assets/images/04-berlin-potsdamer-platz-opening.jpeg`](assets/images/04-berlin-potsdamer-platz-opening.jpeg) | Berlin Wall | NARA unrestricted | Potsdamer Platz opening, 14 Nov 1989 — not Bornholmer on the 9th |
| 05 | [`assets/images/05-berlin-people-walking.jpg`](assets/images/05-berlin-people-walking.jpg) | Berlin Wall | CC BY-SA 2.0 | Berlin 1989; credit Thiémard; date uncertain |
| 06 | [`assets/images/06-berlin-checkpoint-charlie.jpg`](assets/images/06-berlin-checkpoint-charlie.jpg) | Berlin Wall | CC BY-SA 3.0 DE | Checkpoint Charlie, night of 10 Nov 1989; Bundesarchiv |
| 07 | [`assets/images/07-dday-into-the-jaws.jpg`](assets/images/07-dday-into-the-jaws.jpg) | D-Day | PD (USCG) | Omaha wade-ashore, 6 Jun 1944; credit Sargent; content note |
| 08 | [`assets/images/08-dday-eisenhower-paratroopers.jpg`](assets/images/08-dday-eisenhower-paratroopers.jpg) | D-Day | PD (US Army) | Eisenhower + 101st, Greenham Common, 5 Jun 1944 |
| 09 | [`assets/images/09-dday-approaching-omaha.jpg`](assets/images/09-dday-approaching-omaha.jpg) | D-Day | PD (US Navy) | LCVP approaching Omaha — do not re-caption as another beach |
| 10 | [`assets/images/10-march-leadership-procession.jpg`](assets/images/10-march-leadership-procession.jpg) | March on Washington | PD US (USIA) | Leaders to Lincoln Memorial, 28 Aug 1963; NARA 542010 |
| 11 | *source-only* | March on Washington | LOC: no known restrictions | Lincoln Memorial crowd (Leffler); retrieve later from [LOC 2013650621](https://www.loc.gov/pictures/item/2013650621/) |
| 12 | [`assets/images/12-march-reflecting-pool-crowd.jpg`](assets/images/12-march-reflecting-pool-crowd.jpg) | March on Washington | PD US (USIA) | Reflecting Pool view, 28 Aug 1963; NARA 542045 |
| 13 | [`assets/images/13-partition-gandhi-suhrawardy.jpg`](assets/images/13-partition-gandhi-suhrawardy.jpg) | Partition | PD (IN/PK/BD; US claim on page) | Calcutta fast, 15 Aug 1947 — not Delhi/Lahore; recheck at release |
| 14 | [`assets/images/14-armistice-nyc-celebration.jpg`](assets/images/14-armistice-nyc-celebration.jpg) | Armistice | PD US | NYC celebration, 11 Nov 1918 — city context only |
| 15 | [`assets/images/15-armistice-train.jpg`](assets/images/15-armistice-train.jpg) | Armistice | PD | Compiègne railcar exterior — no invented private talks |
| 16 | [`assets/images/16-armistice-london-crowd.jpg`](assets/images/16-armistice-london-crowd.jpg) | Armistice | PD US / PDM; IWM non-commercial note | Buckingham Palace crowd; rights check before commercial use |
| 17 | [`assets/images/17-sf-devastation.gif`](assets/images/17-sf-devastation.gif) | San Francisco | PD (USGS) | Lawrence kite aerial ~May 1906 — later damage, not relief camp |
| 18 | [`assets/images/18-sf-city-hall-ruin.jpg`](assets/images/18-sf-city-hall-ruin.jpg) | San Francisco | NARA unrestricted | City Hall ruin; earthquake vs fire damage differ |
| 19 | [`assets/images/19-sf-golden-gate-relief-camp.jpg`](assets/images/19-sf-golden-gate-relief-camp.jpg) | San Francisco | NARA unrestricted | Golden Gate Park relief camp, 1906 |
| 20 | [`assets/images/20-triangle-fire-exterior.jpg`](assets/images/20-triangle-fire-exterior.jpg) | Triangle Fire | PD US | Fire exterior, pub. 26 Mar 1911 — evidence, not drama backdrop |
| 21 | [`assets/images/21-triangle-mourning-demonstration.jpg`](assets/images/21-triangle-mourning-demonstration.jpg) | Triangle Fire | NARA unrestricted | Mourning/protest demo, 5 Apr 1911 |
| 22 | *source-only* | Triangle Fire | LOC Bain / Commons PDM | Pier morgue crowd; LOC 403 — retrieve only after content note check |
| 23 | [`assets/images/23-bandung-economic-plenary.jpg`](assets/images/23-bandung-economic-plenary.jpg) | Bandung | PD-IDGov | Economic plenary, Merdeka Building, 20 Apr 1955 |
| 24 | [`assets/images/24-bandung-soekarno-opening.jpg`](assets/images/24-bandung-soekarno-opening.jpg) | Bandung | PD-IDGov | Soekarno opens conference, 18 Apr 1955 — no AI speaking avatar |
| 25 | [`assets/images/25-bandung-savoy-homann-dinner.jpg`](assets/images/25-bandung-savoy-homann-dinner.jpg) | Bandung | PD-IDGov | Savoy Homann dinner, 19 Apr 1955 — no invented private talk |
| 26 | [`assets/images/26-windrush-vessel-profile.jpg`](assets/images/26-windrush-vessel-profile.jpg) | Windrush | PD (RN) | *Empire Windrush* profile ~1945–54 — not Tilbury arrival |
| 27 | [`assets/images/27-windrush-passenger-list-header.jpg`](assets/images/27-windrush-passenger-list-header.jpg) | Windrush | CC BY-SA 4.0 | Passenger-list header, Jun 1948; attribute + share alike |
| 28 | [`assets/images/28-windrush-monte-rosa.jpg`](assets/images/28-windrush-monte-rosa.jpg) | Windrush | CC BY-SA 4.0 | *Monte Rosa*, Copenhagen May 1945 — never caption as Tilbury 1948 |

### Left out on purpose

- Indian Independence Act 1947 PDF → stays in Partition research note as a document, not a still
- India–Pakistan Refugees OGV (1971 NARA film) → needs editorial review before any still
- Rows 11 and 22 → LOC 403; kept as source records rather than swapped for weak thumbnails

### Before publish

- [ ] Source link still resolves  
- [ ] Licence text matches what you recorded  
- [ ] Creator + repository stored with the asset  
- [ ] Caption names date/place without overclaiming  
- [ ] Asset matches the world’s time-state  
- [ ] Content note where required; CC BY-SA derivatives shared alike  
- [ ] Provenance note stays visible (don’t strip for polish)

Event-level citations and image checks live in the numbered research files. Re-fetch images with [`download-images.sh`](download-images.sh) if needed.
