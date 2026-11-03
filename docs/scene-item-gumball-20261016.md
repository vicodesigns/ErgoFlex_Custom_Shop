# Scene item editing — 16 October 2026

In **Rearrange items**, double-click or double-tap a furnishing or desk item to show the unified gumball. Arrows move, rings rotate, and square handles scale. Escape hides it. The selected objects retain their original parents, including desk mounts and linked table contents. Each completed handle drag is one undoable edit.

Ctrl/Cmd+C copies the selected item and Ctrl/Cmd+V pastes an independent copy with a small placement offset. Room furniture includes linked table dressing. Copies preserve geometry, materials, node visibility and transforms, and are saved as source recipes rather than embedded model files. Pasted items support Delete and undo/redo. Typing fields retain their normal keyboard behavior.

The preview toolbar is controlled by the URL: `tour=0` hides it; `tour=1` enables Full, Room, Size, Time and Groove. The updated preview uses `tour=1&v=item-gumball-clipboard-20261016`. Saved arrangements remain in their original browser storage.

Verification: `tests/scene-item-gumball-clipboard-test.cjs` covers real mouse and touch double-taps, full-screen editing, move/rotate/scale, parent retention, transform undo/redo, linked furniture copying, repeated paste, source removal and persisted copies. `tests/scene-desk-data-test.mjs` checks saved desk data. The in-app browser was also checked visually with a chair selected in the Humboldt commons full-screen view.
