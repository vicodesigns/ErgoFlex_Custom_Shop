// Director "Build" for a room desk: the store configurator's materials, trim and accessories, per desk.
// The data lives in the cut shot as shot.deskEdits[].build (one entry per edited room desk, the entry also carries
// DeskSel's size / pose / initial and DeskChoreo's clips; this file only reads and writes `desk`, `name` and `build`):
//   build: {woodFinish?, baseFinish?, trimColor?, accessories?:[{id, slot}]}
//     woodFinish / baseFinish: catalog PRODUCT_CONFIG names; trimColor: '#rrggbb'; each absent = the room's own.
//     accessories: the desk's COMPLETE accessory set (catalog ACCESSORIES ids) and where each one goes:
//     slot 'desktop' | 'shelf' (top shelf) | 'lower-shelf' (second shelf) | 'base-shelf' (the shelf at the base).
//     Absent = the room's own accessories.
// The same module applies it at runtime to a record of the studio's scene desks (api.sceneDesks, scene-desks.mjs), the
// way the studio does for a desk that is not the live one (style: SceneDesks ctx.restyle; accessories: the desk's own
// accessory set r.peripherals, placed by scene-desk-objects.mjs register()). It never writes the studio's files or its
// storage: every change is remembered per desk and undone by restoreBuild / restoreAll. The live Director stage and
// film-fx (tools/experience/film-fx.mjs installSceneDeskBuilds) both call applyBuild, so the stage is the render.
import {PRODUCT_CONFIG,TRIM_COLORS,ACCESSORIES,PRESETS,accessory,cleanConfig} from '../catalog.mjs';
import {SHARED_BUILD_PRESETS} from '../preset-defaults.mjs';
import {cleanDeskStyle} from '../room-desk-styles.mjs';

export const SLOTS=[['desktop','Desktop'],['shelf','Top shelf'],['lower-shelf','Second shelf'],['base-shelf','Base shelf']];
export const SLOT_IDS=SLOTS.map(s=>s[0]);
export const slotLabel=slot=>SLOTS.find(s=>s[0]===slot)?.[1]||slot;

// ---- which rooms get a Build tab
// School, college and library rooms carry the school's branding (stickers and logos on every desk, one edit for all):
// they get the Branding tab instead. Scene ids are the studio's (ROOM_DESK_STYLES / institutional-scenes.mjs). In the
// film that is chapter 4 (commons: library), 5 (coast: occmedialab, the OCC media lab) and 6 (oilers: highschool).
export const BRANDING_ROOMS=['library','kindergarten','elementary','middleschool','highschool','college','university','occmedialab'];
export const isBrandingRoom=room=>BRANDING_ROOMS.includes(room);
export const hasBuildTab=room=>!!room&&room!=='product'&&!isBrandingRoom(room);

// ---- the data
const HEX=/^#[0-9a-f]{6}$/i,DESK_ID=/^[a-z][a-z0-9-]{0,79}$/;
const WOODS=PRODUCT_CONFIG.woodFinishes.map(f=>f.name),BASES=PRODUCT_CONFIG.baseFinishes.map(f=>f.name);
// The desk's accessories, each once, only real catalog ones in a real slot; a repeated or unknown id is dropped (the
// last of a mutually exclusive group wins, as the configurator does: cleanConfig).
export function cleanBuildAccessories(list){
  if(!Array.isArray(list))return undefined;
  const seen=new Map();for(const a of list.slice(0,60)){const id=typeof a==='string'?a:a?.id;if(!accessory(id)||seen.has(id))continue;
    const slot=typeof a==='object'&&SLOT_IDS.includes(a.slot)?a.slot:naturalSlot(id);seen.set(id,slot);}
  return cleanConfig({size:'60x30',accessories:[...seen.keys()]}).accessories.map(id=>({id,slot:seen.get(id)}));
}
export function cleanDeskBuild(b){
  if(!b||typeof b!=='object')return null;
  const out={};
  if(WOODS.includes(b.woodFinish))out.woodFinish=b.woodFinish;
  if(BASES.includes(b.baseFinish))out.baseFinish=b.baseFinish;
  if(typeof b.trimColor==='string'&&HEX.test(b.trimColor))out.trimColor=b.trimColor.toLowerCase();
  const acc=cleanBuildAccessories(b.accessories);if(acc)out.accessories=acc;
  return Object.keys(out).length?out:null;
}
// The featured desk's build lives on the shot itself: shot.deskBuild (same fields as a room desk's build). Absent: the film
// shot's own featuredBuild (an earlier Export cut, imported by build-round8-director.py as director-camera 'build'). Present
// (even {}): replaces it. Film layers carry it as featuredBuild (film-fx installFeaturedBuild).
export const cleanDeskBuildField=v=>v&&typeof v.deskBuild==='object'&&v.deskBuild?{deskBuild:cleanDeskBuild(v.deskBuild)||{}}:{};
export const filmFeaturedBuild=film=>cleanDeskBuild(film?.featuredBuild);
export const effectiveFeaturedBuild=(film,shot)=>shot?.deskBuild&&typeof shot.deskBuild==='object'?cleanDeskBuild(shot.deskBuild):filmFeaturedBuild(film);
// A chapter the film renders as sub-shots (hero: one desk per sub-shot) has no chapter-wide build: each desk version carries
// its own (sub-shot featuredBuild, desk-versions-edit.mjs), so shot.deskBuild is not applied there.
export const mergeFeaturedBuild=(film,shot)=>{if(film?.subshot||film?.subshots)return {};if(!shot?.deskBuild||typeof shot.deskBuild!=='object')return {};const b=cleanDeskBuild(shot.deskBuild);return b?{featuredBuild:b}:{featuredBuild:undefined};};
export const buildOf=(shot,desk)=>shot?.deskEdits?.find(e=>e.desk===desk)?.build||null;
// shot.deskEdits with this desk's build replaced (null: removed; an entry left with nothing else goes too).
export function withDeskBuild(list,desk,name,build){
  const next=(Array.isArray(list)?list:[]).filter(e=>e.desk!==desk),old=(Array.isArray(list)?list:[]).find(e=>e.desk===desk)||{desk};
  const entry={...structuredClone(old),desk};if(name)entry.name=name;
  if(build)entry.build=build;else delete entry.build;
  const bare=Object.keys(entry).every(k=>['desk','name'].includes(k));
  if(!bare)next.push(entry);
  return next.sort((a,b)=>a.desk.localeCompare(b.desk));
}

// ---- catalog views for the panel
export const woodSwatches=()=>PRODUCT_CONFIG.woodFinishes.map(f=>({name:f.name,color:f.color}));
export const baseSwatches=()=>PRODUCT_CONFIG.baseFinishes.map(f=>({name:f.name,color:f.color}));
export const trimSwatches=()=>TRIM_COLORS.map(t=>({name:t.name,color:t.value}));
export const catalogAccessories=()=>ACCESSORIES.filter(a=>a.visual);
// The build presets of the store (catalog PRESETS, preset-defaults.mjs wins as in applyPreset).
export function presetBuilds(){
  return PRESETS.map(p=>{const c={...p,...SHARED_BUILD_PRESETS[p.id]?.config};
    return {id:p.id,name:p.name,woodFinish:c.woodFinish,baseFinish:c.baseFinish,trimColor:c.trimColor,accessories:(c.accessories||[]).filter(accessory)};});
}
export function presetBuild(id){
  const p=presetBuilds().find(x=>x.id===id);if(!p)return null;
  return cleanDeskBuild({woodFinish:p.woodFinish,baseFinish:p.baseFinish,...(p.trimColor?{trimColor:p.trimColor}:{}),accessories:p.accessories.map(a=>({id:a,slot:naturalSlot(a)}))});
}
// Where the store puts an accessory by default (workspace-3d.mjs WorkspaceAccessories.sync).
export function naturalSlot(id){
  const item=accessory(id);if(!item)return 'desktop';
  const role=item.mount||(item.visual==='footrest'?'floor':['monitor','arm','dual-arm'].includes(item.visual)?'shelf':'desktop');
  return SLOT_IDS.includes(role)?role:'desktop';
}
// Accessories that sit on the floor or hang under the desk have no slot to choose.
export const slotless=id=>{const item=accessory(id);return !item||item.visual==='footrest'||['cable-tray','cpu-holder','led-strip','keyboard-tray','easel-rail'].includes(id);};

// ---- the stage (runtime)
const memory=api=>(api.sceneDesks.__deskBuild||=new Map());
export const FEATURED='featured';
export const roomDesks=api=>{const d=api?.sceneDesks;return d?[...d.records.values()].filter(r=>r.id!==d.selected&&!r.primary):[];};
const record=(api,id)=>api?.sceneDesks?.records.get(id)||null;
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
// The desk as it is now: finishes and accessories with the slot each one is in.
export function readDesk(api,id){
  const r=record(api,id);if(!r)return null;
  const style=cleanDeskStyle(r.state.style)||cleanDeskStyle(api.sceneDesks.ctx.readLive(r).style);
  const ids=cleanBuildAccessories((r.state.accessories||[]).map(a=>({id:a,slot:r.objects?.get('accessory-'+a)?.saved.role})))||[];
  return {id,name:r.state.name,size:r.state.size,woodFinish:style?.woodFinish,baseFinish:style?.baseFinish,trimColor:style?.trimColor,accessories:ids,loaded:!!r.peripherals};
}
// Remember what the room had, once per desk, before the first change.
function remember(api,r){
  const mem=memory(api);if(mem.has(r.id))return mem.get(r.id);
  const objects={};for(const k of Object.keys(r.state.objects||{}))if(k.startsWith('accessory-'))objects[k]=structuredClone(r.state.objects[k]);
  const o={style:structuredClone(r.state.style)||null,accessories:[...(r.state.accessories||[])],accessoryFinishes:structuredClone(r.state.accessoryFinishes||{}),objects,renderedStyle:r.renderedStyle};
  mem.set(r.id,o);return o;
}
function restyle(api,r,style){
  const d=api.sceneDesks;r.state.style=style;
  if(r.id===d.selected)d.ctx.writeLive(r);else d.ctx.restyle(r);
}
// A spot on a slot's surface that is clear of the others there: spread along the width, centre first.
export function spot(r,slot,index){
  const size=r.rig.mounts[slot]?.userData.surfaceSize,w=size?.width||1100,steps=[0,-.3,.3,-.15,.15,-.42,.42];
  return {p:{x:Math.round(w*steps[index%steps.length]),y:0,z:0},q:{x:0,y:0,z:0,w:1},s:{x:1,y:1,z:1}};
}
async function settle(r,set){
  await Promise.all([set.ready,r.rig?.artworkReady].filter(Boolean)).catch(()=>{});
  for(let i=0;i<2;i++)await nextFrame();
}
// Put the desk on `build` (the room's own where a field is absent). Idempotent: the same call twice is one state.
export async function applyBuild(api,id,build){
  const r=record(api,id);if(!r)throw Error('No room desk '+id);
  build=cleanDeskBuild(build)||{};
  const d=api.sceneDesks;if(!r.rig)d.ensureRig(r);
  const orig=remember(api,r);
  const base=cleanDeskStyle(orig.style)||cleanDeskStyle(r.state.style)||cleanDeskStyle(d.ctx.readLive(r).style);
  if(base){
    const style=cleanDeskStyle({...base,...(build.woodFinish?{woodFinish:build.woodFinish}:{}),...(build.baseFinish?{baseFinish:build.baseFinish}:{}),...(build.trimColor?{trimColor:build.trimColor}:{})});
    if(style&&JSON.stringify(style)!==JSON.stringify(r.state.style))restyle(api,r,style);
  }
  const set=r.peripherals;
  if(!set){return {desk:id,style:true,accessories:false};}
  const want=build.accessories?build.accessories:null;
  const ids=want?want.map(a=>a.id):orig.accessories;
  const config=cleanConfig({...api.currentConfig,size:r.state.size,accessories:ids,accessoryFinishes:orig.accessoryFinishes});
  const kept=new Set(config.accessories);
  r.state.objects||={};
  // Placement: the room's own where the accessory is already on this desk and stays in its slot; otherwise the store's
  // layout seeds it (fixed up below) or, in another slot than its own, a free spot on that slot's surface.
  const perSlot={},desired=new Map();
  for(const aid of config.accessories){
    const key='accessory-'+aid,was=orig.objects[key],own=was?.role||naturalSlot(aid),slot=want?.find(a=>a.id===aid)?.slot||own;
    desired.set(aid,slot);
    if(slot===own){if(was)r.state.objects[key]=structuredClone(was);else delete r.state.objects[key];continue;}
    perSlot[slot]=perSlot[slot]||0;
    r.state.objects[key]={...(was?structuredClone(was):{}),role:slot,added:false,removed:false,label:was?.label||accessory(aid).name,transform:spot(r,slot,perSlot[slot]++)};
  }
  for(const k of Object.keys(r.state.objects))if(k.startsWith('accessory-')&&!kept.has(k.slice(10)))delete r.state.objects[k];
  r.state.accessories=config.accessories;
  set.sync(config);
  await settle(r,set);
  // An accessory the room did not have comes in as the studio's default (role desktop, the store layout's position for
  // its own mount): put it on its real mount at that position.
  const objects=d.objects;let again=false;
  for(const aid of config.accessories){
    const key='accessory-'+aid,item=r.objects?.get(key),slot=desired.get(aid);
    if(!item||item.saved.role===slot)continue;
    item.saved.role=slot;item.saved.removed=false;objects.register(r,key,item.obj,item.saved,item.baseScale);again=true;
  }
  if(again){await nextFrame();d.sync?.();}
  return {desk:id,style:true,accessories:true};
}
// Back to the room's own build for this desk.
export async function restoreBuild(api,id){
  const r=record(api,id),mem=api?.sceneDesks?.__deskBuild,orig=mem?.get(id);if(!r||!orig)return false;
  mem.delete(id);
  if(orig.style)restyle(api,r,orig.style);
  r.state.accessories=[...orig.accessories];
  for(const k of Object.keys(r.state.objects||{}))if(k.startsWith('accessory-'))delete r.state.objects[k];
  Object.assign(r.state.objects,structuredClone(orig.objects));
  if(r.peripherals){r.peripherals.sync(cleanConfig({...api.currentConfig,size:r.state.size,accessories:orig.accessories,accessoryFinishes:orig.accessoryFinishes}));await settle(r,r.peripherals);}
  return true;
}
export const restoreAll=async api=>{for(const id of [...(api?.sceneDesks?.__deskBuild?.keys()||[])])await restoreBuild(api,id);};

// film-fx and the live stage: every deskEdits entry with a build, now; restore() undoes them all (and is safe to call
// without waiting). `previous` (an earlier install's handle) is updated in place: its desks that are no longer edited
// go back to the room's build, the others are re-applied from the room's build (one sync each, nothing flickers).
export async function installDeskBuilds(api,list,previous=null){
  const done=[],missing=[],wanted=new Set((list||[]).filter(e=>cleanDeskBuild(e?.build)).map(e=>e.desk));
  for(const id of previous?.desks||[])if(!wanted.has(id))await restoreBuild(api,id);
  for(const e of list||[]){
    const build=cleanDeskBuild(e?.build);if(!build)continue;
    if(!record(api,e.desk)){missing.push(e.desk);continue;}
    await applyBuild(api,e.desk,build);done.push(e.desk);
  }
  if(missing.length)console.warn('[desk-build] no room desk '+missing.join(', '));
  return {desks:done,missing,restore(){const ids=[...done];done.length=0;return Promise.all(ids.map(id=>restoreBuild(api,id)));}};
}
