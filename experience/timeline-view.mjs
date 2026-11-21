// The timeline's view state, per cut and chapter (Vico, 20 Nov 2026: "the timeline must not reset when I edit"):
// which lane groups are folded, the zoom, and the scroll (left and top). Kept in this browser only, never in the cut.
// Pure apart from the storage handed in (node tests pass a Map-backed stub).
//   groups  {motion:false, lighting:true, ...}  false = open; a group not listed is FOLDED (first load: all folded)
//   zoom    1 = the whole chapter in the view
//   left, top  the viewport's scrollLeft / scrollTop in px
export const VIEW_STORE='ergoflex.director.timelineView.v1';
export const VIEW_LIMIT=300;   // entries kept (the least recently used go first)
const store=storage=>storage||globalThis.localStorage;
export function readViews(storage){try{const v=JSON.parse(store(storage)?.getItem(VIEW_STORE)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
const num=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
// One chapter's view, cleaned: always {groups, zoom, left, top, saved}; saved: false when nothing was stored yet.
export function viewFor(key,storage){
  const v=readViews(storage)[key];
  if(!v||typeof v!=='object')return {groups:{},zoom:1,left:0,top:0,saved:false};
  const groups={};for(const [g,c] of Object.entries(v.groups||{}))if(typeof c==='boolean')groups[g]=c;
  return {groups,zoom:Math.max(1,num(v.zoom,1)),left:Math.max(0,num(v.left,0)),top:Math.max(0,num(v.top,0)),saved:true};
}
// Merge `patch` into the chapter's view and store it (oldest entries dropped past VIEW_LIMIT).
export function saveView(key,patch,storage,now=Date.now()){
  const all=readViews(storage),was=all[key]&&typeof all[key]==='object'?all[key]:{};
  all[key]={...was,...patch,at:now};
  const keys=Object.keys(all);
  if(keys.length>VIEW_LIMIT)for(const k of keys.sort((a,b)=>(all[a].at||0)-(all[b].at||0)).slice(0,keys.length-VIEW_LIMIT))if(k!==key)delete all[k];
  try{store(storage)?.setItem(VIEW_STORE,JSON.stringify(all));}catch{}
  return all[key];
}
// A group is folded unless the view says it is open.
export const isFolded=(groups,g)=>groups?.[g]!==false;
// The scroll to put back after a rebuild: the live one when it is the same chapter, else the stored one.
export function scrollToKeep({sameChapter,live,stored}){return sameChapter&&live?{left:live.left,top:live.top}:{left:stored?.left||0,top:stored?.top||0};}
// Whether an element's box [a, b] lies wholly inside the visible box [lo, hi] (px, any axis): then nothing needs to scroll
// to show it (a click on a key must not move the timeline).
// After a rebuild the scroll is put back; when it did not take (the lanes are not as tall yet, so the browser clamped it)
// the wanted scroll is held for a moment and put back again each frame (21 Nov 2026, Windows: 54 -> 0 after an edit).
// Vertical only: a horizontal clamp is real after a zoom out, and the zoom then sets its own scrollLeft.
// want {left, top}; got {left, top} = what the viewport shows after setting it. Returns the hold {top, until}, or null.
export const SCROLL_HOLD_MS=1500;
export function holdScroll(want,got,now,ms=SCROLL_HOLD_MS){if(!want||Math.abs((got?.top??0)-want.top)<2)return null;return {top:want.top,until:now+ms};}
// The top the timeline is meant to show (21 Nov 2026, Windows, rise: after Escape / a blur in the inspector the viewport
// read 0 with no scroll event and no write, so the next rebuild put back 0). Kept from the scroll events; an event that
// only reports a clamp (the lanes got shorter: the top at its max, below the one meant) keeps the meant top, unless the
// user is scrolling or clicking in the timeline (then whatever they did is meant).
export function nextWantTop({want,top,max,user}){if(user||want==null)return top;return top<want-1&&top>=max-1?want:top;}
// What to set the top to so it shows the meant one (as far as the lanes allow), or null when it already does.
export function reapplyTop({want,top,max}){if(want==null)return null;const t=Math.max(0,Math.min(want,max));return Math.abs(top-t)<2?null:t;}
// A rebuild reads the old viewport's top; when that looks lost (0, or clamped at its max) and differs from the meant
// one, the meant one is put back instead.
export function lostTop({top,max,want}){return want!=null&&Math.abs(top-want)>=2&&(top<1||top>=max-1);}
export const inView=(a,b,lo,hi,slack=1)=>a>=lo-slack&&b<=hi+slack;
