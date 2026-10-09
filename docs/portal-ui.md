# Store and Studio interface

The shared interface layer is `portal-ui.css` + `portal-ui.mjs`, loaded by both
`index.html` and `product-demo.html`. It is independent of environment builders.

## Appearance

The header's Appearance selector offers **Light**, **Dark**, and **System**.
The preference is stored under `ergoflex.portal.theme.v1`. System follows the OS
and updates when its preference changes. Explicit choices persist across reloads,
Store/Studio switching, and the desk-only page. Storage events synchronize open
tabs on the same origin. If storage is unavailable, appearance still works for
the session. The early head script applies appearance before module loading.

`html[data-portal-theme]` selects the shared `--ui-*` color tokens. The selector
styles portal panels, forms, finishes, accessories, artwork, viewer toolbars,
build-list and AR help dialogs, and LED Command Center. The desk controller owns
its independent light/dark appearance and reference geometry. Room lighting,
materials, and daypart selection are independent of portal appearance.

## Navigation and actions

- Store and Studio call the existing shell mode API without rebuilding the scene.
- Share and Build list reuse existing action elements and listeners.
- Studio's Save project and Open project shortcuts call the existing project
  controls. Save project downloads the complete project; existing autosaves and
  artwork/room persistence retain their original behavior.
- A sticky estimate and Add to build list action stays available in Store and
  Studio's Product & finishes tab. It uses the existing price and build logic.
- Phones have Preview and Options shortcuts below the brand/actions row.
- Accordion headers support Enter/Space; collapsed contents are inert to avoid
  tabbing into hidden controls. Expanded contents have no clipping height cap.
- Sidebar tabs support Left/Right/Home/End. The panel divider is keyboard
  adjustable using Left/Right. Focus indicators and reduced motion are supported.
- Existing dialog focus trapping is retained; Escape also closes Light & quality.
- LED Command Center uses a viewport-bounded settings sheet even when the desk
  controller is minimized. Narrow screens use one scroller for all settings.

## Working alongside scene changes

Prefer adding interface styles to this layer instead of editing scene construction
modules. Root UI tokens must not affect Three.js materials. Dynamic chrome is
progressively enhanced with a structural observer; live LED text updates do not
cause repeated full scans. Existing IDs, controllers and project serialization
remain owned by `studio.js`.

The accordion fallback in `studio.js` was corrected: an unregistered section is
collapsed when it lacks the `expanded` class. This fixes the inverted state that
previously left sections open when their headers were clicked.

## Verification

Run `npm run test:portal-ui`. The dedicated browser test checks both portal modes
and themes, theme persistence and system changes, phone widths 344/412/700px,
keyboard accordions/tabs, mode-switch configuration retention, build-list flow,
secondary panels, LED Command Center and the desk-only entry. Screenshots and a
JSON report are written to `exports/portal-ui-review/`.
