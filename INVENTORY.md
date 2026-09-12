# Inventory

Every file under `walkthrough/assets`, with its size, its dimensions or duration, and the asset id it stands for in the Apollo and Berlin tables. Durations of the onboard recordings are read from the MP3 frame count and are approximate to the second.

## Apollo 11

| File | Size | Measure | Asset | Note |
|---|---|---|---|---|
| apollo11/pages/a01.png | 3.6 MB | 1872 by 4056 | A01 Canberra Times | Clipping of the editorial, not the Trove page scan |
| apollo11/pages/a01.words.json | 31 KB | 351 word boxes | A01 word boxes | Derived from measured line bands |
| apollo11/pages/a01.lines.json | 4.5 KB | 42 line boxes | A01 line boxes | Drives the caption during the read |
| apollo11/pages/a02.png | 3.8 MB | 2796 by 3200 | A02 Washington Post | Rendered from the ProQuest PDF |
| apollo11/pages/a03.png | 35 KB | 720 by 1008 | A03 Los Angeles Times | Grey frame placeholder |
| apollo11/pages/a05.png | 1.5 MB | 1372 by 1800 | A05 Safire memo | Rendered from the National Archives PDF |
| apollo11/pages/a05.words.json | 2.9 KB | 39 word boxes | A05 word boxes | From the PDF text layer |
| apollo11/images/a04.png | 1.2 MB | 1249 by 1020 | A04 photograph crop | Crop of the A02 television frame, world seed |
| apollo11/images/g01.png | 36 KB | 1024 by 768 | G01 onboard photograph | Grey frame placeholder |
| apollo11/audio/n01.mp3 | 5.7 MB | about 5 min 54 s | N01 | Onboard recording one, played from its start |
| apollo11/audio/n02.mp3 | 11.5 MB | about 11 min 57 s | N02 | Onboard recording two |
| apollo11/audio/n03.mp3 | 14.5 MB | about 15 min 8 s | N03 | Onboard recording three |
| apollo11/audio/n04.mp3 | 4.0 MB | about 4 min 12 s | N04 | Onboard recording four |
| apollo11/audio/n05.mp3 | 12.5 MB | about 12 min 58 s | N05 | Onboard recording five |

## Berlin 1989

| File | Size | Measure | Asset | Note |
|---|---|---|---|---|
| berlin1989/pages/b01.png | 7.7 MB | 2445 by 3400 | B01 Neues Deutschland, 10 November | Rendered from the ZEFYS PDF, no text layer |
| berlin1989/pages/b02.png | 7.9 MB | 2445 by 3400 | B02 Neues Deutschland, 11 November | Rendered from the ZEFYS PDF |
| berlin1989/pages/b03.png | 34 KB | 720 by 1008 | B03 Tagesspiegel | Grey frame placeholder |
| berlin1989/pages/b04.png | 34 KB | 720 by 1008 | B04 New York Times | Grey frame placeholder |
| berlin1989/images/b05.png | 35 KB | 1024 by 768 | B05 press conference still | Grey frame placeholder |
| berlin1989/images/k02.png | 35 KB | 1024 by 768 | K02 Tagesschau title | Grey frame placeholder |

## Missing against the tables

Apollo. The Trove page scan for A01, the Los Angeles Times page for A03, the onboard photograph G01, the narrator lines V01, the column read V02, the memo read V03, the fallback world video R01, and the foley and bed files F01 to F04 and B01.

Berlin. The Tagesspiegel page B03, the New York Times page B04, the press conference still B05, the Tagesschau title K02, the archive clips K01 to K03, the narrator lines W01, the column read W02, the memo read W03, and the fallback world video R02.

Placeholders for each of these are described in `walkthrough/PLACEHOLDERS.md`, and the ones that are generated at runtime rather than stored as files are listed there under the audio heading.
