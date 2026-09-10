# ErgoFlex Custom Shop

A Three.js desk configurator with a customer preview and a part/animation editor.

## Run

```sh
npm install
npm run dev
```

Open **http://localhost:3000** for the store preview or **http://localhost:3000/?setup** for the studio.

**Serving over HTTP is required, not just preferred.** The application code lives in `studio.js`, loaded as an ES module; browsers refuse to load modules over `file://`, so opening `index.html` directly cannot start the 3D workspace — the page says so in place of the loading spinner rather than spinning forever. Serving over HTTP is also what lets the local wood texture and image capture work. The model, Three.js, Tailwind, and AR viewer load from external hosts, so an internet connection is required.

## Layout

- `index.html` — markup, base styles, and the import map.
- `studio.js` — the application: scene, editor, rigs, and UI wiring. Owns all mutable state.
- `catalog.mjs` — pure catalog and pricing functions, with no DOM or Three.js dependency. Imported by `studio.js` in the browser and by the tests in Node, so pricing and validation can be tested without a headless browser.
- `studio.css` — studio and responsive styles.
- `workspace-3d.mjs` — accessory geometry, mounting surfaces and 3D rooms.
- `workspace-icons.mjs` — original accessory card illustrations.

## Studio

- **Editor tools / Product & finishes** switches sidebar panels without replacing the WebGL canvas. Drag the sidebar divider on desktop; mobile stacks the viewer and editor.
- Select with click, the part search, or the scene tree. Shift/Alt-drag selects a region. **Q / W / E / R** selects Off / Move / Rotate / Scale; **F** focuses the selection. Shortcuts do not intercept text fields.
- Focus, isolate, restore visibility, world/local coordinates, and snapping complement the existing grouping, cloning, undo, tilt, and actuator tools.
- **Transform panel:** numeric position, rotation (degrees), and scale fields for the selected part, in its own parent space with animation removed. **Align** puts the selection's min/middle/max on a plane per axis, and **Even** spaces three or more parts equally. Typed edits, alignment, and gizmo drags all commit through one path, so they share an undo history and all update the lift baseline.
- **Lock** makes the selection unselectable and unmovable. Locks are saved with the project.
- **Redo** (Ctrl+Shift+Z or Ctrl+Y) reverses an undo. Rig deletion and lift-assignment changes are undoable too, which they previously were not.
- Selection and lift membership are independent. **Lift assembly → Assign selected / Remove selected** changes which unrigged parts follow the lift for the current session. Tilt, actuator, telescoping, and wheel rigs maintain their own motion. Existing named groups, part labels, tilt definitions, and actuator definitions retain their original local-storage behavior.
- **Export Animations** downloads the tilt/actuator JSON, for baking definitions back into source.
- **Project → Save project** writes the whole edited scene: part positions, clones, groups, lift assignments, rigs, finishes, camera, and the current pose. **Load project…** restores it. Editing transforms are stored at a neutral pose (28", zero tilt, no glide) as deltas from the part's authored baseline, and the pose is reapplied on top, so a project saved with the desk raised and tilted restores without baking that pose into the geometry.
- An import **replaces** project state rather than merging with it, so a rig you deleted stays deleted. The file is fully validated before anything is touched: a project from a different model, an unreadable file, or a broken clone graph is refused with the scene untouched, and a changed model is reported as a warning you can accept or cancel. The model is identified by a hash of the GLB bytes, so a mesh whose geometry changed under an unchanged name is caught.
- **Recover…** lists the last five autosaves. They are written a couple of seconds after each edit and immediately before anything destructive, such as deleting a rig. If browser storage is unavailable, the failure is reported rather than silently swallowed.

## Movement and presentation

- **Lift:** continuous height slider and Sit / Perch / Stand presets.
- **Tilt:** the existing rig sliders, with a non-destructive reset to zero (or the closest permitted angle).
- **Glide:** drag the joystick in any direction, or focus it and hold arrow keys. Joystick directions follow the current camera on the floor plane. Release, focus loss, or hiding the tab stops manual input. Position sliders use model/world X and Z and are bounded to ±1 scene unit. Crawl / Ninja / Slow / Medium / Fast controls speed. Recenter smoothly returns home; Play demo runs the original figure-eight relative to the current position. Wheel rotation comes from actual displacement, including diagonal pair cancellation. Turn the transform tool Off before gliding.
- **Scenes** switches between Product, Office, Home office, Music studio and Gaming. Rooms have actual geometry and stay separate from purchased accessories. The chosen scene persists locally and in project files. Captures include the selected room; AR includes purchased accessories without room scenery.
- Gallery, Warm, and **Slate (the default)** backgrounds, exposure, quality, camera presets, orbit, grid, fit, and transparent PNG capture support product presentation. The environment is applied at startup, not only on change.
- **Camera shortcuts** frame the Desktop, Wheels, Actuators, and Columns. Close-ups temporarily lower the orbit minimum distance, which otherwise clamps small assemblies to a mid shot; **Reset view** restores it. All camera moves ease over ~400 ms rather than jumping.
- The movement dock reserves the height of its tallest panel, so switching between lift, tilt, and glide no longer resizes the canvas and shifts the camera. It still collapses, which hands that height straight back to the canvas. On the storefront, **Hide options** collapses the configuration column and the viewer takes the full width. Both states persist.
- **Every wood species is a photograph**, all CC0 from Poly Haven and ambientCG — see [docs/wood-textures.md](docs/wood-textures.md) for sources, licensing, and what is still unconfirmed. Black Ash is the birch surface tinted to a satin black, so it shares that image rather than carrying its own. Procedural grain now only draws the plywood edge laminations and stands in if an image fails to load; as generated face veneer it tiled with a visible seam and rings about two inches wide, which read as bands rather than grain.
- Grain scale is physical. The table gives repeats *per inch*, and each surface's repeat is derived from its own measured size, so grain stays the same size instead of stretching with the desk.
- The desktop, the shaped side panels, the shelf, and the plywood edge have separate materials; only the edge gets stacked laminations rather than a face veneer. Edge classification is geometric, not by name: a strip is thin in cross-section, whereas a side panel is a 35 x 18in face only 0.7in thick and needs veneer. Each role holds its own texture, including its own view of the birch photograph, because one `Texture` carries one `repeat` and roles would otherwise overwrite each other's grain scale.
- Matte/satin/gloss applies per material role: wood, powder coat, brushed aluminium, and plastic each have their own roughness and clearcoat values. Frame finishes include the original neutrals plus Forest, Sand, Navy, and Terracotta.

## Customer configuration

Finishes, sizes, and accessories update estimates. All prices come from a single function in `catalog.mjs`, so the headline price, the cart rows, and the downloaded estimate cannot disagree.

**Start from** offers three curated configurations — Compact workspace, Creative studio, Standing workstation — each a complete build with compatible accessories. The estimate is itemised: base desk, size, desktop, frame, and each accessory.

**Accessory pricing is provisional** and is marked with an asterisk wherever it appears. Nothing here has been confirmed by a manufacturer. Accessories that need a wider top are disabled at smaller sizes, and narrowing the desk removes an incompatible accessory and says which — it never leaves a charge in the estimate for something that cannot ship. Selected accessories appear in 3D, including original dimension-based reference models of a Dell UltraSharp 27, Logitech Lift and Logitech ERGO K860. Product cards link to manufacturer specifications. Keyboard, mouse and task accessories follow the desktop; monitor and arms follow the upper shelf. The build list itemises accessories and can reopen each configuration in 3D. See [workspace preview details](docs/workspace-previews.md) for sources and mounting behavior.

Saved builds and the build list use `ergoflexSavedBuildV2` / `ergoflexCartV2`. V1 data is read once as a migration (a V1 payload is a valid V2 with no accessories) and never written again. **Start Over** clears a saved build and returns to the catalog default, which is Natural Birch on White - a saved build otherwise outranks that default on every later visit with no way back from the page. The default comes from the `isDefault` flags in `catalog.mjs` rather than a second copy in the app. Saved builds and the build list persist locally in the browser; shared links encode a validated finish/size configuration. The build list supports quantities, removal, and estimate downloads. Surface sheen and presentation settings are visualization controls, not priced options.

**This is a design/storefront prototype:** the size selector updates the estimate but does not resize the reference CAD assembly. See [docs/sizing-gate.md](docs/sizing-gate.md) for why, measured rather than assumed: the model's width axis is Z (not X), the desktop is a four-mesh assembly whose parts carry 3,000-4,600 vertices each (so it has real edge features that a stretch would distort), and its 44 x 32 in footprint matches none of the three catalog SKUs. Run `node tools/measure-asset.cjs` to reproduce the measurements. Checkout, payment, inventory, tax, shipping, and order submission are not connected. Estimates state that final specifications and availability need confirmation. No fabricated reviews or unverified delivery promises are displayed.

## Build checks

A **Build checks** panel reports geometric problems with the current configuration: actuator travel, coarse collision candidates, incompatible option combinations, and problems the app detects while building rigs that previously only reached the console.

**These are advisory and do not block ordering.** A rule may only be promoted to blocking when its limit comes from a confirmed product specification and it has a passing test on a known-bad and a known-good configuration. `LIMITS` in `validation.mjs` currently holds `null` for actuator stroke, minimum clearance, and the mounting-point budget, all marked `unconfirmed` — **supplying those is a prerequisite for enforcement**, and until then the panel says so in as many words.

Two things worth knowing about how the checks work:

- **Actuator travel is sampled across lift × tilt, not lift alone.** The solver offsets the actuator base by the lift and the target is itself a lift member, so both endpoints translate together and a lift-only sample measures almost no travel. Tilt is what actually changes it.
- **Collisions are candidates, not verdicts.** They come from coarse per-assembly bounding boxes — 830 meshes cannot be pair-tested interactively — and are filtered against a list of intended contacts, since a fastener sits inside its hole and a column sits inside a column. Without that list every configuration would report as one large collision.

## Verify

```sh
npm test
```

The Puppeteer smoke test starts its own local server and loads the real external model. It checks lift/selection independence, isolation, snapping, box-selection alignment, clone undo, wheel rigs, manual/diagonal Glide, bounds and stopping, lift/tilt, finish pricing, build-list quantities, persistence, and mobile overflow. Use `npm test -- --editor-only` for the focused editor checks. It writes review screenshots to `/tmp/ergoflex-*.png`. The test needs network access and a browser-capable environment; on a fresh machine, Puppeteer installs its matching browser with `npm install`.
