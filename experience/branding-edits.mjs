// Director branding edits: the school / college / library stickers and logos on the room's desks, tuned once per
// chapter and applied to EVERY desk of that room (branding is the same on all of them).
//   shot.brandingEdits = {room:'<room key: library | occmedialab | highschool …>',
//                         artwork:{version:1, surfaces:{<surface the graphic starts on>:{<layer key: logo, logo-2 …>:
//                           {name, surface?, enabled?, x?, y?, scale?, rotation?}}}}}
// It is a sparse overlay on each desk's own artwork (artwork-config.mjs, the studio's design format, without the
// images): a desk's layer is found by its surface + layer key and its name (the graphic), and only the fields
// present here change. x / y are percent of the surface (the studio's coordinates), scale is the graphic's width as
// a percent of the surface width, rotation degrees; surface moves the graphic to another desk surface; enabled
// shows / hides it. Desks that don't have the graphic are left alone.
// shot.brandingEdits absent: the film shot's own sceneBranding (an earlier Export cut, imported by
// tools/experience/build-round8-director.py) is the Director's edit. Present (even with no layers): it replaces it.
// The film shot carries it as shot.sceneBranding (same shape); film-fx installs it (branding-live.mjs).
import {ARTWORK_SURFACES,ARTWORK_MAX_LAYERS_PER_KIND,artworkLayerKind,artworkLayers,cleanArtwork} from '../artwork-config.mjs';

const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const SURFACE_IDS=new Set(ARTWORK_SURFACES.map(s=>s.id));
export const surfaceLabel=id=>ARTWORK_SURFACES.find(s=>s.id===id)?.label||id;
export const SCHOOL_ROOMS=['library','occmedialab','kindergarten','elementary','middleschool','highschool','university','college'];
export const isSchoolRoom=room=>SCHOOL_ROOMS.includes(room);
const RANGES={x:[-100,200],y:[-100,200],scale:[5,300],rotation:[-180,180]};
const r2=v=>Math.round(v*100)/100;
export const EDIT_FIELDS=['surface','enabled','x','y','scale','rotation'];

export function cleanBrandingLayer(e){
  if(!plain(e))return null;
  const out={};
  if(typeof e.name==='string'&&e.name.length<=160)out.name=e.name;
  if(typeof e.surface==='string'&&SURFACE_IDS.has(e.surface))out.surface=e.surface;
  if(typeof e.enabled==='boolean')out.enabled=e.enabled;
  for(const [k,[lo,hi]] of Object.entries(RANGES))if(Number.isFinite(e[k]))out[k]=r2(Math.min(hi,Math.max(lo,e[k])));
  return EDIT_FIELDS.some(k=>out[k]!==undefined)?out:null;
}
// {room, artwork} or null. A present, empty overlay is kept (it clears an earlier import).
export function cleanBranding(v){
  if(!plain(v)||typeof v.room!=='string'||!/^[a-z0-9-]{1,40}$/.test(v.room))return null;
  const surfaces={};let n=0;
  for(const [sid,layers] of Object.entries(plain(v.artwork?.surfaces)?v.artwork.surfaces:{})){
    if(!SURFACE_IDS.has(sid)||!plain(layers))continue;
    for(const [key,e] of Object.entries(layers)){
      if(!artworkLayerKind(key)||n>=64)continue;
      const c=cleanBrandingLayer(e);if(!c)continue;
      (surfaces[sid]||={})[key]=c;n++;
    }
  }
  return {room:v.room,artwork:{version:1,surfaces}};
}
export function cleanBrandingEdits(v={}){
  if(!('brandingEdits' in v))return {};
  const c=cleanBranding(v.brandingEdits);
  return c?{brandingEdits:c}:{};
}
export const brandingCount=b=>Object.values(b?.artwork?.surfaces||{}).reduce((n,l)=>n+Object.keys(l).length,0);
// The Director's edit for a chapter: the shot's own, else the film's earlier-exported (imported) one.
export function effectiveBranding(film,shot){
  const b=shot?.brandingEdits!==undefined?shot.brandingEdits:film?.sceneBranding;
  return b?structuredClone(b):null;
}
// The film shot's fields for the chapter ({} = the film's as they are).
export function mergeBranding(film,shot){
  if(!shot?.brandingEdits)return {};
  return {sceneBranding:structuredClone(shot.brandingEdits)};
}
const sameGraphic=(layer,e)=>!e.name||!layer.name||e.name===layer.name;
// A desk's artwork with the overlay applied. Moves happen after all in-place edits, into the first free slot of the
// layer's kind on the target surface (a full surface keeps the graphic where it was).
export function applyBranding(artwork,branding){
  const out=cleanArtwork(artwork);
  const edits=branding?.artwork?.surfaces;if(!plain(edits))return out;
  const moves=[];
  for(const [sid,layers] of Object.entries(edits)){
    const surface=out.surfaces[sid];if(!surface)continue;
    for(const [key,e] of Object.entries(layers)){
      const layer=surface[key];if(!layer||!sameGraphic(layer,e))continue;
      for(const k of ['enabled','x','y','scale','rotation'])if(e[k]!==undefined)layer[k]=e[k];
      if(e.surface&&e.surface!==sid)moves.push([sid,key,e.surface]);
    }
  }
  for(const [sid,key,to] of moves){
    const kind=artworkLayerKind(key),layer=out.surfaces[sid][key],target=out.surfaces[to]||={};
    const slot=Array.from({length:ARTWORK_MAX_LAYERS_PER_KIND},(_,i)=>i?`${kind}-${i+1}`:kind).find(k=>!target[k]);
    if(!slot){if(!Object.keys(target).length)delete out.surfaces[to];continue;}
    target[slot]=layer;delete out.surfaces[sid][key];
    if(!Object.keys(out.surfaces[sid]).length)delete out.surfaces[sid];
  }
  return out;
}
// Every graphic on an artwork, in the studio's order: [{id:'<surface>|<key>', surface, key, layer}].
export function brandingElements(artwork){
  const art=cleanArtwork(artwork),out=[];
  for(const {id} of ARTWORK_SURFACES)for(const [key,layer] of artworkLayers(art.surfaces[id]))out.push({id:`${id}|${key}`,surface:id,key,layer});
  return out;
}
// The overlay with one graphic's edit replaced ({} fields = back to the desk's own: the entry goes). `base` is the
// desk's own layer, so a field equal to it is not an edit.
export function setBrandingEdit(branding,room,surface,key,base,fields){
  const next=branding?.room===room?structuredClone(branding):{room,artwork:{version:1,surfaces:{}}};
  const layers=next.artwork.surfaces[surface]||={},was=layers[key]||{};
  const merged={...was,...fields};
  const entry={name:base.name};
  for(const k of EDIT_FIELDS){
    const v=merged[k];if(v===undefined)continue;
    const own=k==='surface'?surface:base[k];
    if(k==='surface'?v!==surface:typeof v==='number'?Math.abs(v-own)>.004:v!==own)entry[k]=v;
  }
  const clean=EDIT_FIELDS.some(k=>entry[k]!==undefined)?cleanBrandingLayer(entry):null;
  if(clean){layers[key]={...clean,name:base.name};}else delete layers[key];
  if(!Object.keys(layers).length)delete next.artwork.surfaces[surface];
  return cleanBranding(next);
}
