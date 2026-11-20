// B2 (S33): ONE selection across the whole Director (Vico: "what is selected is highlighted and centred in every tab and
// on the timeline"). The editors keep their own state (scene-prop-editor, scene-people-editor, scene-desk-editor) and
// already clear each other; this is the one shared answer to "what is selected" ({kind:'prop'|'person'|'desk', key}),
// a change event, and the places that show it: every element that stands for the selected thing, in the inspector tabs
// and on the timeline, gets the class `b2-selected`, and on a change the timeline scrolls to centre it.
export const SELECTED_CLASS='b2-selected';
// The lane group each kind lives in (a selection opens its group when it is folded: P3).
export const GROUP_OF={camera:'motion',clip:'motion',title:'titles',graphic:'graphics',light:'lighting',lightkey:'lighting',prop:'props',person:'people'};
export const sameSelection=(a,b)=>(!a&&!b)||(!!a&&!!b&&a.kind===b.kind&&a.key===b.key);
export function createSelection(){
  let now=null;const subs=new Set();
  return {
    get:()=>now,
    is:(kind,key)=>!!now&&now.kind===kind&&now.key===String(key),
    // returns true when the selection changed (and tells the listeners)
    set(next){const n=next&&next.kind&&next.key!=null&&next.key!==''?{kind:next.kind,key:String(next.key)}:null;if(sameSelection(n,now))return false;const was=now;now=n;for(const fn of subs)fn(now,was);return true;},
    on(fn){subs.add(fn);return ()=>subs.delete(fn);},
  };
}
// What the view's Delete acts on (director.mjs viewDelete and the selection bar's Delete): the selection the Director
// shows (selectionNow: a prop before a person, as everything marks it), never an editor's leftover selection behind it.
// 18 Nov 2026: a person stayed selected under a prop picked after them, and Delete removed the person (Vico, High school:
// a seated woman's cast entry went, and she stood at the main desk). poseKey: a pose key is selected in pose mode;
// picked: timeline picks are selected (their own Delete).  -> 'pose-key' | 'person' | 'prop' | null
export function deleteRoute(sel,{poseKey=false,picked=false}={}){
  if(poseKey)return 'pose-key';
  if(picked||!sel)return null;
  return sel.kind==='person'?'person':sel.kind==='prop'?'prop':null;
}
// 20 Nov 2026 (Vico: "Delete should delete the selected key, clip or pose key; the Inspector's Delete does nothing"):
// what Delete / Backspace and the selection header's 🗑 act on, one answer for every kind. Before, most kinds were
// deleted only by a handler on the item's own button (focus is lost when the timeline re-renders after the click), and
// the 🗑 sent a synthetic key to the document that those handlers never saw.
//   poseKey: a pose key selected in pose mode; picked: timeline group picks; sheetKeys: People sheet keys picked.
//   -> 'pose-key' | 'picks' | 'sheet-keys' | 'camera' | 'clip' | 'title' | 'graphic' | 'lightkey' | 'person' | 'prop' | null
export const DELETABLE=['camera','clip','title','graphic','lightkey','person','prop'];
export function deleteTarget(sel,{poseKey=false,picked=false,sheetKeys=false}={}){
  if(poseKey)return 'pose-key';
  if(picked)return 'picks';
  if(sheetKeys)return 'sheet-keys';
  return sel&&DELETABLE.includes(sel.kind)?sel.kind:null;
}
const q=v=>String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
// Where each kind shows: Props lane bars and the Layers outliner (props), the People lane, list and keyframe sheet row
// (people), the Desks list, the timeline's "Other desks" rows and the desk lanes' header / Desk picker while they edit
// that desk (desks: director.mjs stamps data-desk-of).
export function selectionSelectors(sel){
  if(!sel)return [];const k=q(sel.key);
  if(sel.kind==='prop')return [`.prop-bar[data-prop-key="${k}"]`,`[data-ly-item="${k}"]`];
  if(sel.kind==='person')return [`[data-person-key="${k}"]`,`[data-person-keys~="${k}"]`];
  if(sel.kind==='desk')return [`.desk-row[data-section="${k}"]`,`[data-choreo-row="${k}"]`,`[data-desk-of="${k}"]`];
  // P3 (17 Nov 2026): every other kind the Director selects, where it shows on the timeline
  if(sel.kind==='camera')return [`.camera-key[data-key="${k}"]`];
  if(sel.kind==='clip')return [`[data-desk-clip="${k}"]`];
  if(sel.kind==='title')return [`[data-title-clip="${k}"]`,`[data-title-card="${k}"]`,`[data-title-id="${k}"]`];
  if(sel.kind==='graphic')return [`[data-graphic-clip="${k}"]`,`[data-graphic-index="${k}"]`,`[data-screen-index="${k}"]`];
  if(sel.kind==='light')return [`.lamp-chip[data-section="${k}"]`];
  if(sel.kind==='lightkey')return [`[data-light-key="${k}"]`,`[data-tod-key="${k}"]`,`[data-status-key="${k}"]`];
  return [];
}
// The scroll offset that centres an item [start, start+size) (relative to the view's visible start) in a view of `view`
// px now scrolled to `scroll`, clamped to 0..max. An item already fully in view keeps the scroll when `nearest`.
export function centreScroll({scroll,view,start,size,max,nearest=false}){
  if(nearest&&(start>=0&&start+size<=view||size>view&&start<view&&start+size>0))return scroll;
  const want=scroll+start+size/2-view/2;return Math.max(0,Math.min(max,Math.round(want)));
}
// Mark every element of the selection under the roots; returns them (first match first, in root order).
export function markSelection(roots,sel,cls=SELECTED_CLASS){
  const hits=[],sels=selectionSelectors(sel).join(',');
  for(const root of roots){if(!root)continue;for(const el of root.querySelectorAll('.'+cls))el.classList.remove(cls);if(sels)for(const el of root.querySelectorAll(sels)){el.classList.add(cls);hits.push(el);}}
  return hits;
}
// Centre an element in each scrolling box between it and `stop` (inclusive): vertical always centred, horizontal only
// when it is out of view (a long bar is not dragged sideways under the sticky labels).
export function centreIn(el,stop){
  if(!el||!el.isConnected||!el.getClientRects().length)return false;
  let moved=false;
  for(let a=el.parentElement;a;a=a.parentElement){
    const r=el.getBoundingClientRect(),b=a.getBoundingClientRect(),zy=a.clientHeight/(b.height||1)||1,zx=a.clientWidth/(b.width||1)||1;
    if(a.scrollHeight>a.clientHeight+1){const v=centreScroll({scroll:a.scrollTop,view:a.clientHeight,start:(r.top-b.top)*zy,size:r.height*zy,max:a.scrollHeight-a.clientHeight});if(v!==a.scrollTop){a.scrollTop=v;moved=true;}}
    if(a.scrollWidth>a.clientWidth+1){const v=centreScroll({scroll:a.scrollLeft,view:a.clientWidth,start:(r.left-b.left)*zx,size:r.width*zx,max:a.scrollWidth-a.clientWidth,nearest:true});if(v!==a.scrollLeft){a.scrollLeft=v;moved=true;}}
    if(a===stop)break;
  }
  return moved;
}
