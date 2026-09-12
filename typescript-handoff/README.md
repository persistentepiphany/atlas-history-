# TypeScript handoff

This folder contains the application source delivered alongside the reviewed browser walkthrough. It is kept separate so the runnable static piece can be served without installing the React application dependencies.

The source tree contains the scene, sequence, audio, catalogue, overlay, world and data layers. The `scenarios` folder contains the two event contracts, `scripts` contains asset preparation and shot list utilities, and `mock-server` contains the local Reactor endpoint.

Raw recordings, scans and archive bundles are not stored in Git. Place those inputs in a local `raw` folder before running the asset preparation script in a fully configured application workspace.
