// The Director's keyboard shortcuts as data: one catalog feeds the "⌨ Shortcuts" card (press ? to open it).
// Two kinds of section: the ones that are always on (the Director, the view, the timeline) and the ones that belong
// to an item and come alive when that item is selected. The card shows the live ones first.
// When a key changes in director.mjs or an editor, change it here too (tests/shortcuts-test.mjs checks the shape).
const GLOBAL = [
  ['director', 'Everywhere in the Director', [
    ['?', 'This sheet (Esc closes it)'],
    ['Space', 'Play / pause the chapter'],
    ['← →', 'Step one frame (Shift: one second)'],
    ['Home End', 'Chapter start / end'],
    ['↑ ↓', 'Previous / next camera view (edit point)'],
    ['PgUp PgDn', 'Previous / next chapter'],
    ['+ −', 'Timeline zoom in / out'],
    ['C', 'Add a camera view at the playhead'],
    ['Ctrl/Cmd+Z', 'Undo'],
    ['Ctrl/Cmd+Y  Ctrl/Cmd+Shift+Z', 'Redo'],
    ['Ctrl/Cmd+D', 'Duplicate the selected camera view, movement, title or person'],
    ['Ctrl/Cmd+A', 'Select every key and clip in the chapter'],
    ['Ctrl/Cmd+Shift+A', 'Select everything in the lane under the pointer'],
    ['Esc', 'Deselect (one level at a time); closes the sheet, a menu or the still view']
  ]],
  ['view', 'The view', [
    ['F', 'Live / Film look / Split'],
    ['G', 'Thirds and title-safe guides'],
    ['S', 'Magnet: snap drags to edges, keys and the playhead'],
    ['R', 'Render a still of this frame'],
    ['~\\ (hold)', 'Peek at the still view'],
    ['L', 'Show / hide the light markers'],
    ['Shift+L', 'Jump to the lighting lanes'],
    ['~Alt + drag', 'Bypass snapping while dragging']
  ]]
];
const ITEMS = [
  ['camera', 'Camera view (key)', [
    ['← →', 'Nudge 0.1 s (Shift: 1 s)'],
    ['Delete', 'Remove the view'],
    ['Ctrl/Cmd+D', 'Duplicate it at the playhead']
  ]],
  ['desk-clip', 'Desk movement (clip)', [
    ['← →', 'Nudge 0.1 s (Shift: 1 s)'],
    ['Delete', 'Remove the movement'],
    ['Ctrl/Cmd+D', 'Duplicate it'],
    ['~Drag an edge', 'Resize']
  ]],
  ['title', 'Title', [
    ['Enter', 'Open its inspector'],
    ['← →', 'Nudge 0.1 s (Shift: 1 s)'],
    ['Delete', 'Remove the title'],
    ['Ctrl/Cmd+D', 'Duplicate it']
  ]],
  ['shape', 'Title shadow (while editing its shape)', [
    ['← ↑ ↓ →', 'Nudge the point or shape 1 px (Shift: 10)'],
    ['Delete', 'Remove the point'],
    ['Ctrl/Cmd+A', 'Select every part'],
    ['Enter', 'Finish editing'],
    ['Esc', 'Deselect the point; again to finish']
  ]],
  ['graphic', 'Graphic (clip)', [
    ['Ctrl/Cmd+K', 'Split at the playhead'],
    ['Enter', 'Select / open its inspector'],
    ['~Drag an edge', 'Trim or extend']
  ]],
  ['light-clip', 'Lighting key or clip', [
    ['Delete', 'Remove it'],
    ['~Shift + “+ Light”', 'Add a colour key instead of a light state']
  ]],
  ['light', 'Scene light (marker)', [
    ['W', 'Move'],
    ['E', 'Aim']
  ]],
  ['prop', 'Prop', [
    ['W E T', 'Move / rotate / scale'],
    ['~Shift (held)', 'Snap the gizmo'],
    ['End', 'Drop onto the surface below (Shift: flat, Alt: align)'],
    ['Delete', 'Hide it'],
    ['~Click', 'Select · Shift+click adds · Ctrl/Cmd+click toggles · Alt+click picks the part underneath']
  ]],
  ['person', 'Person', [
    ['W E T', 'Move / rotate / scale'],
    ['Ctrl/Cmd+D', 'Duplicate (60 cm to the side)'],
    ['Delete', 'Remove from the chapter'],
    ['Esc', 'Deselect']
  ]],
  ['person-keys', 'Person: timeline keys (the sheet under the person)', [
    ['J K', 'Previous / next key'],
    ['Ctrl/Cmd+C  Ctrl/Cmd+V', 'Copy / paste the picked keys at the playhead'],
    ['Delete', 'Delete the picked keys'],
    ['~Right-click', 'Interpolation: linear, smooth, hold'],
    ['Esc', 'No key selected']
  ]],
  ['pose', 'Pose mode (a person is being posed)', [
    ['I', 'Key every joint at the playhead'],
    ['Shift+I', 'Key just the selected limb'],
    ['Delete', 'Delete the selected key, or reset the joint'],
    ['W E', 'Move / rotate the selected joint']
  ]],
  ['group', 'Several items picked (Shift / Ctrl+click)', [
    ['← →', 'Nudge all of them (Shift: ×10)'],
    ['Delete', 'Delete all of them'],
    ['Esc', 'Clear the selection']
  ]],
  ['still', 'Still view', [
    ['← →', 'Step through the stills (older / newer)'],
    ['Esc', 'Close the still view']
  ]]
];
export const SHORTCUT_GLOBAL = GLOBAL, SHORTCUT_ITEMS = ITEMS;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const keys = k => k.split('  ').map(group => `<span class="sc-keys">${group.split(' ').map(x => `<kbd>${esc(x)}</kbd>`).join(' ')}</span>`).join(' / ');
// A key that starts with "~" is a gesture in plain words (not a key cap).
const rows = list => list.map(([k, text]) => `<div class="sc-row"><span class="sc-k">${k[0] === '~' ? esc(k.slice(1)) : keys(k)}</span><span class="sc-t">${esc(text)}</span></div>`).join('');
const section = (title, list, live) => `<section class="sc-sec${live ? ' sc-live' : ''}"><h4>${live ? '● ' : ''}${esc(title)}</h4>${rows(list)}</section>`;
// `active`: the set of item ids (the first column of ITEMS) that are selected right now.
export function shortcutsCardHtml(active = new Set()) {
  const live = ITEMS.filter(([id]) => active.has(id)), rest = ITEMS.filter(([id]) => !active.has(id));
  return `<b>Keyboard shortcuts</b><p class="sc-note">${live.length ? 'The highlighted sections are for what you have selected now.' : 'Select something (a view, title, prop, person…) and its own keys show up first.'}</p>`
    + live.map(([, t, l]) => section(t, l, true)).join('')
    + GLOBAL.map(([, t, l]) => section(t, l, false)).join('')
    + (rest.length ? `<p class="sc-note">Keys for items. They work once the item is selected:</p>` + rest.map(([, t, l]) => section(t, l, false)).join('') : '');
}
