// The Director's keyboard and mouse, as data: one row per action. Pure (no DOM), so node tests can run it.
//   It feeds the dispatcher in director.mjs (which runs the rows it owns), the shortcut panel (keys-panel.mjs), the
//   "Keys that changed" hints and docs/director-shortcuts.md. Replaces the hand-kept catalog of shortcuts.mjs.
//
// A row: { id, label, keys: [spec...], ctx, phase, origin, ... }
//   keys   'Ctrl+Shift+Z', 'Alt+ArrowLeft', 'Space', '?', 'F1', 'C', '1'. Ctrl also means Cmd. A letter or digit matches
//          the physical key (event.code); a symbol matches the character (event.key) whatever Shift does.
//   ctx    where it applies: 'global', 'view', 'timeline' (always on), an item kind ('camera', 'desk-clip', 'title',
//          'graphic', 'light-clip', 'light', 'prop', 'person', 'person-keys', 'group') or a modal tool ('keys-panel',
//          'still', 'shape', 'pose'). Modal tools come first, then the selected item, then the always-on keys.
//   phase  when it goes live ('1a' now; later phases are listed nowhere until they land).
//   owner  'director' (the dispatcher runs it), 'editor' (an editor's own handler runs it; the row only documents it
//          and the dispatcher lets the key through), 'gesture' (mouse; listed, never dispatched).
//   onButton: false  not while a button has focus (Enter keeps pressing the button).
//   inField  also works while a number field, select or slider has focus; inText: also while typing text.
//   repeat   runs again while the key is held (nudges, steps); hold: has a key-up half (released on blur too).
//   shadows  always-on actions this row hides while its context is live (declared on purpose; the test fails on any other).
//   origin   the app it matches: Premiere, After Effects, Rhino, Blender, Unreal, Director (ours).
//   aliases  what the command search (Ctrl+P) also finds it by: Rhino's command names (m, ro, sc, zs, ze, top…).
// Vico's own keys (the panel's Edit keys) are kept as { id: [spec...] } (keys-panel.mjs, ui store) and laid over this
// table by effectiveActions(); only rows the Director runs can be rebound, never to a RESERVED key.
export const LIVE_PHASES = new Set(['1a', '1a2', '1b', '2', '3', '4', '6']);

const R = (id, label, keys, ctx, more = {}) => ({ id, label, keys, ctx, phase: '1a', owner: 'director', ...more });
const E = (id, label, keys, ctx, more = {}) => R(id, label, keys, ctx, { owner: 'editor', ...more });
const G = (id, label, gesture, ctx, more = {}) => R(id, label, [], ctx, { owner: 'gesture', gesture, ...more });

export const ACTIONS = [
  // ---- everywhere in the Director
  R('keys-panel', 'Shortcut panel (this list)', ['?'], 'global', { origin: 'Director' }),
  R('keys-panel-anywhere', 'Shortcut panel, even while typing', ['Ctrl+Alt+K', 'F1'], 'global', { inText: true, inField: true, origin: 'Premiere' }),
  R('play', 'Play / pause the chapter', ['Space'], 'global', { origin: 'Premiere' }),
  R('step-back', 'Playhead back one frame (Shift: one second)', ['ArrowLeft', 'Shift+ArrowLeft'], 'global', { repeat: true, origin: 'Premiere' }),
  R('step-forward', 'Playhead forward one frame (Shift: one second)', ['ArrowRight', 'Shift+ArrowRight'], 'global', { repeat: true, origin: 'Premiere' }),
  R('go-start', 'Chapter start', ['Home'], 'global', { origin: 'Premiere' }),
  R('go-end', 'Chapter end', ['End'], 'global', { origin: 'Premiere' }),
  R('edit-prev', 'Previous edit (camera view)', ['ArrowUp'], 'global', { repeat: true, origin: 'Premiere' }),
  R('edit-next', 'Next edit (camera view)', ['ArrowDown'], 'global', { repeat: true, origin: 'Premiere' }),
  R('chapter-prev', 'Previous chapter', ['PageUp'], 'global', { origin: 'Director' }),
  R('chapter-next', 'Next chapter', ['PageDown'], 'global', { origin: 'Director' }),
  R('camera-add', 'Add a camera view at the playhead', ['C'], 'global', { origin: 'Director' }),
  R('film-camera', 'Back to the film camera (leave free view)', ['0'], 'global', { origin: 'Blender', aliases: ['film', 'cam', 'camera'] }),
  R('palette', 'Command search: type an action or a Rhino command (Enter on an empty search repeats the last)', ['Ctrl+P'], 'global', { phase: '1a2', inField: true, inText: true, origin: 'Rhino' }),
  R('repeat-last', 'Repeat the last command', [], 'global', { phase: '1a2', origin: 'Rhino', aliases: ['again', 'repeat'] }),
  R('report', 'Report a problem (a screenshot, the selection and your last 50 actions, for Claude)', [], 'global', { phase: '1a2', origin: 'Director', aliases: ['bug', 'problem', 'report'] }),
  R('undo', 'Undo', ['Ctrl+Z'], 'global', { inField: true, repeat: true, baking: false, origin: 'Premiere' }),
  R('redo', 'Redo', ['Ctrl+Y', 'Ctrl+Shift+Z'], 'global', { inField: true, repeat: true, origin: 'Premiere' }),
  R('save', 'Save in this browser (the cut library)', ['Ctrl+S'], 'global', { inField: true, inText: true, origin: 'Premiere' }),
  R('export', 'Export cut (save, then download for the film)', ['Ctrl+M'], 'global', { inField: true, inText: true, origin: 'Premiere' }),
  R('duplicate', 'Duplicate the selected view, movement or person', ['Ctrl+D'], 'global', { inField: true, origin: 'Premiere' }),
  R('select-all', 'Select every key and clip in the chapter', ['Ctrl+A'], 'global', { origin: 'Premiere' }),
  R('select-lane', 'Select everything in the lane under the pointer', ['Ctrl+Shift+A'], 'global', { origin: 'Director' }),
  R('open-inspector', 'Open the selection in the inspector', ['Enter'], 'global', { onButton: false, origin: 'Director' }),
  R('sound', 'Sound on / off', ['Shift+M'], 'global', { origin: 'Director' }),
  R('speed-down', 'Play slower: ½×, ¼×', ['<'], 'global', { phase: '6', origin: 'Director', aliases: ['slow', 'half speed'] }),
  R('speed-up', 'Play faster again (up to normal speed)', ['>'], 'global', { phase: '6', origin: 'Director', aliases: ['normal speed'] }),
  R('toggle-inspector', 'Hide / show the side column', ['Tab'], 'global', { phase: '1b', onButton: false, origin: 'Unreal' }),
  R('toggle-timeline', 'Hide / show the timeline', ['Shift+Tab'], 'global', { phase: '1b', onButton: false, origin: 'Director' }),
  R('maximise', 'Maximise the panel under the pointer (again: back)', ['`'], 'global', { phase: '1b', origin: 'Premiere' }),
  R('review', 'Review mode: the film alone, the whole window, playing (Esc: back)', ['Ctrl+`'], 'global', { phase: '1b', inField: true, origin: 'Director', aliases: ['review', 'fullscreen'] }),
  E('escape', 'Deselect, one level at a time; closes a menu, the still view or this panel', ['Escape'], 'global', { origin: 'Premiere' }),
  E('delete', 'Delete the selection (a room prop is hidden, not deleted)', ['Delete', 'Backspace'], 'global', { origin: 'Premiere' }),

  // ---- the timeline (always on)
  R('loop', 'Loop on / off', ['L'], 'timeline', { origin: 'Director' }),
  R('snap', 'Snapping on / off (Magnet)', ['S'], 'timeline', { origin: 'Premiere' }),
  R('zoom-in', 'Timeline zoom in', ['=', '+'], 'timeline', { repeat: true, origin: 'Premiere' }),
  R('zoom-out', 'Timeline zoom out', ['-'], 'timeline', { repeat: true, origin: 'Premiere' }),
  R('zoom-fit', 'Fit the chapter in the timeline', ['Shift+Z'], 'timeline', { origin: 'Director' }),
  R('lane-filter', 'Lanes: all → only those with something → only the selection\'s (After Effects U / UU)', ['Shift+U'], 'timeline', { phase: '4', origin: 'After Effects', aliases: ['filter', 'solo lanes'] }),
  R('zoom-selection', 'Zoom to the selection', ['Z'], 'timeline', { phase: '4', origin: 'Premiere' }),
  G('zoom-wheel', 'Zoom at the pointer · Shift+wheel: pan', 'Ctrl + wheel', 'timeline', { phase: '4', origin: 'Premiere' }),
  R('marker', 'Add a marker at the playhead (on a marker: remove it)', ['M'], 'timeline', { phase: '4', origin: 'Premiere' }),
  R('marker-prev', 'Previous marker', ['Shift+ArrowUp'], 'timeline', { phase: '4', origin: 'Premiere' }),
  R('marker-next', 'Next marker', ['Shift+ArrowDown'], 'timeline', { phase: '4', origin: 'Premiere' }),
  R('loop-start', 'Loop range starts at the playhead', ['B'], 'timeline', { phase: '4', origin: 'Director' }),
  R('loop-end', 'Loop range ends at the playhead', ['N'], 'timeline', { phase: '4', origin: 'Director' }),
  R('loop-clear', 'Clear the loop range', ['Alt+X'], 'timeline', { phase: '4', origin: 'Premiere' }),
  R('to-playhead-start', 'The selection starts at the playhead', ['['], 'timeline', { phase: '4', origin: 'Premiere' }),
  R('to-playhead-end', 'The selection ends at the playhead', [']'], 'timeline', { phase: '4', origin: 'Premiere' }),
  R('groups-collapse', 'Fold every lane group (Alt-click a group: all of them)', ['{'], 'timeline', { phase: '3', origin: 'After Effects' }),
  R('groups-expand', 'Unfold every lane group', ['}'], 'timeline', { phase: '3', origin: 'After Effects' }),
  R('group-1', 'Jump to Titles & graphics (opens the group)', ['1'], 'timeline', { origin: 'Director' }),
  R('group-2', 'Jump to the Camera lane', ['2'], 'timeline', { origin: 'Director' }),
  R('group-3', 'Jump to the featured desk (Lift, Tilt, Wheels)', ['3'], 'timeline', { origin: 'Director' }),
  R('group-4', 'Jump to People', ['4'], 'timeline', { origin: 'Director' }),
  R('group-5', 'Jump to Props', ['5'], 'timeline', { origin: 'Director' }),
  R('group-6', 'Jump to World (time of day, room light)', ['6'], 'timeline', { origin: 'Director' }),
  R('group-7', 'Jump to Lights (desk white, status, lamps)', ['7'], 'timeline', { origin: 'Director' }),
  R('group-8', 'Jump to Sound (the score and the movement sounds)', ['8'], 'timeline', { phase: '2', origin: 'Director' }),
  R('nudge-back', 'Nudge the selection one frame earlier (Shift: 10 frames)', ['Alt+ArrowLeft', 'Shift+Alt+ArrowLeft'], 'timeline', { repeat: true, origin: 'Premiere' }),
  R('nudge-forward', 'Nudge the selection one frame later (Shift: 10 frames)', ['Alt+ArrowRight', 'Shift+Alt+ArrowRight'], 'timeline', { repeat: true, origin: 'Premiere' }),
  G('drag-ruler', 'Move the playhead', 'Click or drag the ruler', 'timeline'),
  G('drag-snap', 'Bypass snapping while dragging a block or a key', 'Alt + drag', 'timeline'),
  G('drag-edge', 'Trim or resize a block', 'Drag an edge', 'timeline'),
  G('pick-several', 'Pick several (group)', 'Shift / Ctrl+click, or drag over empty lane', 'timeline'),

  // ---- the 3D view (always on)
  R('tool-move', 'Move (gizmo)', ['W'], 'view', { origin: 'Rhino', aliases: ['m', 'move'] }),
  R('tool-rotate', 'Rotate (gizmo; aims a selected light)', ['E'], 'view', { origin: 'Rhino', aliases: ['ro', 'rotate'] }),
  R('tool-scale', 'Scale (gizmo)', ['R'], 'view', { origin: 'Rhino', aliases: ['sc', 'scale'] }),
  R('frame-selection', 'Frame the selection', ['F'], 'view', { origin: 'Rhino', aliases: ['zs', 'zoom selected'] }),
  R('frame-room', 'Frame the whole room', ['Shift+F'], 'view', { origin: 'Rhino', aliases: ['ze', 'zoom extents'] }),
  R('isolate', 'Isolate: only the selection in the view (again, or Esc: everything back)', ['/'], 'view', { phase: '6', origin: 'Blender', aliases: ['isolate', 'hide others'] }),
  R('lock-camera', 'Lock camera to view: moving the view updates the selected camera view', [], 'view', { phase: '6', origin: 'Blender', aliases: ['lock', 'lock camera'] }),
  R('crop-cycle', 'Social crop guide over the frame: 9:16 → 1:1 → 4:5 → off', ['Shift+G'], 'view', { phase: '6', origin: 'Premiere', aliases: ['crop', '9:16', 'square', 'reel'] }),
  R('overlays', 'Overlays menu (guides, crop, film look, light markers, titles)', ['Shift+O'], 'view', { phase: '6', origin: 'Director', aliases: ['overlays'] }),
  R('view-persp', 'Perspective view (from above, at an angle)', [], 'view', { phase: '1a2', origin: 'Rhino', aliases: ['persp', 'perspective'] }),
  R('view-top', 'Top view (looking straight down)', [], 'view', { phase: '1a2', origin: 'Rhino', aliases: ['top', 'plan'] }),
  R('view-front', 'Front view', [], 'view', { phase: '1a2', origin: 'Rhino', aliases: ['front'] }),
  R('view-right', 'Right view', [], 'view', { phase: '1a2', origin: 'Rhino', aliases: ['right', 'side'] }),
  R('film-look', 'Live / Film look / Split', ['V'], 'view', { origin: 'Director' }),
  R('guides', 'Thirds and title-safe guides', ['G'], 'view', { origin: 'Director' }),
  R('still', 'Still image of this frame', ['Shift+R'], 'view', { origin: 'Director' }),
  R('peek', 'Peek at the live view under a still (hold)', ['\\'], 'view', { hold: true, origin: 'Director' }),
  R('light-markers', 'Show / hide the light markers', ['Shift+L'], 'view', { origin: 'Director' }),
  G('gumball-type', 'Exact value: while dragging a gizmo (or just after), type 12, 12in, 30cm, 45°, 150% and press Enter', 'Type during a drag', 'view', { phase: '3', origin: 'Rhino' }),
  G('gumball-shift', 'Constrain a free or plane move to its main axis', 'Shift while dragging', 'view', { phase: '3', origin: 'Rhino' }),
  G('gumball-ctrl', 'Snap (5 cm, 15°, 10 %); inverts while held', 'Ctrl while dragging', 'view', { phase: '3', origin: 'Rhino' }),
  R('gizmo-space', 'Gizmo frame: World / Object (the room desk keeps its own)', [], 'view', { phase: '3', origin: 'Rhino', aliases: ['world', 'object', 'local', 'space'] }),
  G('orbit', 'Orbit', 'Right-drag', 'view', { origin: 'Rhino' }),
  G('pan', 'Pan', 'Shift + right-drag, or middle-drag', 'view', { origin: 'Rhino' }),
  G('zoom-drag', 'Zoom', 'Ctrl + right-drag', 'view', { origin: 'Rhino' }),
  G('wheel', 'Zoom toward the pointer', 'Wheel', 'view', { origin: 'Rhino' }),
  G('centre', 'Centre the selection (the next orbit turns around it); nothing selected: the point under the pointer', 'Click the wheel', 'view', { origin: 'Rhino' }),
  G('box', 'Box select props: left-to-right picks what is inside, right-to-left what it touches (Shift adds, Ctrl removes)', 'Left-drag on empty space', 'view', { origin: 'Rhino' }),
  G('click', 'Select · Shift+click adds · Ctrl+click toggles', 'Click', 'view', { origin: 'Rhino' }),

  // ---- items (live while selected)
  R('camera-update', 'Update this view from what the 3D view shows', ['U'], 'camera', { origin: 'Director' }),
  R('key-ease-cycle', 'Interpolation to the next view: Smooth → Linear → Hold', ['T'], 'camera', { phase: '4', origin: 'After Effects' }),
  R('key-ease-smooth', 'Smooth (Easy Ease) to the next view', ['F9'], 'camera', { phase: '4', origin: 'After Effects' }),
  R('lens-prev', 'Wider view (field of view 24° → 35° → 50°)', [','], 'camera', { origin: 'Director' }),
  R('lens-next', 'Closer view (field of view 50° → 35° → 24°)', ['.'], 'camera', { origin: 'Director' }),
  R('play-selection', 'Play just this move', ['Shift+Space'], 'desk-clip', { origin: 'Premiere' }),
  R('play-selection', 'Play from this title', ['Shift+Space'], 'title', { origin: 'Premiere' }),
  R('play-selection', 'Play from this graphic', ['Shift+Space'], 'graphic', { origin: 'Premiere' }),
  R('title-nudge', 'Nudge the title (3D view: 1 px in the frame; timeline: one frame); Shift ×10', ['Alt+ArrowLeft', 'Alt+ArrowRight', 'Alt+ArrowUp', 'Alt+ArrowDown', 'Shift+Alt+ArrowLeft', 'Shift+Alt+ArrowRight', 'Shift+Alt+ArrowUp', 'Shift+Alt+ArrowDown'], 'title', { repeat: true, shadows: ['nudge-back','nudge-forward'], origin: 'After Effects' }),
  E('title-split', 'Split at the playhead', ['Ctrl+K'], 'title', { origin: 'Premiere' }),
  E('title-copy', 'Copy / paste at the playhead (across chapters)', ['Ctrl+C', 'Ctrl+V'], 'title', { origin: 'Premiere' }),
  G('title-line', 'Move one line alone (it snaps; Alt: no snapping); Esc drops the line first', 'Click a line, drag', 'title'),
  E('graphic-split', 'Split at the playhead', ['Ctrl+K'], 'graphic', { origin: 'Premiere' }),
  G('light-white', 'Add a colour key instead of a light state', 'Shift + “+ Light”', 'light-clip'),
  R('light-on', 'Light on / off', ['O'], 'light', { origin: 'Director' }),
  R('light-solo', 'Solo this light (preview only)', ['Alt+S'], 'light', { origin: 'Director' }),
  R('reset-film', 'Reset to the film', ['Alt+R'], 'prop', { origin: 'Director' }),
  E('prop-drop', 'Drop onto the surface below (Shift: flat, Alt: align)', ['End', 'Shift+End', 'Alt+End'], 'prop', { shadows: ['go-end'], origin: 'Director' }),
  G('prop-copy', 'Copy a prop you added: the copy stays where it was, you move the original', 'Alt + drag the gizmo', 'prop', { phase: '3', origin: 'Rhino' }),
  G('prop-snap', 'Snap the gizmo (5 cm, 15°); Shift holds the main axis', 'Ctrl (held)', 'prop'),
  G('prop-inside', 'Pick the part underneath', 'Alt+click', 'prop'),
  R('pose-mode', 'Pose mode', ['P'], 'person', { origin: 'Director' }),
  R('reset-film', 'Reset to the film', ['Alt+R'], 'person', { origin: 'Director' }),
  G('person-pose', 'Pose mode', 'Double-click the person', 'person'),
  E('sheet-jump', 'Previous / next key', ['J', 'K'], 'person-keys', { origin: 'After Effects' }),
  E('sheet-copy', 'Copy / paste the picked keys at the playhead', ['Ctrl+C', 'Ctrl+V'], 'person-keys', { origin: 'After Effects' }),
  G('sheet-ease', 'Interpolation: linear, smooth, hold', 'Right-click a key', 'person-keys'),

  // ---- modal tools (they win over everything else while on)
  R('keys-panel-close', 'Close this panel', ['Escape'], 'keys-panel', { shadows: ['escape'], origin: 'Director' }),
  E('still-step', 'Older / newer still', ['ArrowLeft', 'ArrowRight'], 'still', { shadows: ['step-back','step-forward'], origin: 'Director' }),
  E('still-close', 'Close the still view', ['Escape'], 'still', { shadows: ['escape'], origin: 'Director' }),
  E('shape-nudge', 'Nudge the point or shape 1 px (Shift: 10)', ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift+ArrowLeft', 'Shift+ArrowRight', 'Shift+ArrowUp', 'Shift+ArrowDown'], 'shape', { shadows: ['step-back','step-forward','edit-prev','edit-next','marker-prev','marker-next'], origin: 'Director' }),
  E('shape-delete', 'Remove the point', ['Delete', 'Backspace'], 'shape', { shadows: ['delete'], origin: 'Director' }),
  E('shape-all', 'Select every part', ['Ctrl+A'], 'shape', { shadows: ['select-all'], origin: 'Director' }),
  E('shape-done', 'Finish editing the shape', ['Enter'], 'shape', { shadows: ['open-inspector'], origin: 'Director' }),
  E('shape-esc', 'Deselect the point; again to finish', ['Escape'], 'shape', { shadows: ['escape'], origin: 'Director' }),
  R('pose-key', 'Key every joint at the playhead', ['I'], 'pose', { origin: 'Blender' }),
  R('pose-key-limb', 'Key just the selected limb', ['Shift+I'], 'pose', { origin: 'Blender' }),
  R('pose-key-delete', 'Delete the key at the playhead', ['Alt+I'], 'pose', { origin: 'Blender' }),
  R('pose-auto-key', 'Auto-key on / off', ['Shift+K'], 'pose', { origin: 'Director' }),
  R('pose-reset-joint', 'Reset the joint', ['Alt+R'], 'pose', { origin: 'Blender' }),
  R('pose-reset', 'Reset the whole pose', ['Shift+Alt+R'], 'pose', { origin: 'Blender' }),
  E('pose-delete', 'Delete the selected key, or reset the joint', ['Delete', 'Backspace'], 'pose', { shadows: ['delete'], origin: 'Director' }),
];

// Sections of the panel, in order. Item sections light up while their item is selected.
export const SECTIONS = [
  ['keys-panel', 'This panel'], ['global', 'Everywhere in the Director'], ['timeline', 'The timeline'], ['view', 'The 3D view'],
  ['still', 'Still view'], ['shape', 'Title shadow (editing its shape)'], ['pose', 'Pose mode'],
  ['group', 'Several items picked'], ['camera', 'Camera view (key)'], ['desk-clip', 'Desk move (block)'], ['title', 'Title'],
  ['graphic', 'Graphic (clip)'], ['light-clip', 'Lighting key or block'], ['light', 'Scene light'], ['prop', 'Prop'],
  ['person', 'Person'], ['person-keys', 'Person: timeline keys'],
];
export const ALWAYS = new Set(['global', 'timeline', 'view']);
const MODAL = ['keys-panel', 'still', 'shape', 'pose'];
const ITEM_ORDER = ['group', 'person-keys', 'camera', 'desk-clip', 'title', 'graphic', 'light-clip', 'light', 'prop', 'person'];

// Keys the Director never binds: the browser or the desktop keeps them (tests check the table against this).
export const RESERVED = ['Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+Shift+T', 'Ctrl+Shift+N', 'Ctrl+Tab', 'Ctrl+Shift+Tab',
  ...'123456789'.split('').map(d => 'Ctrl+' + d), ...'12345678'.split('').map(d => 'Alt+' + d), 'Ctrl+L', 'Alt+D', 'Alt+F', 'Alt+E',
  'F5', 'F11', 'F12', 'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+Shift+C', 'Ctrl+Alt+ArrowLeft', 'Ctrl+Alt+ArrowRight',
  'Ctrl+Alt+ArrowUp', 'Ctrl+Alt+ArrowDown', 'Ctrl+Space', 'Alt+Space', 'Alt+Tab', 'Alt+F4', 'Ctrl+F4', 'Ctrl+R', 'Ctrl+F', 'Ctrl+Shift+R'];

// Keys that meant something else before 17 Nov 2026: the panel lists them, and pressing one shows the hint once in a
// while for two weeks. `spec` is the old key; `ctx`: only when that item is selected (null: always).
export const CHANGED = [
  { spec: 'R', was: 'Render a still', now: 'R is now Scale (W move · E rotate · R scale). Still image: Shift+R.' },
  { spec: 'T', was: 'Scale', now: 'Scale is now R (W move · E rotate · R scale).' },
  { spec: 'F', was: 'Live / Film look / Split', now: 'F now frames the selection. Live / Film look / Split: V.' },
  { spec: 'L', was: 'Show the light markers', now: 'L now turns loop on / off. Light markers: Shift+L.' },
  { spec: 'Shift+L', was: 'Jump to the lighting lanes', now: 'Shift+L now shows the light markers. Lighting lanes: 6 and 7.' },
  { spec: 'ArrowLeft', was: 'Nudge a focused view, move or title 0.1 s', now: '←/→ now always step the playhead. Nudge the selection: Alt+←/→ (one frame, Shift ×10).' },
  { spec: 'ArrowRight', was: 'Nudge a focused view, move or title 0.1 s', now: '←/→ now always step the playhead. Nudge the selection: Alt+←/→ (one frame, Shift ×10).' },
  { spec: 'Ctrl+S', was: '(nothing)', now: 'Ctrl+S saves in this browser. Export the cut for the film: Ctrl+M.' },
  { gesture: 'Right-click a path point', was: 'Remove the point', now: 'Right-drag now orbits. Remove a path point: select it, then Delete.' },
  { gesture: 'Shift while dragging a prop', was: 'Snap to 5 cm / 15°', now: 'Shift now holds the main axis (Rhino). Snapping: hold Ctrl.' },
  { gesture: 'Left-drag in the 3D view', was: 'Orbit', now: 'Left-drag now draws a box (props). Orbit: right-drag · Pan: Shift+right-drag · Zoom: wheel.' },
];

// ---- matching ---------------------------------------------------------------------------------------------------
const NAMED = new Set(['Space', 'Enter', 'Escape', 'Delete', 'Backspace', 'Home', 'End', 'PageUp', 'PageDown', 'Tab',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ...Array.from({ length: 12 }, (_, i) => 'F' + (i + 1))]);
export function parseSpec(spec) {
  const parts = spec === '+' ? ['+'] : spec.endsWith('++') ? [...spec.slice(0, -2).split('+'), '+'] : spec.split('+');
  const base = parts.pop(), mods = new Set(parts);
  const kind = NAMED.has(base) ? 'named' : /^[A-Za-z0-9]$/.test(base) ? 'code' : 'char';
  return { base, kind, ctrl: mods.has('Ctrl'), shift: mods.has('Shift'), alt: mods.has('Alt'),
    code: kind === 'code' ? (/\d/.test(base) ? 'Digit' + base : 'Key' + base.toUpperCase()) : null };
}
// ev: { key, code, ctrlKey, metaKey, shiftKey, altKey } (a KeyboardEvent, or a plain object in tests).
export function matchSpec(spec, ev) {
  const s = typeof spec === 'string' ? parseSpec(spec) : spec, ctrl = !!(ev.ctrlKey || ev.metaKey);
  if (ctrl !== s.ctrl || !!ev.altKey !== s.alt) return false;
  if (s.kind === 'char') return ev.key === s.base;                      // '?', '\\', '=', ',' whatever Shift does
  if (!!ev.shiftKey !== s.shift) return false;
  if (s.kind === 'code') return ev.code === s.code || (!ev.code && String(ev.key).toUpperCase() === s.base.toUpperCase());
  return ev.key === s.base || (s.base === 'Space' && (ev.code === 'Space' || ev.key === ' '));
}
const isArrowish = k => /^(Arrow|Home$|End$|Page)/.test(k);

// The context stack for a moment: modal tools that are on, then the selected items, then the always-on contexts.
export function stackOf(state) {
  const items = state.items || new Set();
  return [...MODAL.filter(m => items.has(m)), ...ITEM_ORDER.filter(i => items.has(i)), 'global', 'timeline', 'view'];
}
// The row a key press means now, or null. state: { items: Set of live contexts, target: 'text' | 'field' | 'range' |
// 'button' | 'other', dialog: bool, baking: bool, phases?: Set }. An 'editor' or 'gesture' row is returned too (the
// dispatcher lets those through); a key no row claims returns null.
export function resolve(ev, state = {}) {
  if (ev.isComposing || ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'].includes(ev.key)) return null;
  const phases = state.phases || LIVE_PHASES, target = state.target || 'other', table = state.actions || ACTIONS;
  if (state.dialog && !(ev.ctrlKey || ev.metaKey)) return null;
  for (const ctx of stackOf(state)) {
    for (const row of table) {
      if (row.ctx !== ctx || row.owner === 'gesture' || !phases.has(row.phase)) continue;
      if (!row.keys.some(k => matchSpec(k, ev))) continue;
      if (target === 'text' && !row.inText) continue;
      if ((target === 'field' || target === 'range') && !row.inField && !(row.inText)) continue;
      if (target === 'range' && isArrowish(ev.key)) continue;
      if (target === 'button' && row.onButton === false) continue;      // Enter still presses a focused button
      if (state.baking && row.baking === false) continue;
      return row;
    }
  }
  return null;
}
// ---- Vico's own keys ----------------------------------------------------------------------------------------------
// The table with his bindings laid over it ({ id: [spec...] }; an empty list unbinds). Rows that are not the
// Director's to run keep their keys.
export function effectiveActions(bindings = {}) {
  return ACTIONS.map(r => r.owner === 'director' && Array.isArray(bindings?.[r.id]) ? { ...r, keys: bindings[r.id].filter(k => typeof k === 'string'), rebound: true } : r);
}
const normal = spec => keyText(spec).toLowerCase();
// The spec a key press means ('Ctrl+Shift+K', 'Alt+ArrowLeft', '?'), or null for a modifier on its own.
export function specOf(ev) {
  if (['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'].includes(ev.key)) return null;
  const code = String(ev.code || ''), letter = code.match(/^Key([A-Z])$/)?.[1], digit = code.match(/^Digit(\d)$/)?.[1];
  let base = letter || digit || (ev.key === ' ' ? 'Space' : NAMED.has(ev.key) ? ev.key : null), char = false;
  if (!base) { base = ev.key; char = true; }
  if (!base || base.length > 12) return null;
  return [(ev.ctrlKey || ev.metaKey) && 'Ctrl', ev.altKey && 'Alt', ev.shiftKey && !char && 'Shift', base].filter(Boolean).join('+');
}
// May `spec` be one of row `id`'s keys? { ok } | { reserved } | { clash: row } | { fixed } (not the Director's to run).
// A clash is another row with that key in the same context, or where one of the two is always on (it would hide the
// other without saying so).
export function bindCheck(id, spec, bindings = {}) {
  const row = ACTIONS.find(r => r.id === id); if (!row || row.owner !== 'director') return { fixed: true };
  if (RESERVED.some(k => normal(k) === normal(spec))) return { reserved: true };
  if (/^(Ctrl\+)?(Alt\+)?(Shift\+)?(Escape|Tab)$/.test(spec)) return { reserved: true };
  const clash = effectiveActions(bindings).find(r => r.id !== id && r.owner !== 'gesture' && LIVE_PHASES.has(r.phase) && r.keys.some(k => normal(k) === normal(spec))
    && (r.ctx === row.ctx || ALWAYS.has(r.ctx) || ALWAYS.has(row.ctx)) && !(row.shadows || []).includes(r.id) && !(r.shadows || []).includes(id));
  return clash ? { clash } : { ok: true };
}
// The bindings with `spec` as row `id`'s only key (or `spec` null: back to the default).
export function rebind(bindings, id, spec) {
  const next = { ...(bindings || {}) };
  if (spec === null) { delete next[id]; return next; }
  const check = bindCheck(id, spec, next); if (!check.ok) throw Object.assign(Error(check.reserved ? `${keyText(spec)} belongs to the browser.` : check.clash ? `${keyText(spec)} is already “${check.clash.label}”.` : 'That one is not yours to change.'), check);
  next[id] = [spec]; return next;
}
// The command search (Ctrl+P): rows the Director runs, best match first, for `query` (a label word, a Rhino alias, a key).
export function searchActions(query, table = ACTIONS, phases = LIVE_PHASES) {
  const q = String(query || '').trim().toLowerCase(), rows = table.filter(r => r.owner === 'director' && phases.has(r.phase) && !['palette', 'keys-panel-close'].includes(r.id));
  if (!q) return rows;
  const score = r => {
    const aliases = r.aliases || [], label = r.label.toLowerCase();
    if (aliases.includes(q)) return 0;
    if (r.keys.some(k => normal(k) === q)) return 1;
    if (aliases.some(a => a.startsWith(q))) return 2;
    if (label.startsWith(q)) return 3;
    if (label.split(/[^a-z0-9]+/).some(w => w.startsWith(q))) return 4;
    if (label.includes(q) || r.id.includes(q)) return 5;
    return 9;
  };
  return rows.map(r => [score(r), r]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0]).map(([, r]) => r);
}
// What a focused element means for keys.
export function targetKind(el) {
  if (!el || !el.tagName) return 'other';
  if (el.isContentEditable) return 'text';
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return 'text';
  if (tag === 'SELECT') return 'field';
  if (tag === 'INPUT') {
    const type = (el.type || 'text').toLowerCase();
    if (type === 'range') return 'range';
    if (['checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file'].includes(type)) return 'button';
    if (['number'].includes(type)) return 'field';
    return 'text';
  }
  if (tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A') return 'button';
  return 'other';
}
// The hint for a key that changed meaning, or null.
export function changedHint(ev) {
  for (const c of CHANGED) if (c.spec && matchSpec(c.spec, ev)) return c;
  return null;
}

// ---- display ----------------------------------------------------------------------------------------------------
const CAP = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', PageUp: 'PgUp', PageDown: 'PgDn', Escape: 'Esc', Backspace: '⌫', Ctrl: 'Ctrl', ' ': 'Space' };
export const capsOf = spec => { const s = parseSpec(spec); return [s.ctrl && 'Ctrl', s.alt && 'Alt', s.shift && 'Shift', CAP[s.base] || s.base].filter(Boolean); };
export const keyText = spec => capsOf(spec).join('+');
// Rows for the panel (live phases only), grouped by section: [{ id, title, rows }].
export function panelSections(phases = LIVE_PHASES) {
  return SECTIONS.map(([id, title]) => ({ id, title, rows: ACTIONS.filter(a => a.ctx === id && phases.has(a.phase)) })).filter(s => s.rows.length);
}
// The table as Markdown (docs/director-shortcuts.md is this, generated).
export function markdown(phases = LIVE_PHASES) {
  const out = ['# Director keyboard and mouse', '', 'Generated from `experience/director-actions.mjs` (do not edit by hand). Ctrl also means Cmd.', ''];
  for (const s of panelSections(phases)) {
    out.push(`## ${s.title}`, '', '| Keys | Action | Same as |', '|---|---|---|');
    for (const r of s.rows) out.push(`| ${r.owner === 'gesture' ? r.gesture : r.keys.length ? r.keys.map(keyText).join(' / ') : 'Ctrl+P: ' + (r.aliases || [r.id]).join(', ')} | ${r.label} | ${r.origin || ''} |`);
    out.push('');
  }
  out.push('## Keys that changed (17 Nov 2026)', '', '| Key | Was | Now |', '|---|---|---|');
  for (const c of CHANGED) out.push(`| ${c.spec ? keyText(c.spec) : c.gesture} | ${c.was} | ${c.now} |`);
  return out.join('\n') + '\n';
}
