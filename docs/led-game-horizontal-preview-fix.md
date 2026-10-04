# Game Mode horizontal preview correction

2026-10-03. User visually confirmed Game Mode's desk colors were horizontally
backwards and requested a flip. Applied a playback-only correction in Custom Shop:

- `led-game-frames.mjs`: optional `mirrorHorizontally` parameter; lateral rows
  0/1/2/3/4/7 reverse physical-address sampling while preserving RG BW channels.
- Side rows 5/6 exchange source banks, retaining front/back order. Differing side
  counts map normalized endpoints rather than reading beyond a bank row.
- `led-game-mode.mjs`: Game Mode opts into the correction. Raw bank sampling
  defaults unchanged for source provenance and movement reference tests.
- Video/monitor texture, electrical strip map, motion samplers, diagnostics and
  original recorded banks remain unchanged. No website deployment.

Added `tests/led-game-horizontal-test.mjs` covering asymmetric lateral colors,
side exchange, all RGBW channels, temporal interpolation/end clamping and original
sampling. Focused test and all 56 movement reference checks pass. Shared module
updates were guarded by original source hashes to avoid overwriting PC2 edits.

PC2: retain this correction when further editing Game Mode. The user's requested
rotation-comet reversal remains independent. Existing loaded tabs need a hard
refresh to reload the modules.
