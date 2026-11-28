// node design.mjs out.json [times csv]: keep the existing spine/neck/head keys; add upperarm/lowerarm/hand L+R keys so the
// hands stay at the motion's own pose (rig.reach twice + setWorld, the same construction as handsKey).
import fs from 'node:fs';
const W='file:///C:/Users/Vico/polish-wt/wellness-maya-hands/';
const THREE = await import(W+'node_modules/three/build/three.module.js');
const M = await import(W+'room-people-motion.mjs');
const { filmFrames, chapterShot } = await import(W+'tests/lib/people-film-run.mjs');
const { poseAt } = await import(W+'people-pose-keys.mjs');
const rig = new M.PersonRig(JSON.parse(fs.readFileSync('C:/Users/Vico/polish-wt/wellness-maya-hands/assets/props/people-rigs/maya.json','utf8')));
const shot = chapterShot('wellness'), ID='people-maya-stand-type-41';
const old = shot.people.cast[0].postures[ID].poseKeys;
const extra = (process.argv[3]||'').split(',').filter(Boolean).map(Number);
const times = [...new Set([...old.map(k=>k.t), ...extra])].sort((a,b)=>a-b);
const strip = f => { delete f.cast[0].postures[ID].poseKeys; return f; };
const rows = await filmFrames({ shot, key:/^maya-stand/, times, edit: strip });
function loadRow(row){ const wq=rig.names.map(n=>row.bones[n]?new THREE.Quaternion().fromArray(row.bones[n],3):null);
  for(let i=0;i<rig.n;i++){ if(!wq[i]) continue; const p=rig.parents[i]; rig.lq[i].copy(p<0?wq[i]:wq[p].clone().invert().multiply(wq[i])).normalize(); }
  const R=rig.b.Root,P=rig.b.pelvis; rig.lp[R].fromArray(row.bones[rig.names[R]]); const pw=new THREE.Vector3().fromArray(row.bones[rig.names[P]]); rig.lp[P].copy(pw.sub(rig.lp[R]).applyQuaternion(wq[R].clone().invert())); rig.fk();
  let e=0; for(let i=0;i<rig.n;i++) if(row.bones[rig.names[i]]) e=Math.max(e,rig.wp[i].distanceTo(new THREE.Vector3().fromArray(row.bones[rig.names[i]]))); return e; }
const r4 = q => { if (q.w<0) { q.x*=-1;q.y*=-1;q.z*=-1;q.w*=-1; } return [q.x,q.y,q.z,q.w].map(v=>Math.round(v*1e4)/1e4+0); };
const out=[];
for (const row of rows) {
  const err=loadRow(row); const mot=rig.lq.map(q=>q.clone());
  const tgt={}; for(const s of ['l','r']){ const h=rig.side[s].arm[3]; tgt[s]={p:rig.wp[h].clone(),q:rig.wq[h].clone()}; }
  const core=poseAt({poseKeys:old}, row.t);   // spine/neck/head turn at this time (as the film interpolates it)
  for(const [n,d] of Object.entries(core)){ const i=rig.index.get(n); rig.lq[i].multiply(new THREE.Quaternion().fromArray(d)).normalize(); } rig.fk();
  const before={}; for(const s of ['l','r']) before[s]=rig.wp[rig.side[s].arm[3]].distanceTo(tgt[s].p);
  for(const s of ['l','r']){ const [,u,l,h]=rig.side[s].arm; rig.reach(u,l,h,tgt[s].p); rig.reach(u,l,h,tgt[s].p); rig.setWorld(h,tgt[s].q); rig.fk(); }
  const pose={...Object.fromEntries(Object.entries(core).map(([k,v])=>[k,v.map(x=>Math.round(x*1e4)/1e4+0)]))};
  for(const s of ['l','r']) for(const b of ['upperarm','lowerarm','hand']){ const i=rig.index.get(b+'_'+s); pose[b+'_'+s]=r4(mot[i].clone().invert().multiply(rig.lq[i]).normalize()); }
  const ang=q=>(2*Math.acos(Math.min(1,Math.abs(q[3])))*180/Math.PI).toFixed(2);
  console.log(row.t, 'loadErr', (err*1000).toFixed(2),'mm  hand off before', (before.l*1000).toFixed(1),(before.r*1000).toFixed(1), 'mm  key deg', ['upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r'].map(n=>n.replace(/arm|_/g,'')+' '+ang(pose[n])).join(' '));
  const k={t:row.t,pose}; const o=old.find(x=>x.t===row.t); if(o?.ease) k.ease=o.ease; out.push(k);
}
// keys at the ends stay exactly identity (motion untouched before 9.1 / after 10.1)
for (const k of [out[0], out.at(-1)]) for (const n of Object.keys(k.pose)) if (/arm|hand/.test(n)) { const q=k.pose[n]; if (2*Math.acos(Math.min(1,Math.abs(q[3])))<2e-3) k.pose[n]=[0,0,0,1]; }
fs.writeFileSync(process.argv[2], JSON.stringify(out));
