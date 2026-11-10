// Director people edits: who is in a film chapter. They live in the cut shot as shot.peopleEdits and reach the live
// stage, Render still and the film as the chapter's `people` (room-people.mjs filter).
//   shot.peopleEdits = {
//     cast: [ { key, id, hide?,                              one person: a name for this placement, the library model
//               desk: 'sit' | 'stand' | 'wheel', station?,   at the film desk (follows it; shown while its height suits
//               reach?,                                      the model), or at one of the room's other desks
//               beside: [dx, dz],                            or near the film desk, in its frame
//               at: [x, z], turn, y,                         or at a spot: room millimetres, degrees, lift in mm
//               scale,                                       size factor (1 = as built)
//               colors: { top, bottom, shoes, hair } } ],    '#rrggbb' for those parts of the model (absent: as built)
//     when: { '<key>': [[t0, t1, fadeIn?, fadeOut?], ...] }, the seconds of the chapter that person is there (absent: all of it)
//     chair: { back, side, turn }, fade                      as in the film's people filter
//   }
// shot.peopleEdits absent: the chapter's cast is the film's (film.people). Present: it is the whole cast, the room's
// own people included as plain entries (the People tab copies them in on the first edit), so a later change to a
// room's standing cast never changes a chapter Vico has arranged.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const r1=v=>Math.round(v*10)/10,r3=v=>Math.round(v*1000)/1000;
const KEY=/^[a-z0-9][a-z0-9_-]{0,47}$/i,MODEL=/^people-[a-z0-9][a-z0-9._-]{0,90}$/i,STATION=/^[a-z0-9][a-z0-9_-]{0,60}$/i;
export const PARTS=['top','bottom','shoes','hair'];
const pair=(v,max)=>Array.isArray(v)&&v.length===2&&v.every(n=>finite(n)&&Math.abs(n)<=max)?v.map(n=>Math.round(n)):undefined;
export function cleanPerson(e){
  if(!e||typeof e!=='object'||typeof e.id!=='string'||!MODEL.test(e.id))return null;
  const key=typeof e.key==='string'&&KEY.test(e.key)?e.key:e.id.slice(0,48),out={key,id:e.id};
  if(e.hide===true)out.hide=true;
  if(['sit','stand','wheel'].includes(e.desk)){out.desk=e.desk;if(typeof e.station==='string'&&STATION.test(e.station))out.station=e.station;if(finite(e.reach)&&e.reach>=0&&e.reach<=3000)out.reach=Math.round(e.reach);}
  else{
    const at=pair(e.at,100000),beside=pair(e.beside,20000);
    if(at){out.at=at;out.turn=finite(e.turn)?r1(((e.turn+180)%360+360)%360-180):0;if(finite(e.y)&&Math.abs(e.y)<=5000&&Math.abs(e.y)>=.5)out.y=Math.round(e.y);}
    else if(beside)out.beside=beside;
    else return null;
  }
  if(finite(e.scale)&&e.scale>=.2&&e.scale<=3&&Math.abs(e.scale-1)>1e-3)out.scale=r3(e.scale);
  const colors={};for(const part of PARTS)if(typeof e.colors?.[part]==='string'&&/^#[0-9a-f]{6}$/i.test(e.colors[part]))colors[part]=e.colors[part].toLowerCase();
  if(Object.keys(colors).length)out.colors=colors;
  return out;
}
export function cleanSpans(v,seconds=Infinity){
  if(!Array.isArray(v))return null;
  const spans=v.slice(0,8).flatMap(s=>{
    if(!Array.isArray(s)||!finite(s[0])||!finite(s[1]))return [];
    const t0=Math.max(0,Math.min(s[0],seconds)),t1=Math.max(t0,s[1]);if(t1-t0<.01)return [];
    const span=[r3(t0),r3(t1)];if(finite(s[2])||finite(s[3]))span.push(r3(Math.max(0,Math.min(5,finite(s[2])?s[2]:.5))),r3(Math.max(0,Math.min(5,finite(s[3])?s[3]:.5))));
    return [span];
  });
  return spans.length?spans:null;
}
export function cleanPeople(v){
  if(!v||typeof v!=='object'||!Array.isArray(v.cast))return null;
  const cast=[],seen=new Set();
  for(const raw of v.cast.slice(0,80)){const p=cleanPerson(raw);if(!p)continue;let key=p.key,n=2;while(seen.has(key))key=(p.key.slice(0,44)+'-'+n++);p.key=key;seen.add(key);cast.push(p);}
  const out={cast},when={};
  for(const [key,spans] of Object.entries(v.when&&typeof v.when==='object'?v.when:{})){const s=seen.has(key)&&cleanSpans(spans);if(s)when[key]=s;}
  if(Object.keys(when).length)out.when=when;
  const c=v.chair;if(c&&typeof c==='object'&&[c.back,c.side,c.turn].some(finite))out.chair={back:finite(c.back)?Math.round(c.back):620,side:finite(c.side)?Math.round(c.side):0,turn:finite(c.turn)?r1(c.turn):0};
  if(finite(v.fade)&&v.fade>=0&&v.fade<=5)out.fade=r3(v.fade);
  return out;
}
// The cut field (cuts.mjs): kept only when it is a cast.
export function cleanPeopleEdits(v={}){const p=cleanPeople(v.peopleEdits);return p?{peopleEdits:p}:{};}
// The film's `people` for a chapter with Director edits: nobody of the room's own cast, the Director's cast instead.
export function peopleFilter(edits){
  const p=cleanPeople(edits);if(!p)return null;
  const cast=p.cast.filter(e=>!e.hide).map(({hide,...e})=>e),keys=new Set(cast.map(e=>e.key)),out={only:[],cast};
  const when=Object.fromEntries(Object.entries(p.when||{}).filter(([k])=>keys.has(k)));if(Object.keys(when).length)out.when=when;
  if(p.chair)out.chair=p.chair;if(p.fade!==undefined)out.fade=p.fade;
  return out;
}
// For liveFilmShot: the Director's cast over the film's.
export function mergePeople(film,shot){const f=shot?.peopleEdits&&peopleFilter(shot.peopleEdits);return f?{people:f}:{};}
// The chapter's people as the stage should show them (null: nobody asked for people).
export function effectivePeople(film,shot){return mergePeople(film,shot).people??(film?.people&&typeof film.people==='object'?film.people:film?.people?true:null);}
// A new key for one more placement of a model: the character's name, numbered when taken.
export function newKey(id,taken){
  const base=(id.replace(/^people-/,'').split('-')[0]||'person').slice(0,40);let key=base,n=2;const has=k=>taken.has?taken.has(k):taken.includes(k);
  while(has(key))key=base+'-'+n++;return key;
}
// "0–18 s" / "whole chapter" for a person's spans.
export function spanText(spans,seconds){
  if(!spans?.length)return 'whole chapter';
  const f=v=>Number(v.toFixed(v%1?1:0));
  return spans.map(([a,b])=>a<=.001&&b>=(seconds??Infinity)?'whole chapter':`${f(a)}–${f(Math.min(b,seconds??b))} s`).join(', ');
}
