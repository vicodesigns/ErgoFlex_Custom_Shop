import {exportLighting} from './film-lighting.mjs';
import {mergeSceneLights} from './light-edits.mjs';
import {mergePropEdits} from './prop-edits.mjs';
import {mergeBranding} from './branding-edits.mjs';
import {mergeDeskEdits} from './desk-edits.mjs';
import {mergeFeaturedBuild} from './desk-build.mjs';
// Film chapter switching: a chapter link carries #cut=…&film=<chapter list>&director=1.
export function filmLink(hash){
  const params=new URLSearchParams(String(hash||'').replace(/^#/,'')),film=params.get('film');
  return film?{film,director:params.get('director')==='1'}:null;
}
// Pages resolve against the list's own URL and must stay on this server.
export function cleanFilmChapters(value,base){
  if(!Array.isArray(value?.chapters))throw Error('The film chapter list has no chapters.');
  const origin=new URL(base).origin;
  const chapters=value.chapters.slice(0,200).flatMap((c,i)=>{
    if(typeof c?.page!=='string'||typeof c.id!=='string'||!c.id)return [];
    let url;try{url=new URL(c.page,base);}catch{return [];}
    if(url.origin!==origin)return [];
    const seconds=Number(c.seconds);let shot=null;try{if(typeof c.shot==='string'){const u=new URL(c.shot,base);if(u.origin===origin)shot=u.href;}}catch{}
    return [{shot,n:Number.isInteger(c.n)?c.n:i+1,id:c.id.slice(0,80),title:typeof c.title==='string'?c.title.slice(0,140):'',seconds:typeof c.seconds!=='boolean'&&c.seconds!=null&&Number.isFinite(seconds)?seconds:null,url:url.href,version:typeof c.version==='string'?c.version.slice(0,40):'',updated:typeof c.updated==='string'?c.updated.slice(0,40):''}];
  });
  if(!chapters.length)throw Error('The film chapter list has no chapters.');
  return chapters;
}
export const filmChapterLabel=c=>`${c.n} · ${c.id}${c.seconds==null?'':` (${c.seconds} s)`}`;
export function filmChapterIndex(chapters,shotIds){return chapters?.findIndex(c=>shotIds.includes(c.id))??-1;}
export async function loadFilmChapters(film,base=location.href,fetcher=globalThis.fetch){
  const url=new URL(film,base);if(url.origin!==new URL(base).origin)throw Error('The film chapter list must come from this server.');
  const response=await fetcher(url.href,{cache:'no-store'});if(!response.ok)throw Error(`Film chapter list unavailable (${response.status}).`);
  return cleanFilmChapters(await response.json(),url.href);
}
// The full built film shot for a chapter (what the renderer gets): its film-only setup
// (sceneEdits, accessories, screens, lights, LED fields…) dresses the Director's live stage.
export async function loadFilmShot(url,id,fetcher=globalThis.fetch){
  const response=await fetcher(url,{cache:'no-store'});if(!response.ok)throw Error(`Film shot unavailable (${response.status}).`);
  const value=await response.json(),shot=Array.isArray(value?.shots)?value.shots.find(s=>s.id===id):value;
  if(!shot||typeof shot!=='object'||shot.id!==id)throw Error('The film shot does not match chapter '+id+'.');
  return shot;
}
// Live preview: the film setup with the Director's story edits; GPU quality passes stay off.
export function liveFilmShot(film,shot){
  const next={...film,id:shot.id,seconds:shot.seconds},lit=exportLighting(shot);if(shot.motion)next.motion=shot.motion;delete next.quality;
  // Lighting edited in the Director (ledStatus present) replaces the film's.
  if(lit.ledStatus){next.ledStatus=lit.ledStatus;if(lit.ledNeutral)next.ledNeutral=lit.ledNeutral;else delete next.ledNeutral;if(lit.ledColor)next.ledColor=lit.ledColor;}
  if(lit.sceneGlobals)next.sceneGlobals={...next.sceneGlobals,...lit.sceneGlobals};
  if(lit.timeOfDay)next.timeOfDay=lit.timeOfDay;
  delete next.lights;Object.assign(next,mergeSceneLights(film,shot),mergePropEdits(film,shot),mergeBranding(film,shot),mergeDeskEdits(film,shot),mergeFeaturedBuild(film,shot));
  return next;
}
