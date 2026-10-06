ErgoFlex Flutter visualizer lighting handoff - 6 October 2026

Read HANDOFF.md first. VISUALIZER_CONTRACT.json contains exact tuning.
browser-reference is the verified latest website reference plus tests.
native-source is an inspected snapshot, not a modified Flutter app.
SOURCE_INDEX.json locates code; MANIFEST.json hashes the delivered files.
Serve browser-reference over HTTP and open product-demo.html. Its Three.js
CDN import map needs internet; use bundled modules in the production app.
