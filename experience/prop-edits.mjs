// Director prop edits: per-chapter changes to the room's props (move, turn, scale, hide). They live in the cut
// shot as shot.propEdits, in the film's own sceneEdits format (tools/experience/film-edits.mjs), and reach the
// live stage, Render still and the film as the chapter's sceneEdits: the film's hand-made edits first, then these,
// marked director:true.
//   {match:'^<object name>$', asset?:'<Studio scene asset key>', path?:'<regex on the full path>', near?:[x, z, r],
//    label?, position?:[dx,dy,dz] world metres from the film's place (space:'local': metres along the parent's axes,
//    for props riding on the desk, so they follow its lift and tilt), rotation?:[dx,dy,dz] degrees added to the
//    local Euler, scale?:[sx,sy,sz] local factors, hide?:true | false (false shows a prop the film hides)}
// shot.propEdits absent: the film shot's own director:true entries (an earlier Export cut, imported by
// build-round8-director.py) are the Director's edits. Present (even []): they replace those entries.
// Added props (the library browser, prop-library.mjs): a prop the film doesn't have, installed by film-edits.mjs
//   {add:{asset:'<assets/props id>'}, id:'<short id>', match:'^Added prop:<asset>#<id>$' (its object's name on the stage),
//    label:'<library name>', parent:'desk' | 'room', position:[x,y,z], rotation:[x,y,z] degrees, scale:[sx,sy,sz]}
//   The transform is the prop's own, in its parent's frame (not an offset): position = scene units along the parent's
//   axes from its origin (desk: the featured desk's desktop dressing, so it rides lift and tilt; room: the room's
//   asset root, or the stage when there is no room), rotation = local Euler degrees, scale = factors on the library
//   size. Delete / Reset to the film remove it.
// A desk of its own (chapters the film renders as sub-shots, the finale): desk:'<preset id>' keeps an edit to the sub-shot
//   whose desk is that model ('office'), wherever it stands in the order and each time it appears; without it the edit
//   holds for every desk of the chapter. film-edits.mjs skips an edit whose desk is not the shot's preset.
// On screen for part of the time: show:{from, to, fadeIn?, fadeOut?} in seconds: chapter seconds, or for an edit with a
//   desk, seconds after that desk's sub-shot begins (its renderRange start), so the timing follows the desk when the
//   desks are reordered. Outside from…to the prop is not drawn; fadeIn / fadeOut ramp its opacity inside the window.
// Nothing here touches Studio: "Make permanent in Studio" (scene-prop-editor.mjs) writes Studio's room state
// through the studio server, only when Vico confirms it.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const r4=v=>Math.round(v*1e4)/1e4;
const vec=(v,ok=()=>true)=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n)&&Math.abs(n)<10000&&ok(n))?v.map(r4):undefined;
const text=(v,n)=>typeof v==='string'&&v.length<=n?v:undefined;
export const escapeRegex=s=>String(s).replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&');
const validRegex=s=>{try{new RegExp(s,'i');return true;}catch{return false;}};
// No change at all (back where the film puts it).
const zero=v=>!v||v.every(n=>Math.abs(n)<1e-4),one=v=>!v||v.every(n=>Math.abs(n-1)<1e-4);
export const isNoop=e=>zero(e.position)&&zero(e.rotation)&&one(e.scale)&&e.hide===undefined&&!e.show;
const ASSET=/^[a-z0-9][a-z0-9._-]{0,119}$/i,ADD_ID=/^[a-z0-9]{1,16}$/i,DESK=/^[a-z0-9-]{1,40}$/;
const r2=v=>Math.round(v*100)/100;
// {from, to, fadeIn?, fadeOut?}: 0 <= from < to, at least 0.1 s long, fades no longer than the window.
export function cleanShow(v){
  if(!v||typeof v!=='object'||!finite(v.from)||!finite(v.to))return undefined;
  const from=Math.max(0,r2(v.from)),to=Math.min(100000,r2(v.to));if(!(to-from>=.1-1e-9))return undefined;
  const out={from,to},fade=x=>finite(x)&&x>0?Math.min(r2(x),r2(to-from)):0,a=fade(v.fadeIn),b=fade(v.fadeOut);
  if(a>0)out.fadeIn=a;if(b>0)out.fadeOut=b;return out;
}
const cleanDesk=v=>typeof v==='string'&&DESK.test(v)?v:undefined;
// Opacity (0…1) of a timed prop at `seconds` (film-edits.mjs draws with the same rule); 1 without a window.
export function showFactor(show,seconds){
  if(!show)return 1;if(seconds<show.from-1e-6||seconds>show.to+1e-6)return 0;
  let f=1;if(show.fadeIn>0)f=Math.min(f,(seconds-show.from)/show.fadeIn);if(show.fadeOut>0)f=Math.min(f,(show.to-seconds)/show.fadeOut);
  return Math.max(0,Math.min(1,f));
}
export const isAddEdit=e=>!!e?.add;
export const addName=(asset,id)=>`Added prop:${asset}#${id}`;
export const addMatch=(asset,id)=>'^'+escapeRegex(addName(asset,id))+'$';
export const newAddId=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-3);
export function cleanAddEdit(e){
  const asset=typeof e?.add==='string'?e.add:e?.add?.asset;if(typeof asset!=='string'||!ASSET.test(asset)||typeof e.id!=='string'||!ADD_ID.test(e.id))return null;
  const out={add:{asset},id:e.id,match:addMatch(asset,e.id)},label=text(e.label,120);if(label)out.label=label;
  out.parent=e.parent==='desk'?'desk':'room';
  out.position=vec(e.position)||[0,0,0];out.rotation=vec(e.rotation)||[0,0,0];
  out.scale=Array.isArray(e.scale)?vec(e.scale,n=>n>=.001&&n<=1000)||[1,1,1]:finite(e.scale)&&e.scale>=.001&&e.scale<=1000?[e.scale,e.scale,e.scale].map(r4):[1,1,1];
  const desk=cleanDesk(e.desk),show=cleanShow(e.show);if(desk)out.desk=desk;if(show)out.show=show;
  return out;
}
export function cleanPropEdit(e){
  if(isAddEdit(e))return cleanAddEdit(e);
  const match=text(e?.match,300);if(match===undefined||!validRegex(match))return null;
  const out={match},path=text(e.path,400),asset=text(e.asset,200),label=text(e.label,120);
  if(asset)out.asset=asset;if(path&&validRegex(path))out.path=path;
  const near=vec(e.near);if(near&&near[2]>0)out.near=near;
  if(label)out.label=label;
  const position=vec(e.position),rotation=vec(e.rotation),scale=Array.isArray(e.scale)?vec(e.scale,n=>n>=.001&&n<=1000):finite(e.scale)&&e.scale>=.001&&e.scale<=1000?[e.scale,e.scale,e.scale].map(r4):undefined;
  if(!zero(position)){if(e.space==='local')out.space='local';out.position=position;}if(!zero(rotation))out.rotation=rotation;if(!one(scale))out.scale=scale;
  if(typeof e.hide==='boolean')out.hide=e.hide;
  const desk=cleanDesk(e.desk),show=cleanShow(e.show);if(desk)out.desk=desk;if(show)out.show=show;
  return isNoop(out)?null:out;
}
// One target = one prop: the same match / asset / path / near, and for a prop of one desk (finale) that desk.
export const propKey=e=>JSON.stringify([e.match||'',e.asset||'',e.path||'',e.near||null,...(cleanDesk(e.desk)?[e.desk]:[])]);
// The fields that name a prop (what a selection, a layer row or a new edit starts from).
export const propTarget=e=>({match:e.match,...(e.asset?{asset:e.asset}:{}),...(e.path?{path:e.path}:{}),...(e.near?{near:e.near}:{}),...(cleanDesk(e.desk)?{desk:e.desk}:{}),label:e.label||''});
export function cleanPropEdits(v={}){
  if(!Array.isArray(v.propEdits))return {};
  const by=new Map();for(const e of v.propEdits.slice(0,300).map(cleanPropEdit))if(e)by.set(propKey(e),e);
  return {propEdits:[...by.values()]};
}
// The film's earlier-exported Director entries, as prop edits.
export function filmPropEdits(film){return (film?.sceneEdits||[]).filter(e=>e?.director).map(cleanPropEdit).filter(Boolean);}
export function effectivePropEdits(film,shot){return shot?.propEdits?structuredClone(shot.propEdits):filmPropEdits(film);}
// The chapter's sceneEdits for the stage: the film's hand-made ones, then the Director's ({} = the film's as they are).
export function mergePropEdits(film,shot){
  if(!Array.isArray(shot?.propEdits))return {};
  return {sceneEdits:[...structuredClone((film?.sceneEdits||[]).filter(e=>!e?.director)),...shot.propEdits.map(e=>({...structuredClone(e),director:true}))]};
}
// Readable names: 'Prop:steelcase-leap-v2' -> 'Steelcase leap v2', 'Oak study chair · lichen' stays.
export function propName(name){
  const added=/^Added prop:([^#]*)#/.exec(String(name||''));if(added)return propName(added[1]);
  const n=String(name||'').replace(/^(Prop|Accessory):/,'').replace(/^(kenney-furniture-|ergoflex-|quaternius-|kenney-|atelier-)/,'');
  const clean=/[A-Z ·]/.test(n)&&!/^[a-z0-9-]+$/.test(n)?n:n.replace(/[-_]+/g,' ');
  return clean?clean[0].toUpperCase()+clean.slice(1):'Prop';
}
const len=v=>Math.hypot(...v),deg=v=>Number(v.toFixed(1)),m=v=>Number(v.toFixed(2));
// "on screen 2–6.5 s after its desk comes in, fades in 0.4 s".
export function describeShow(e){
  const s=e.show;if(!s)return '';
  return `on screen ${m(s.from)}–${m(s.to)} s${e.desk?' after its desk comes in':''}${s.fadeIn?`, fades in ${m(s.fadeIn)} s`:''}${s.fadeOut?`, fades out ${m(s.fadeOut)} s`:''}`;
}
// "moved 0.32 m (x +0.20, z −0.25), turned 15° about y, scaled ×1.2, hidden".
export function describePropEdit(e){
  if(isAddEdit(e)){const s=e.scale||[1,1,1],k=Math.abs(s[0]-s[1])<1e-4&&Math.abs(s[1]-s[2])<1e-4?s[0]:null;return `added ${e.parent==='desk'?'on the desk':'to the room'}${k!==null&&Math.abs(k-1)>1e-4?`, scaled ×${Number(k.toFixed(3))}`:k===null?`, scaled ×${s.map(n=>Number(n.toFixed(3))).join(' / ')} (x / y / z)`:''}${e.show?', '+describeShow(e):''}`;}
  const parts=[],axes=v=>v.map((n,i)=>Math.abs(n)<5e-4?'':`${'xyz'[i]} ${n>0?'+':'−'}${m(Math.abs(n))}`).filter(Boolean).join(', ');
  if(e.position)parts.push(`moved ${m(len(e.position))} m${e.space==='local'?' on the desk':''} (${axes(e.position)})`);
  if(e.rotation){const r=e.rotation.map((n,i)=>Math.abs(n)<.05?'':`${deg(n)}° about ${'xyz'[i]}`).filter(Boolean);parts.push('turned '+r.join(', '));}
  if(e.scale){const [x,y,z]=e.scale;parts.push(Math.abs(x-y)<1e-4&&Math.abs(y-z)<1e-4?`scaled ×${Number(x.toFixed(3))}`:`scaled ×${e.scale.map(n=>Number(n.toFixed(3))).join(' / ')} (x / y / z)`);}
  if(e.hide===true)parts.push('hidden');if(e.hide===false)parts.push('shown (the film hides it)');
  if(e.show)parts.push(describeShow(e));
  return parts.join(', ')||'no change';
}
// Studio's room state key for a chapter's room (studio.js sceneAssetState: room:layout for measured rooms).
export const studioSceneIds=shot=>[...(shot?.layout?[`${shot.room}:${shot.layout}`]:[]),shot?.room].filter(Boolean);
// Make permanent: write the confirmed props into Studio's 'ergoflex.sceneAssets.v1' value (plain JSON, per room).
//   changes: [{editorId, transform:{p,q,s}} | {editorId, remove:true} | {editorId, add:{propId, position}, transform}]
//   add: a new Studio item, as Studio's own library Add writes it (studio.js addSceneAsset: added + its transform).
export function writeSceneAssets(raw,sceneId,changes){
  let all={};try{all=raw?JSON.parse(raw):{};}catch{throw Error('Studio\'s room state could not be read.');}
  if(!all||typeof all!=='object'||Array.isArray(all))all={};
  const room=all[sceneId]&&typeof all[sceneId]==='object'?all[sceneId]:{},removed=new Set(room.removed||[]),added=[...(room.added||[])],transforms={...(room.transforms||{})};
  for(const c of changes){
    if(typeof c?.editorId!=='string'||!c.editorId.startsWith('scene:'))continue;
    if(c.add){if(typeof c.add.propId!=='string'||added.some(a=>a?.editorId===c.editorId))continue;added.push({editorId:c.editorId,propId:c.add.propId,position:c.add.position||[0,0,0]});if(c.transform)transforms[c.editorId]=c.transform;continue;}
    if(c.remove){const i=added.findIndex(a=>a?.editorId===c.editorId);if(i>=0){added.splice(i,1);delete transforms[c.editorId];}else removed.add(c.editorId);continue;}
    if(c.transform)transforms[c.editorId]=c.transform;
  }
  all[sceneId]={...room,removed:[...removed],added,transforms};
  return JSON.stringify(all);
}
