# ErgoFlex Custom Shop

A Three.js desk configurator with a customer preview and a part/animation editor.

## Run

```sh
npm install
npm run dev
```

Open **http://localhost:3000** for the store preview or **http://localhost:3000/?setup** for the studio. Serving over HTTP allows the local wood texture and image capture to work consistently; browsers may restrict these when opening `index.html` directly. The model, Three.js, Tailwind, and AR viewer currently load from external hosts, so an internet connection is required.

## Studio

- **Editor tools / Product & finishes** switches sidebar panels without replacing the WebGL canvas. Drag the sidebar divider on desktop; mobile stacks the viewer and editor.
- Select with click, the part search, or the scene tree. Shift/Alt-drag selects a region. **Q / W / E / R** selects Off / Move / Rotate / Scale; **F** focuses the selection. Shortcuts do not intercept text fields.
- Focus, isolate, restore visibility, world/local coordinates, and snapping complement the existing grouping, cloning, undo, tilt, and actuator tools.
- Selection and lift membership are independent. **Lift assembly → Assign selected / Remove selected** changes which unrigged parts follow the lift for the current session. Tilt, actuator, telescoping, and wheel rigs maintain their own motion. Existing named groups, part labels, tilt definitions, and actuator definitions retain their original local-storage behavior.
- **Export Animations** downloads the tilt/actuator JSON. Transform edits, clones, and manual lift assignments remain session edits; export/reload is not a complete scene round trip.

## Movement and presentation

- **Lift:** continuous height slider and Sit / Perch / Stand presets.
- **Tilt:** the existing rig sliders, with a non-destructive reset to zero (or the closest permitted angle).
- **Glide:** drag the joystick in any direction, or focus it and hold arrow keys. Joystick directions follow the current camera on the floor plane. Release, focus loss, or hiding the tab stops manual input. Position sliders use model/world X and Z and are bounded to ±1 scene unit. Crawl / Ninja / Slow / Medium / Fast controls speed. Recenter smoothly returns home; Play demo runs the original figure-eight relative to the current position. Wheel rotation comes from actual displacement, including diagonal pair cancellation. Turn the transform tool Off before gliding.
- Gallery, Warm, and Slate backgrounds, exposure, quality, camera presets, orbit, grid, fit, and transparent PNG capture support product presentation.
- Wood colors preview stains over the reference birch texture, with grain and matte/satin/gloss visualization controls. Frame finishes include the original neutrals plus Forest, Sand, Navy, and Terracotta.

## Customer configuration

Finishes and sizes update estimates. Saved builds and the build list persist locally in the browser; shared links encode a validated finish/size configuration. The build list supports quantities, removal, and estimate downloads. Surface sheen and presentation settings are visualization controls, not priced options.

**This is a design/storefront prototype:** the size selector updates the estimate but does not resize the reference CAD assembly. Checkout, payment, inventory, tax, shipping, and order submission are not connected. Estimates state that final specifications and availability need confirmation. No fabricated reviews or unverified delivery promises are displayed.

## Verify

```sh
npm test
```

The Puppeteer smoke test starts its own local server and loads the real external model. It checks lift/selection independence, isolation, snapping, box-selection alignment, clone undo, wheel rigs, manual/diagonal Glide, bounds and stopping, lift/tilt, finish pricing, build-list quantities, persistence, and mobile overflow. Use `npm test -- --editor-only` for the focused editor checks. It writes review screenshots to `/tmp/ergoflex-*.png`. The test needs network access and a browser-capable environment; on a fresh machine, Puppeteer installs its matching browser with `npm install`.
