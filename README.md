# ErgoFlex Custom Shop

A Three.js desk configurator with a customer preview and a part/animation editor.

## Run

```sh
npm install
npm run dev
```

Open **http://localhost:3000** for the store preview or **http://localhost:3000/?setup** for the studio.

**Serving over HTTP is required, not just preferred.** The application code lives in `studio.js`, loaded as an ES module; browsers refuse to load modules over `file://`, so opening `index.html` directly leaves a blank viewer. Serving over HTTP is also what lets the local wood texture and image capture work. The model, Three.js, Tailwind, and AR viewer load from external hosts, so an internet connection is required.

## Layout

- `index.html` — markup, base styles, and the import map.
- `studio.js` — the application: scene, editor, rigs, and UI wiring. Owns all mutable state.
- `catalog.mjs` — pure catalog and pricing functions, with no DOM or Three.js dependency. Imported by `studio.js` in the browser and by the tests in Node, so pricing and validation can be tested without a headless browser.
- `studio.css` — studio and responsive styles.

## Studio

- **Editor tools / Product & finishes** switches sidebar panels without replacing the WebGL canvas. Drag the sidebar divider on desktop; mobile stacks the viewer and editor.
- Select with click, the part search, or the scene tree. Shift/Alt-drag selects a region. **Q / W / E / R** selects Off / Move / Rotate / Scale; **F** focuses the selection. Shortcuts do not intercept text fields.
- Focus, isolate, restore visibility, world/local coordinates, and snapping complement the existing grouping, cloning, undo, tilt, and actuator tools.
- Selection and lift membership are independent. **Lift assembly → Assign selected / Remove selected** changes which unrigged parts follow the lift for the current session. Tilt, actuator, telescoping, and wheel rigs maintain their own motion. Existing named groups, part labels, tilt definitions, and actuator definitions retain their original local-storage behavior.
- **Export Animations** downloads the tilt/actuator JSON, for baking definitions back into source.
- **Project → Save project** writes the whole edited scene: part positions, clones, groups, lift assignments, rigs, finishes, camera, and the current pose. **Load project…** restores it. Editing transforms are stored at a neutral pose (28", zero tilt, no glide) as deltas from the part's authored baseline, and the pose is reapplied on top, so a project saved with the desk raised and tilted restores without baking that pose into the geometry.
- An import **replaces** project state rather than merging with it, so a rig you deleted stays deleted. The file is fully validated before anything is touched: a project from a different model, an unreadable file, or a broken clone graph is refused with the scene untouched, and a changed model is reported as a warning you can accept or cancel. The model is identified by a hash of the GLB bytes, so a mesh whose geometry changed under an unchanged name is caught.
- **Recover…** lists the last five autosaves. They are written a couple of seconds after each edit and immediately before anything destructive, such as deleting a rig. If browser storage is unavailable, the failure is reported rather than silently swallowed.

## Movement and presentation

- **Lift:** continuous height slider and Sit / Perch / Stand presets.
- **Tilt:** the existing rig sliders, with a non-destructive reset to zero (or the closest permitted angle).
- **Glide:** drag the joystick in any direction, or focus it and hold arrow keys. Joystick directions follow the current camera on the floor plane. Release, focus loss, or hiding the tab stops manual input. Position sliders use model/world X and Z and are bounded to ±1 scene unit. Crawl / Ninja / Slow / Medium / Fast controls speed. Recenter smoothly returns home; Play demo runs the original figure-eight relative to the current position. Wheel rotation comes from actual displacement, including diagonal pair cancellation. Turn the transform tool Off before gliding.
- Gallery, Warm, and Slate backgrounds, exposure, quality, camera presets, orbit, grid, fit, and transparent PNG capture support product presentation.
- **Camera shortcuts** frame the Desktop, Wheels, Actuators, and Columns. Close-ups temporarily lower the orbit minimum distance, which otherwise clamps small assemblies to a mid shot; **Reset view** restores it. All camera moves ease over ~400 ms rather than jumping.
- The movement dock collapses, which hands its height straight back to the canvas. On the storefront, **Hide options** collapses the configuration column and the viewer takes the full width. Both states persist.
- Each wood species has its own grain, ring spacing, contrast, and colour rather than one birch photograph tinted eight ways. Natural Birch keeps the photographed surface; the rest are generated procedurally from a per-species table in `catalog.mjs`. **Real tileable photography per species is still the right answer and remains a content dependency** — the generated grain is a stand-in, not a substitute.
- Grain scale is physical. The table gives repeats *per inch*, and each surface's repeat is derived from its own measured size, so grain stays the same size instead of stretching with the desk.
- The desktop, the shelf, and the plywood edge have separate materials; the edge gets stacked laminations rather than a face veneer.
- Matte/satin/gloss applies per material role: wood, powder coat, brushed aluminium, and plastic each have their own roughness and clearcoat values. Frame finishes include the original neutrals plus Forest, Sand, Navy, and Terracotta.

## Customer configuration

Finishes and sizes update estimates. All prices come from a single function in `catalog.mjs`, so the headline price, the cart rows, and the downloaded estimate cannot disagree. Saved builds and the build list persist locally in the browser; shared links encode a validated finish/size configuration. The build list supports quantities, removal, and estimate downloads. Surface sheen and presentation settings are visualization controls, not priced options.

**This is a design/storefront prototype:** the size selector updates the estimate but does not resize the reference CAD assembly. See [docs/sizing-gate.md](docs/sizing-gate.md) for why, measured rather than assumed: the model's width axis is Z (not X), the desktop is a four-mesh assembly whose parts carry 3,000-4,600 vertices each (so it has real edge features that a stretch would distort), and its 44 x 32 in footprint matches none of the three catalog SKUs. Run `node tools/measure-asset.cjs` to reproduce the measurements. Checkout, payment, inventory, tax, shipping, and order submission are not connected. Estimates state that final specifications and availability need confirmation. No fabricated reviews or unverified delivery promises are displayed.

## Verify

```sh
npm test
```

The Puppeteer smoke test starts its own local server and loads the real external model. It checks lift/selection independence, isolation, snapping, box-selection alignment, clone undo, wheel rigs, manual/diagonal Glide, bounds and stopping, lift/tilt, finish pricing, build-list quantities, persistence, and mobile overflow. Use `npm test -- --editor-only` for the focused editor checks. It writes review screenshots to `/tmp/ergoflex-*.png`. The test needs network access and a browser-capable environment; on a fresh machine, Puppeteer installs its matching browser with `npm install`.
