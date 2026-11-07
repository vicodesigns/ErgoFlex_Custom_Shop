// Director branding on the live stage and in the film: the school stickers / logos of EVERY desk in the room
// (api.sceneDesks records, scene-desks.mjs) get the chapter's overlay (branding-edits.mjs). film-fx installs it for
// shot.sceneBranding and restores it on teardown; the Director's Branding tab reads the desks and the surface sizes
// from here. It never writes Studio: only the stage's record state (a throwaway in the stage's storage) is touched,
// and the original artwork comes back on restore.
//   record.state.artwork       replaced by the branded artwork while installed
//   record.__brandingBase      the desk's own artwork, kept for restore (and as the Branding tab's baseline)
// The featured (selected) desk is the live CAD model: its overlay is Studio's SurfaceArtwork, which Studio's own
// writeLive(record) sets from the record state, so it is written with the desk's current pose/height/tilt unchanged
// (the same call Studio's pose edits use). Every other desk's rig draws its artwork through rig.syncArtwork.
import {applyBranding} from './branding-edits.mjs';

const EMPTY={version:1,surfaces:{}};
export const baseArtwork=r=>r.__brandingBase??r.state?.artwork??EMPTY;
const apiOf=win=>win?.ErgoFlex||win;
export function roomDesks(win){
  const api=apiOf(win),desks=api?.sceneDesks;if(!desks)return {room:null,desks:[]};
  const list=[...desks.records.values()].map(r=>({id:r.id,name:r.state?.name||r.id,size:r.state?.size||'',primary:!!r.primary||r.id==='main',selected:desks.selected===r.id,base:baseArtwork(r)}));
  return {room:api.roomScene,desks:list};
}
function sync(api,r){
  const desks=api.sceneDesks;
  if(desks.selected===r.id){
    // Studio's own write-back of a record to the live desk, with the live pose kept as it is.
    const live=desks.ctx.readLive(r);
    const shim={...r,state:{...r.state,pose:live.pose,height:live.height,tilt:live.tilt}};
    desks.ctx.writeLive(shim);r.appliedArtwork=shim.appliedArtwork;
    if(!r.rig)desks.ensureRig(r);
    return r.rig?.syncArtwork?.(r.state.artwork);
  }
  if(!r.rig)desks.ensureRig(r);
  return r.rig?.syncArtwork?.(r.state.artwork);
}
// Apply branding to every desk of the room. Returns {desks, ready, restore}. A different room: nothing (warns).
export function installBranding(branding,win){
  const api=apiOf(win),desks=api?.sceneDesks,out={desks:[],restore(){},ready:Promise.resolve()};
  if(!desks||!branding)return out;
  if(branding.room&&api.roomScene&&branding.room!==api.roomScene){console.warn(`[branding] edits are for ${branding.room}, this room is ${api.roomScene}`);return out;}
  const jobs=[];
  for(const r of desks.records.values()){
    const base=baseArtwork(r),next=applyBranding(base,branding);
    if(JSON.stringify(next)===JSON.stringify(base))continue;
    r.__brandingBase??=r.state.artwork;
    r.state.artwork=next;out.desks.push(r.id);
    jobs.push(Promise.resolve(sync(api,r)));
  }
  out.ready=Promise.all(jobs).catch(e=>console.warn('[branding]',e));
  out.restore=()=>{
    const jobs=[];
    for(const r of desks.records.values()){
      if(r.__brandingBase===undefined)continue;
      r.state.artwork=r.__brandingBase;delete r.__brandingBase;
      jobs.push(Promise.resolve(sync(api,r)));
    }
    return Promise.all(jobs).catch(()=>{});
  };
  return out;
}
export const restoreAllBranding=win=>{const api=apiOf(win),desks=api?.sceneDesks;if(!desks)return Promise.resolve();
  const jobs=[];for(const r of desks.records.values()){if(r.__brandingBase===undefined)continue;r.state.artwork=r.__brandingBase;delete r.__brandingBase;jobs.push(Promise.resolve(sync(api,r)));}
  return Promise.all(jobs).catch(()=>{});};

// ---- surface sizes (inches), measured from the desk's own artwork meshes ----
// A probe graphic on every surface of a desk's rig gives one mesh per surface (scene-desk artwork, surface-artwork.mjs
// createSceneDeskArtwork); the mesh's uv runs 0..1 over the surface's width / height, so |dP/du| and |dP/dv| of its
// largest triangle are the surface in room units (millimetres). The rig is hidden while it is probed.
const PROBE='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const MM_PER_INCH=25.4;
function meshSize(mesh){
  const g=mesh.geometry,p=g.getAttribute('position'),uv=g.getAttribute('uv');if(!p||!uv)return null;
  let best=null,area=0;const idx=g.index;const at=i=>idx?idx.getX(i):i;
  for(let t=0;t<(idx?idx.count:p.count);t+=3){
    const a=at(t),b=at(t+1),c=at(t+2);
    const e1=[p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),p.getZ(b)-p.getZ(a)],e2=[p.getX(c)-p.getX(a),p.getY(c)-p.getY(a),p.getZ(c)-p.getZ(a)];
    const cx=e1[1]*e2[2]-e1[2]*e2[1],cy=e1[2]*e2[0]-e1[0]*e2[2],cz=e1[0]*e2[1]-e1[1]*e2[0],ar=Math.hypot(cx,cy,cz)/2;
    if(ar<=area)continue;
    const du1=uv.getX(b)-uv.getX(a),dv1=uv.getY(b)-uv.getY(a),du2=uv.getX(c)-uv.getX(a),dv2=uv.getY(c)-uv.getY(a),det=du1*dv2-du2*dv1;
    if(Math.abs(det)<1e-9)continue;
    const pu=e1.map((v,i)=>(v*dv2-e2[i]*dv1)/det),pv=e2.map((v,i)=>(du1*v-du2*e1[i])/det);
    best=[Math.hypot(...pu),Math.hypot(...pv)];area=ar;
  }
  return best;
}
const sizeCache=new WeakMap();
// {<surface id>:[width in, height in]} for a size ('48x30'/'60x30') — measured on a desk of that size; null if none.
export async function surfaceSizes(win,size){
  const api=apiOf(win),desks=api?.sceneDesks;if(!desks)return null;
  const r=[...desks.records.values()].find(x=>x.state?.size===size)||null;if(!r)return null;
  if(sizeCache.has(r.state)&&sizeCache.get(r.state).has(size))return sizeCache.get(r.state).get(size);
  if(!r.rig)desks.ensureRig(r);const rig=r.rig;if(!rig?.syncArtwork)return null;
  const surfaces=['desktop','left-panel','right-panel','upper-shelf','lower-shelf','base-shelf','desktop-crossbar','footrest-panel','shelf-back','shelf-left-panel','shelf-right-panel','left-leg-panel','right-leg-panel','left-foot','right-foot','left-column-upper','right-column-upper','left-column-center','right-column-center','left-column-lower','right-column-lower'];
  const probe={version:1,surfaces:Object.fromEntries(surfaces.map(id=>[id,{logo:{name:'probe',image:PROBE,enabled:true,coverage:'decal',repeat:'single',scale:30,x:50,y:50,rotation:0,spacing:20,opacity:100}}]))};
  const was=rig.group.visible;rig.group.visible=false;
  const out={};
  try{
    await rig.syncArtwork(probe);
    rig.group.traverse(o=>{const m=/^Artwork (\S+) logo$/.exec(o.name||'');if(!m||!o.geometry)return;const s=meshSize(o);if(s)out[m[1]]=s.map(v=>Math.round(v/MM_PER_INCH*100)/100);});
  }finally{
    rig.group.visible=was;
    await rig.syncArtwork(r.state.artwork);
  }
  const map=sizeCache.get(r.state)||new Map();map.set(size,out);sizeCache.set(r.state,map);
  return out;
}
