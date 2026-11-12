// Desk versions, editable (chapter 12 / hero): which desks the chapter shows, in which order, for how long and as
// which model. Pure data code, shared by the Director (browser) and tools/experience/desk-versions-apply.mjs (the
// importer's pass), so the live stage and the film resolve the same sub-shots.
//
// A version is {n, preset, name, start, end}: n is its id, start / end its sub-shot's renderRange in chapter seconds,
// preset the desk model and name the label on the lane and the frame badge. The list is in time order and is the whole
// statement of the chapter: one sub-shot per entry, 1 to MAX_VERSIONS of them.
//
// Ids are the letters of the time slots: the film's own six are 'A'..'F' in time order. A slot added in the Director
// gets the next letter after every one the cut has used ('G', 'H', … 'Z', 'AA', …; nextVersionId,
// shot.deskVersionsLast remembers the highest handed out), so a letter is never given to a second slot. As before,
// reordering moves the desks (model and name) between the slots: the letters and the windows stay where they are.
//
// The time line (the seams where the desk changes and the crossfade overlap at each seam) is positional: a seam drag
// moves one seam, adding a version splits the time of the one before it and removing one gives its time to the one
// before it.
//
// What a version renders: its sub-shot in the film when its id has one (camera, light rig and desk performance are
// the chapter's and the same in every sub-shot), else a copy of the film sub-shot of its model. A desk is the bundle
// of fields that belong to the model: preset, kind, screens (with their clip offsets), accessories, desk dressing
// (sceneEdits that are not the shared room's), kicker light and exposure; it is looked up by model in the film's
// sub-shots, then in the library (film sub-shots an earlier import dropped: build-round8-director.py keeps their
// bundles). A model with no bundle anywhere gets its preset's defaults (model-specific dressing reset).
// The desk changes at the middle of each overlap.
export const NAMES={artist:'Artist',occ:'OCC',architect:'Architect',hbhs:'HBHS',office:'Office',gaming:'Gaming',library:'Library',music:'Music',compact:'Compact',creative:'Creative'};
export const labelOf=id=>NAMES[id]||(String(id||'Desk')[0].toUpperCase()+String(id||'Desk').slice(1));
export const MIN_SHOWN=2;                       // s a desk is shown at least
export const MAX_VERSIONS=12;                   // desks in one chapter at most
export const DEFAULT_OVERLAP=.6;                // s of crossfade at a new seam when the chapter has none to copy
const BUNDLE=['kind','preset','lights','sceneEdits','screens','sceneGlobals','accessories'];
const DARK=new Set(['gaming','hbhs']),DARK_TOP={clearcoat:0,specularIntensity:0.05},EXPOSURE={gaming:.95,hbhs:.95,office:.85,occ:.85,architect:.70,artist:.65};
const ID=/^[A-Z]{1,2}$/;
const num=(v,lo,hi)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):null;
const r2=x=>Math.round(x*100)/100;
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));

// shot.deskVersions as the cut keeps it: [{n,preset,name,start,end}] in time order; invalid entries drop the list.
export function cleanDeskVersionList(value){
  if(!Array.isArray(value)||value.length<1||value.length>MAX_VERSIONS)return null;
  const out=[];
  for(const e of value){
    if(!e||typeof e!=='object'||!ID.test(String(e.n||'')))return null;
    const preset=String(e.preset||'');if(!/^[a-z0-9-]{1,40}$/.test(preset))return null;
    const start=num(e.start,0,600),end=num(e.end,0,600);if(start===null||end===null||end<=start)return null;
    const name=String(e.name??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,40);
    out.push({n:e.n,preset,name,start:r2(start),end:r2(end)});
  }
  if(new Set(out.map(e=>e.n)).size!==out.length)return null;
  out.sort((a,b)=>a.start-b.start||a.n.localeCompare(b.n));
  return out;
}
export const cleanDeskVersionsField=v=>{
  const l=v&&cleanDeskVersionList(v.deskVersions),last=v&&ID.test(String(v.deskVersionsLast||''))?v.deskVersionsLast:null;
  return {...(l?{deskVersions:l}:{}),...(last?{deskVersionsLast:last}:{})};
};

// Ids in order: A..Z, then AA..ZZ. The next id is the one after the highest in `used` (the film's ids, the list's, the
// cut's deskVersionsLast and any id something still refers to), null when they have run out.
const idIndex=id=>id.length===1?id.charCodeAt(0)-65:26+(id.charCodeAt(0)-65)*26+id.charCodeAt(1)-65;
const idAt=k=>k<26?String.fromCharCode(65+k):String.fromCharCode(65+Math.floor((k-26)/26))+String.fromCharCode(65+(k-26)%26);
export function nextVersionId(used){
  let k=-1;for(const id of used||[])if(typeof id==='string'&&ID.test(id))k=Math.max(k,idIndex(id));
  return k+1<26+26*26?idAt(k+1):null;
}

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
// `desks` (id, model, name) in time order over the windows `wins`.
const place=(desks,wins)=>desks.map((v,i)=>({n:v.n,preset:v.preset,name:v.name||'',start:wins[i][0],end:wins[i][1]}));
// Drag a desk to another place in the order: the others shift along; the time slots (letters and windows) stay where they are.
export function moveVersion(list,from,to){
  if(from===to||from<0||to<0||from>=list.length||to>=list.length)return list;
  const order=list.map((_,i)=>i);order.splice(to,0,order.splice(from,1)[0]);
  return place(order.map((j,i)=>({...list[j],n:list[i].n})),list.map(v=>[v.start,v.end]));
}
// Move the seam between versions i and i+1 to `seconds`; every desk keeps at least MIN_SHOWN s; overlaps keep their width.
export function moveSeam(list,i,seconds,total){
  const {seams,overlaps}=seamsOf(list);if(i<0||i>=seams.length)return list;
  const lo=(i?seams[i-1]:0)+MIN_SHOWN,hi=(i<seams.length-1?seams[i+1]:total)-MIN_SHOWN;
  if(hi<lo)return list;
  const next=seams.slice();next[i]=r2(Math.max(lo,Math.min(hi,seconds)));
  return place(list,windowsFrom(next,overlaps,total));
}
// Panel fields: a desk's shown time (seam to seam) -> list.
export const shown=(list,i)=>{const {seams}=seamsOf(list);return [i?seams[i-1]:0,i<seams.length?seams[i]:list.at(-1).end];};

// Whether one more desk fits: under the limit, and every desk could still show MIN_SHOWN s.
export const canAddVersion=(list,total)=>list.length<MAX_VERSIONS&&total>=(list.length+1)*MIN_SHOWN-1e-9;
// A copy of version `src` (model and name) with the id `id`, as the desk number `at` (1..length: after the desk
// before it). It takes the second half of the time of the desk before it (the seam on a tenth of a second); when that
// desk is too short to share,
// every desk gives part of what it has above the minimum. The new seam crossfades as wide as its neighbour.
// null when it does not fit (canAddVersion) or the id is taken.
export function addVersion(list,src,at,id,total){
  if(!list[src]||!Number.isInteger(at)||at<1||at>list.length||!ID.test(String(id||''))||list.some(v=>v.n===id)||!canAddVersion(list,total))return null;
  const {seams,overlaps}=seamsOf(list),edges=[0,...seams,total],lens=edges.slice(1).map((e,i)=>e-edges[i]),give=at-1;
  let mine;
  if(lens[give]>=2*MIN_SHOWN){
    // The new seam on the 0.1 s grid: whole frames at 30 fps, like the film's own seams.
    const a=edges[give],b=edges[give+1],seam=Math.max(a+MIN_SHOWN,Math.min(b-MIN_SHOWN,Math.round((a+b)/2*10+1e-6)/10));
    mine=b-seam;lens[give]=seam-a;
  }
  else{
    const slack=lens.reduce((s,l)=>s+Math.max(0,l-MIN_SHOWN),0);mine=Math.min(MIN_SHOWN,slack);
    for(const [i,l] of lens.entries())lens[i]=l-(slack>0?Math.max(0,l-MIN_SHOWN)*mine/slack:0);
  }
  lens.splice(at,0,mine);
  const next=[];let t=0;for(const l of lens.slice(0,-1)){t+=l;next.push(r2(t));}
  const near=[overlaps[at-1],overlaps[at-2]].find(o=>o>0)??DEFAULT_OVERLAP,ov=overlaps.slice();ov.splice(at-1,0,near);
  const desks=list.slice();desks.splice(at,0,{n:id,preset:list[src].preset,name:list[src].name||''});
  return place(desks,windowsFrom(next,ov,total));
}
// Without version i: the desk before it stays on for its time (the next one, when it was the first). null when it is
// the only one.
export function removeVersion(list,i,total){
  if(list.length<2||!list[i])return null;
  const {seams,overlaps}=seamsOf(list),k=Math.max(0,i-1);seams.splice(k,1);overlaps.splice(k,1);
  return place(list.filter((_,j)=>j!==i),windowsFrom(seams,overlaps,total));
}

// The sub-shots for `versions`, from the sub-shots as the film has them now (and `library`: bundles of film sub-shots
// an earlier import dropped). Pure; `subs` is not changed.
export function resolveSubshots(subs,versions,library=[]){
  const cur=subs.filter(s=>s&&typeof s.subshot==='string'),lib=(Array.isArray(library)?library:[]).filter(s=>s&&typeof s.preset==='string'&&Array.isArray(s.renderRange));
  const common=(cur[0]?.sceneEdits||[]).filter(e=>cur.every(s=>(s.sceneEdits||[]).some(x=>JSON.stringify(x)===JSON.stringify(e))));
  const mainScreen=cur.flatMap(s=>s.screens||[]).find(x=>x.target==='main-landscape'&&x.offset===undefined&&x.rate===undefined);
  return versions.map(v=>{
    // Its own sub-shot in the film, else (a version added in the Director) a copy of its model's.
    const own=cur.find(s=>s.subshot===v.n),donor=own?.preset===v.preset?own:cur.find(s=>s.preset===v.preset)||lib.find(s=>s.preset===v.preset);
    const slot=own||(donor&&cur.includes(donor)?donor:cur[0]);if(!slot)return null;
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
    if(v.name&&v.name!==labelOf(v.preset))out.name=v.name;else delete out.name;
    return out;
  }).filter(Boolean);
}
// The film's own shot: the subshots map and the presets in time order.
export const resolveFilm=(film,versions)=>({...film,subshots:Object.fromEntries(versions.map(v=>[v.n,[v.start,v.end]])),presets:versions.map(v=>v.preset)});
// What a film sub-shot leaves behind when an import drops it: its model's bundle (resolveSubshots' `library`).
export const libraryEntry=s=>({id:s.id,subshot:s.subshot,renderRange:clone(s.renderRange),...Object.fromEntries(BUNDLE.filter(k=>s[k]!==undefined).map(k=>[k,clone(s[k])]))});

// The list the Director shows: the cut's own (shot.deskVersions) when it has a valid one, else the film's.
export function effectiveVersions(base,edits){
  return cleanDeskVersionList(edits)||base.map(v=>({n:v.n,preset:v.preset,name:v.setup?.name||'',start:v.start,end:v.end}));
}
// "Model-specific dressing" a model change resets, for the panel's hint.
export const RESET_NOTE='Model-specific screens and dressing reset to this model’s defaults; camera and light are kept.';
