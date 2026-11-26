# Director UI pass: handoff (25 Nov 2026)

Branch `director/fable-ui` (off 133dd4e8). Not merged. Presentation only: one new stylesheet,
`experience/director-ui.css`, linked in `experience/index.html` after `director-polish.css` and before
`director-phone.css`. No JavaScript, data format, saved state, shortcut or Export cut output was changed.
The round was cut short, so this is a first pass on the Director only. The Studio was not started.

## How it was audited

Headless Chrome against the harness's own scratch server (never :3000), coast chapter of the Cinematographer's
cut, 1920 x 1080: every inspector tab, the app bar menus, the right-click menu, the timeline with every lane group
unfolded, a selected camera key / move / person, pose mode, tray mode, the Keys & mouse panel (List and Keyboard),
command search, Autosaves, Report a problem, the prop and people libraries.

## What was wrong (root causes)

1. The film page's own element rules in `experience.css` leak into Director surfaces that never undid them:
   `button{min-height:42px;border-radius:100px;padding:9px 18px}`, `header{position:fixed}`,
   `footer{position:fixed}` (and `body.directing footer{display:none}`), `aside span{letter-spacing:2px}`.
   - App bar buttons were 42 px tall in a 46 px bar; the chapter arrows were 42 px circles.
   - Menu rows were 42 px tall; the right-click menu used 16 px text while the app bar menus used 13 px.
   - The Render menu's quality pills were 42 px tall with their text stuck to the top.
   - **Keys & mouse panel: its header (title, List / Keyboard, search, Edit keys, close) was pinned to the top of
     the window over the app bar, its footer was hidden, and every label was letter-spaced cyan 10 px text.**
   - The Film / Persp / Top / Front / Right buttons were 42 px tall.
   - Report a problem's Cancel / Send report were unstyled website pills.
2. Newer panels use class-only selectors that lose to the theme's `#director-panel` rules:
   - **Tray tab: each slider was squeezed down to its thumb** (the number field took the whole row).
   - Render tab: "Re-render every chapter" showed while the request was for one chapter (its `hidden` attribute
     lost to `label{display:grid}`), with the checkbox alone above its sentence.
   - The status pills in the timeline's foot were 28 px buttons instead of 18 px pills.
3. Inconsistencies: inspector tab names cut ("Chapter", "Lighting", "Graphics", "Branding"); long lane names ran
   over the clips of their lane; the People tab's pressed Move / Turn / Scale was pink while every other pressed
   button is cyan; three different fold triangles; colour emoji as icons (speaker, keyboard, eye, lock); native
   selects in three styles (the Cut picker tan); menu check marks did not line up with unchecked rows; dialogs had
   four different corner radii and backdrops.

## What changed (all in `experience/director-ui.css`)

- **Tokens**: control heights (20 / 24 / 26 / 28 px), four elevation shadows, one focus ring, one menu surface,
  and one icon set (24 px grid, 2 px strokes, drawn as masks). Palette unchanged: cyan accent, amber selection,
  red playhead, the lane hues.
- **App bar**: every button 28 px, 6 px radius; Undo / Redo / Keys / More are drawn icons; Sound is a drawn
  speaker plus "Sound" / "Muted"; pressed toggles are filled cyan (they only changed their border before);
  Export cut stays the one filled button; Cut and Chapter are matching fields with the arrows joined to the chapter.
- **Menus** (app bar and right-click, one component): 26 px rows, 12.5 px text, hints in grey on the right,
  section captions, check marks in a gutter so labels line up; the Render quality pills are segmented rows.
- **Inspector**: tab bar columns are as wide as their longest name (subgrid), so no name is cut and the four rows
  stay aligned; buttons 26 px, fields 28 px; one select chevron; one fold chevron; one heading size per level;
  the scope chip ("THIS CHAPTER") is a quiet caption; checkbox and sentence on one line; `hidden` always hides;
  disabled controls are flat and dim (no dashed edge); People Move / Turn / Scale pressed is cyan; the Tray's
  sliders work and its joints are cards.
- **Timeline**: Shortcuts and Report a problem no longer look like "add to a lane" buttons; status pills are
  pills; long lane names are cut at the label's edge; the eye and the lock are drawn icons (the lock shows on
  hover or when locked); selects have the chevron.
- **Over the view**: the view buttons match the Lights / Move and Render still groups.
- **Keys & mouse**: header and footer are inside the panel again; rows, key caps and sections restyled.
- **Dialogs** (Autosaves, new cut, stale / draft questions, Report a problem, the libraries): one card, one
  backdrop, one button style; command search matches the menus.

The phone layout is untouched: every rule that changes an existing element is inside
`@media not all and (pointer:coarse)`.

## Screenshots

`docs/fable-ui-20261125/before-*.jpg` and `after-*.jpg` (same numbers pair up): 01 whole Director, 02 timeline
unfolded, 03 More menu, 04 Render menu, 05 right-click menu, 06 Keys & mouse, 07 Tray tab, 08 five inspector tabs.
`after-05` is a static re-render of the captured page with the new stylesheet (the live capture of that one step
failed on a detached node); the others are from the live page.

## Checks

- Live page with the new stylesheet (coast, headless, own server): no page errors; stylesheet order as intended;
  no tab name cut; Keys & mouse header inside its panel; Tray slider 204 px wide (was 0).
- Node tests passing: `ui-polish-test`, `fold-titles-test`, `director-appbar-test`, `tray-mode-test`,
  `status-follow-test`, `director-actions-test`.
- ESLint no-use-before-define: not applicable, no `.mjs` / `.js` file was edited.
- Not run: the browser e2e suites (`director-*-e2e`), the 2560 x 1440 big-screen scale, and any check of the
  phone layout on a touch device.

## Not done

- **The Studio (index.html, studio.css, studio-shell.css, studio-layers.css) was not audited or changed.**
- Director at 2560 x 1440 (the 1.2 zoom) was not captured; the rules are in pre-zoom pixels and should scale, but
  it has not been looked at.
- Not captured after the change: pose mode, the libraries, Autosaves, the Keyboard view of Keys & mouse, the
  Classic layout (`?shell=classic`), Layers / Desks / Graphics / Branding tabs. They were rendered before only.
- Left as found: the Render menu's first two rows read "Bake chapter" / "Bake full intro" and lose their hints
  (`syncTransport` in `director.mjs` overwrites the menu item's text; needs a small JS change); slider rows still
  have four different layouts across tabs; Play chapter appears three times (app bar, timeline, Chapter tab);
  the Keyboard view's key captions are cut; the Play / Loop / step glyphs are still text characters.

## For Vico to decide

1. Disabled buttons: flat and dim now, where they had a dashed edge. One rule to put the dashes back.
2. People tab Move / Turn / Scale pressed: cyan now, was pink.
3. Inspector tab names are 11 px (were 11.5 px) with 11 px icons, so all sixteen fit uncut. The alternative is
   dropping either the icons or the Story / Motion / Stage / Look captions and keeping larger text.
4. The lane lock is hidden until the pointer is over the lane's label (it was always faintly visible).
5. App bar buttons are 28 px tall (were 42 px). Positions and order are unchanged.

---

# Round 2 (26 Nov 2026)

Same branch, same stylesheet (`experience/director-ui.css`, section 8 plus the icon tokens at the top), CSS only again.
No JavaScript, data, key, shortcut or Export cut output touched, so ESLint no-use-before-define had nothing to lint.
Audited in headless Chrome on the harness's own scratch server (coast, Cinematographer's cut, 1920 x 1080, and a
2560 x 1440 look): every inspector tab, a selected person, pose mode, tray mode, a selected camera key, the Keys & mouse
Keyboard view, the Studio (Store / Studio / Layers).

## What changed

- **Timeline transport**: skip back, skip forward and restart are drawn icons (they were `|‹`, `›|`, `↻`); Loop has a
  drawn loop glyph and, when on, the same cyan pressed look as every other pressed toggle.
- **Sliders**: one layout. Graphics' "Screen look" rows were stacked and centred (a class-only rule lost to the theme):
  now name left, track, mono value right. Lighting's rows put the value ("x1", "+3 steps of x1.11") on the name's line.
  One 72 px mono right-aligned number field in Lighting and the Chapter tab's starting position (they were 68 / 84 / full).
- **Selection bar** (Person / Prop / Camera view ... at the top of the inspector): Duplicate, Frame, Zoom to it, Reset,
  Delete and Deselect are drawn icons (they were ⧉ ⌖ ↔ ↺ colour-emoji bin ×); Delete goes red on hover; focus ring.
- **Fields**: every inspector input, select and textarea shows the same accent edge and halo when focused.
- **Tray tab**: its title was an h4 (12 px); it now matches every other tab's title.
- **Layers**: "Find" and its field are one row (the label was a centred column above the field).
- **Keys & mouse, Keyboard view**: the panel is 1060 px wide (was 760), keys 62 px tall with three-line captions, so
  "Maximise the panel under the pointer", "Snapping on / off", "Update this view from what the 3D ..." read in full
  instead of being cut at two short lines. The panel is as tall as its keys, not the whole window.
- Checked and found already consistent after round 1: Tray mode, pose mode (Done, Hold camera, Keys, Fingers, Save this
  pose), People, Desks, Props, Camera, Moves, Cut, Title, Render, Build, Branding, 2560 x 1440 (the 1.2 zoom scales).

Screenshots: `docs/fable-ui-20261125/round2-before-NN.jpg` / `round2-after-NN.jpg`: 01 transport, 02 sliders (Graphics,
Lighting) and Layers, 03 selection bar, 04 Keyboard view.

## The Studio: audited, not changed

The Studio (index.html, studio.css, studio-shell.css, portal-ui.css, studio-layers.css) is the light, green customer-facing
design studio, shared with the public Store, restyled on 23 Nov (studio-shell.css). Measured: one 8 px radius, 12 px
SF Pro text, 30 px controls across its toolbar and panels; nothing inconsistent enough to fix without redrawing it.
Making it match the Director would be a redesign of the public page, not a polish: see the decision below.

## Still not done

- The Render menu's "Bake chapter" / "Bake full intro" rows lose their hints (needs a JS change in `syncTransport`).
- Play / Pause glyphs inside the "Play chapter" buttons are still text (the label changes with state; needs JS).
- Selection bar's leading symbol (a person, a diamond, a dot) is still a text character set by JS.
- The People lane's per-person rows are dense and saturated pink; a lane-colour decision, not a bug.
- Classic layout (`?shell=classic`), the libraries and Autosaves were not re-captured after round 2.
- Browser e2e suites (`director-*-e2e`) were not run; touch devices (the phone layout is untouched) not checked.

## For Vico to decide (round 2)

1. Should the Studio take the Director's dark chrome, or stay light? (Not started; large and public.)
2. Key captions in the Keyboard view: wider panel (done) or a hover card per key instead?
3. Keep the paragraph hints cut at two or three lines until hovered (the existing rule), or show them in full?
