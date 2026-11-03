# Bedroom

Preview: `index.html?room=bedroom&view=room&layout=spacious`.

| Room | Floor size | Ceiling |
| --- | --- | --- |
| Apartment bedroom & desk nook | 3.8 × 4.4 m | 2.6 m |
| Home bedroom & reading corner | 4.6 × 5.4 m | 2.8 m |
| Spacious bedroom & dressing room | 5.8 × 6.5 m | 3.0 m |
| Primary bedroom & private retreat | 7.2 × 8.0 m | 3.2 m |
| Private bedroom & lounge suite | 9.0 × 9.6 m | 3.4 m |

Oak floors, cream linen walls, muted sage panels and brass details create a
quiet bedroom with a separate daylight desk corner. Library beds keep their
native dimensions and face the headboard wall. Original fixtures include oak
bedside drawers, an upholstered bench, sliding-door wardrobes, woven rugs and
landscape art. Library lamps and bedside journals sit on 550 mm tabletops.

Larger rooms add a reading chair and book ledge, a full-length mirror, then a
dressing island with an upholstered stool. The largest has a private sofa
lounge separated by an oak screen. Four practical lights, opal pendants, soft
headboard lighting and amber path strips complement the daylight window.

Morning, Afternoon, Evening, Night and Weekend adjust daylight, practical
lighting, desk placement, lift, tilt and LEDs. Night mode turns the desk LEDs
off. Room size and desktop width can be selected independently. Layout edits
and modes are stored per room and preserved through project export/import.
Full-floor Glide respects room boundaries; furniture collision avoidance is
not simulated. Inspiration props do not affect pricing or AR export.

Verification: `npm run test:bedroom`. The screenshot helper supports
`--bedroom-layout` and `--bedroom-mode`. The website package file list includes
the module. This local update does not publish it.

## Quiet routines and textiles — 25 October 2026

The existing foot-of-bed bench now carries five editable daily settings:
morning dressing, an afternoon chapter, evening reading, sleep preparation,
and a slow weekend. Woven linen folds and draped edges replace the rigid throw
blocks, with printed books, a wash bag and a personal tray. Details follow the
bench and stay hidden when the setting is hidden.

The five bed styles have coordinated duvet/throw colours using instance-owned
materials. Their fitted dimensions and saved placement identities are retained.
Night closes the roman shade, extinguishes decorative candle flames and lowers
the bedside/reading lamp glow; evening keeps the warmer reading lights. The
smallest room's default desk position moves 50 mm inward to provide the full
60-inch desk envelope with wall clearance. The dressing-table photo frame was
measured at its physical base and keeps its correct original centered origin.

Checks: `node tests/gallery-bedroom-sessions-test.cjs` and
`node tests/gallery-bedroom-groove-test.cjs`. Every layout and activity is checked,
including the compact room with both desk widths. Visual review:
`scene-shots/gallery-bedroom-20261025/`.

Verified 25 October: all detail/contact checks and all 100 combined movement
route checks passed. Fifty layout/activity states rendered without browser
errors or missing props; final printed-detail and cloth-drape close-ups included.
