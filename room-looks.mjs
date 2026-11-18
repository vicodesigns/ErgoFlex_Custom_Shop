// Room looks: versions of one room kept side by side, so a chapter can show either (18 Nov 2026, Vico: flip between
// versions of a room instead of losing the old one). Pure data (node tests, the Director, the Studio, film tools).
//
//   shot.look       a look id of the shot's room (cuts.mjs cleanShot keeps it; the Director's Room inspector sets it).
//                   Absent = the room's default look, which is what the room built before looks existed, so no cut, film
//                   chapter or cache key changes until someone picks a look (tools/experience/chapter-keys.py hashes
//                   the whole shot: a set look is part of that chapter's key, an absent one is not there at all).
//   ROOM_LOOKS      per room: its looks, first = default. A room without an entry has one look and no Look selector.
//                   A 'room/layout' key gives one layout of a room its own looks (the Commons: 'library/humboldt'); the
//                   room's other layouts have none.
//
// A look is built by the room's own code (workspace-3d.mjs WorkspaceRoom.set reads room.look; room-people.mjs and
// room-people-motion.mjs read it for the cast). Classic looks are frozen copies of the room's modules as they were.
// layout: the room's layout id. Left out (a caller that does not know it yet, e.g. the Studio's ?look=), a look any of
// the room's layouts has is kept; the room's build checks it against its real layout.
export const ROOM_LOOKS = {
  creative: [
    { id: 'refresh', name: 'Studio refresh', note: 'Nov 17 pass: oiled oak floor, limewashed brick, coastal studies, ferns, Lin\'s bob and work shirt' },
    { id: 'classic', name: 'Classic', note: 'the artist room as it was before the Nov 17 pass' },
  ],
  'library/humboldt': [
    { id: 'refresh', name: 'Studio refresh', note: 'Nov 17-18 passes: finishes and maps, bay planter, ferns, knit and twill cloth, library detail, window scenery' },
    { id: 'classic', name: 'Classic', note: 'the Commons as it was before the Nov 17-18 passes' },
  ],
};
const anyLayout = room => Object.keys(ROOM_LOOKS).filter(k => k.startsWith(room + '/')).flatMap(k => ROOM_LOOKS[k]);
export const looksOf = (room, layout) => (layout != null ? ROOM_LOOKS[room + '/' + layout] : null) || ROOM_LOOKS[room] || [];
export const defaultLook = (room, layout) => looksOf(room, layout)[0]?.id ?? null;
// A look the room has, else null (an unknown or another room's look is dropped).
export const cleanLook = (room, look, layout) => typeof look === 'string' && (layout == null && !ROOM_LOOKS[room] ? anyLayout(room) : looksOf(room, layout)).some(l => l.id === look) ? look : null;
// The look a room builds: the shot's, else the room's default (null for a room without looks).
export const lookOf = (room, look, layout) => cleanLook(room, look, layout) || defaultLook(room, layout);
export const lookName = (room, look, layout) => looksOf(room, layout).find(l => l.id === lookOf(room, look, layout))?.name || '';
