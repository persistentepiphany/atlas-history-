# Data branch

The repository holds two branches on the remote, `main` and the session branch that preceded this one. No branch named `data` exists, so there was nothing to check out into a worktree and nothing to cherry pick.

Because no data branch is present, every adapter, script, scan, audio file and scenario fragment used on this branch comes from `main` itself. The reusable parts on `main` are the two scenario files and the page, image and audio assets under `walkthrough`, the asset preparation and shot list scripts under `typescript-handoff/scripts`, and the mock Reactor endpoint under `typescript-handoff/mock-server`. All of them are used directly by the application on this branch.

Should a data branch appear later, the expectation from the plan is that it carries the archive adapters, harvested scans and the voice and alignment files. The application reads scenario files from `walkthrough/scenarios` and assets from `walkthrough/assets`, so files delivered into those folders play without code changes, and an `align.json` beside a column read replaces the synthetic timing of the word wash for that read.
