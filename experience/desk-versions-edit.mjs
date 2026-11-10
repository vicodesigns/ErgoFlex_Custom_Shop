// Desk versions, editable (chapter 12 / hero): the order, the time and the model of each of the film's six desks.
// Pure data code, shared by the Director (browser) and tools/experience/desk-versions-apply.mjs (the importer's pass),
// so the live stage and the film resolve the same sub-shots.
//
// A version is {n, preset, name, start, end}: n is the slot's letter (A..F, always in time order), start / end its
// sub-shot's renderRange in chapter seconds, preset the desk model and name the label on the lane and the frame badge.
// The slots (renderRange widths and the crossfade overlaps between neighbours) belong to the time line; a desk is the
// bundle of fields that belong to its model: preset, kind, screens (with their clip offsets), accessories, desk
// dressing (sceneEdits that are not the shared room's), kicker light and exposure. Moving a desk to another slot moves
// its bundle; a model that has no bundle in the film yet gets its preset's defaults (model-specific dressing reset)
// while the slot keeps camera, light rig and the desk performance. The desk changes at the middle of each overlap.
export const NAMES={artist:'Artist',occ:'OCC',architect:'Architect',hbhs:'HBHS',office:'Office',gaming:'Gaming',library:'Library',music:'Music',compact:'Compact',creative:'Creative'};
export const labelOf=id=>NAMES[id]||(String(id||'Desk')[0].toUpperCase()+String(id||'Desk').slice(1));
export const MIN_SHOWN=2;                       // s a desk is shown at least
const BUNDLE=['kind','preset','lights','sceneEdits','screens','sceneGlobals','accessories'];
const DARK=new Set(['gaming','hbhs']),DARK_TOP={clearcoat:0,specularIntensity:0.05},EXPOSURE={gaming:.95,hbhs:.95,office:.85,occ:.85,architect:.70,artist:.65};
// A desk version's own build (the Build tab): finishes, trim and the complete accessory set with slots; same shape as
// desk-build.mjs cleanDeskBuild (kept here so node can use it without the catalog). Written to the sub-shot as featuredBuild.
const SLOT_IDS=['desktop','shelf','lower-shelf','base-shelf'];
export function cleanBuild(b){
  if(!b||typeof b!=='object')return null;
  const out={};
  for(const k of ['woodFinish','baseFinish'])if(typeof b[k]==='string'&&b[k]&&b[k].length<=60)out[k]=b[k];
  if(typeof b.trimColor==='string'&&/^#[0-9a-f]{6}$/i.test(b.trimColor))out.trimColor=b.trimColor.toLowerCase();
  if(Array.isArray(b.accessories)){
    const seen=new Set();
    out.accessories=b.accessories.slice(0,60).filter(a=>a&&typeof a.id==='string'&&/^[a-z0-9-]{1,60}$/.test(a.id)&&SLOT_IDS.includes(a.slot)&&!seen.has(a.id)&&seen.add(a.id)).map(a=>({id:a.id,slot:a.slot}));
  }
  return Object.keys(out).length?out:null;
}
const num=(v,lo,hi)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):null;
const r2=x=>Math.round(x*100)/100;
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));

// shot.deskVersions as the cut keeps it: [{n,preset,name,start,end}] in time order; invalid entries drop the list.
export function cleanDeskVersionList(value){
  if(!Array.isArray(value)||value.length<2||value.length>12)return null;
  const out=[];
  for(const e of value){
    if(!e||typeof e!=='object'||!/^[A-Z]$/.test(String(e.n||'')))return null;
    const preset=String(e.preset||'');if(!/^[a-z0-9-]{1,40}$/.test(preset))return null;
    const start=num(e.start,0,600),end=num(e.end,0,600);if(start===null||end===null||end<=start)return null;
    const name=String(e.name??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,40);
    const build=cleanBuild(e.build);
    out.push({n:e.n,preset,name,start:r2(start),end:r2(end),...(build?{build}:{})});
  }
  if(new Set(out.map(e=>e.n)).size!==out.length)return null;
  out.sort((a,b)=>a.start-b.start||a.n.localeCompare(b.n));
  return out;
}
export const cleanDeskVersionsField=v=>{const l=v&&cleanDeskVersionList(v.deskVersions);return l?{deskVersions:l}:{};};

// Seams: where the desk changes (the middle of each overlap) and how wide each overlap is.
export function seamsOf(list){
  const seams=[],overlaps=[];
  for(let i=1;i<list.length;i++){const p=list[i-1],c=list[i],ov=Math.max(0,p.end-c.start);overlaps.push(ov);seams.push(ov>0?(c.start+p.end)/2:c.start);}
  return {seams,overlaps};
}
// Windows from seams: slot i spans seam i-1 - ov/2 .. seam i + ov/2 (first from 0, last to the chapter end).
export function windowsFrom(seams,overlaps,total){
  const n=seams.length+1;
  return Array.from({length:n},(_,i)=>[i?r2(seams[i-1]-overlaps[i-1]/2):0,i<n-1?r2(seams[i]+overlaps[i]/2):r2(total)]);
}
// A list with the desks in slots `order` (indices into list), slot windows and letters untouched.
const withWindows=(list,wins,fn)=>list.map((v,i)=>({...fn(v,i),n:list[i].n,start:wins[i][0],end:wins[i][1]}));
// Drag a desk to another place in the order: the others shift along; the time slots stay where they are.
export function moveVersion(list,from,to){
  if(from===to||from<0||to<0||from>=list.length||to>=list.length)return list;
  const order=list.map((_,i)=>i);order.splice(to,0,order.splice(from,1)[0]);
  return withWindows(list,list.map(v=>[v.start,v.end]),(v,i)=>({...list[order[i]]}));
}
// Move the seam between versions i and i+1 to `seconds`; every desk keeps at least MIN_SHOWN s; overlaps keep their width.
export function moveSeam(list,i,seconds,total){
  const {seams,overlaps}=seamsOf(list);if(i<0||i>=seams.length)return list;
  const lo=(i?seams[i-1]:0)+MIN_SHOWN,hi=(i<seams.length-1?seams[i+1]:total)-MIN_SHOWN;
  if(hi<lo)return list;
  const next=seams.slice();next[i]=r2(Math.max(lo,Math.min(hi,seconds)));
  const wins=windowsFrom(next,overlaps,total);
  return withWindows(list,wins,v=>({...v}));
}
// Panel fields: a desk's shown time (seam to seam) -> list.
export const shown=(list,i)=>{const {seams}=seamsOf(list);return [i?seams[i-1]:0,i<seams.length?seams[i]:list.at(-1).end];};

// The sub-shots for `versions`, from the sub-shots as the film has them now. Pure; `subs` is not changed.
export function resolveSubshots(subs,versions){
  const cur=subs.filter(s=>s&&typeof s.subshot==='string');
  const common=(cur[0]?.sceneEdits||[]).filter(e=>cur.every(s=>(s.sceneEdits||[]).some(x=>JSON.stringify(x)===JSON.stringify(e))));
  const mainScreen=cur.flatMap(s=>s.screens||[]).find(x=>x.target==='main-landscape'&&x.offset===undefined&&x.rate===undefined);
  return versions.map(v=>{
    const slot=cur.find(s=>s.subshot===v.n)||cur[0];if(!slot)return null;
    const donor=slot.preset===v.preset?slot:cur.find(s=>s.preset===v.preset);
    const out=clone(slot);out.subshot=v.n;out.renderRange=[v.start,v.end];
    if(donor){
      for(const k of BUNDLE){const d=clone(donor[k]);if(d===undefined)delete out[k];else out[k]=d;}
      // A screen clip that starts at the window's start (offset) follows the desk to its new window, at its own rate.
      const shift=donor.renderRange[0]-v.start;
      if(shift&&Array.isArray(out.screens))out.screens=out.screens.map(sc=>sc.offset===undefined?sc:{...sc,offset:r2(sc.offset+shift*(Number.isFinite(sc.rate)?sc.rate:1))});
    }else{
      // A model with no desk of its own in the film yet: its preset's defaults over the slot (camera, rig, performance).
      out.preset=v.preset;out.kind='hero';delete out.accessories;
      out.sceneEdits=clone(common)||[];if(DARK.has(v.preset))out.sceneEdits.push({match:'^(Desktop|Top_Shelf)(_\\d+)?$',material:{...DARK_TOP}});
      out.sceneGlobals={...(out.sceneGlobals||{}),exposure:EXPOSURE[v.preset]??.8};
      out.screens=mainScreen?[clone(mainScreen)]:[];
      out.lights=(out.lights||[]).map(l=>l?.name==='kicker'?{...l,intensity:18}:l);
    }
    const build=cleanBuild(v.build);if(build)out.featuredBuild=build;else delete out.featuredBuild;   // the desk's own Build tab edits, this sub-shot only
    if(v.name&&v.name!==labelOf(v.preset))out.name=v.name;else delete out.name;
    return out;
  }).filter(Boolean);
}
// The film's own shot: the subshots map and the presets in time order.
export const resolveFilm=(film,versions)=>({...film,subshots:Object.fromEntries(versions.map(v=>[v.n,[v.start,v.end]])),presets:versions.map(v=>v.preset)});

// The list the Director shows: the film's own, with shot.deskVersions over it when it names the same slots.
export function effectiveVersions(base,edits){
  const e=cleanDeskVersionList(edits);
  if(!e||e.length!==base.length||!e.every((v,i)=>v.n===base[i].n))return base.map(v=>({n:v.n,preset:v.preset,name:v.setup?.name||'',start:v.start,end:v.end,...(v.build?{build:v.build}:{})}));
  return e;
}
// "Model-specific dressing" a model change resets, for the panel's hint.
export const RESET_NOTE='Model-specific screens and dressing reset to this model’s defaults; camera and light are kept.';
