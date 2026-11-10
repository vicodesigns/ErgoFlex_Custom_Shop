// Director Props: "Drop to surface" (like Unreal's End key / Blender's snap to face). One object in, one move out:
// dropToSurface({THREE,scene,obj,mode,mm,skip}) moves obj straight down (world -Y) until the lowest point of its box
// rests on the first surface below, and changes obj's own position / quaternion (nothing else). The caller writes the
// result through its normal edit path (scene-prop-editor.mjs), so the drop exports like a manual move.
//   mode 'drop'  keep the way it is turned (a tilted prop rests on its lowest corner)
//   mode 'flat'  first zero its tilt and roll (keep the turn about the vertical), so it sits upright
//   mode 'align' first tilt it to the surface normal under its centre (a ramp, the tilted desktop), keeping its turn
// Rays go straight down from the box's bottom corners, edge middles and centre (slightly inset), against the visible
// scene meshes except obj itself and anything skip(object) says is a tool or helper; the surface is the highest hit at
// or below the prop's own bottom (+ a small tolerance), so a prop sunk into a surface pops up onto it.
// Returns {ok:true, distance (world units: how far its lowest point went down, - = it rose), surface (the mesh hit), normal, rotated}
// Thin sheets (a floor sign, a rug edge, a sticker: a mesh no thicker than DECAL_MM) that lie on something within
// DECAL_ON_MM are not surfaces: the prop rests on what is under them. A thin sheet with nothing right under it (a glass
// shelf) still counts.
// or {ok:false, reason} with obj untouched. mm = world units per millimetre (the stage's world is in metres: .001).
const TOLERANCE_MM=60,REST_MM=.5,INSET=.06,DECAL_MM=12,DECAL_ON_MM=15;
const visibleChain=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const thin=(THREE,o,mm)=>{const b=new THREE.Box3().setFromObject(o);return !b.isEmpty()&&b.max.y-b.min.y<=DECAL_MM*mm;};
const within=(a,o)=>{for(let p=o;p;p=p.parent)if(p===a)return true;return false;};
function solid(h,skip){
  const o=h.object,m=Array.isArray(o.material)?o.material[h.face?.materialIndex??0]:o.material;
  if(!o.isMesh||!visibleChain(o)||skip?.(o))return false;
  if(m&&(m.visible===false||(m.transparent&&(m.opacity<.15||m.depthWrite===false))||m.colorWrite===false))return false;   // gizmos, light cones, glass-less helpers
  return true;
}
// The object's box in its own frame, as 8 world corners (so a turned prop has a turned box).
function corners(THREE,obj){
  obj.updateWorldMatrix(true,true);const inv=new THREE.Matrix4().copy(obj.matrixWorld).invert(),box=new THREE.Box3(),v=new THREE.Vector3();
  obj.traverse(m=>{
    if(!m.isMesh||!m.geometry||!visibleChain(m))return;
    if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();const g=m.geometry.boundingBox;if(!g||g.isEmpty())return;
    const rel=new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld);
    for(let i=0;i<8;i++){v.set(i&1?g.max.x:g.min.x,i&2?g.max.y:g.min.y,i&4?g.max.z:g.min.z).applyMatrix4(rel);box.expandByPoint(v);}
  });
  if(box.isEmpty())return null;
  return Array.from({length:8},(_,i)=>new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(obj.matrixWorld));
}
// Rotation q (world) about the world point pivot; writes obj's local position / quaternion.
function turnAbout(THREE,obj,q,pivot){
  obj.updateWorldMatrix(true,false);
  const wp=obj.getWorldPosition(new THREE.Vector3()),wq=obj.getWorldQuaternion(new THREE.Quaternion());
  const np=wp.sub(pivot).applyQuaternion(q).add(pivot),nq=q.clone().multiply(wq);
  place(THREE,obj,np,nq);
}
function place(THREE,obj,pos,quat){
  const parent=obj.parent;let pq=new THREE.Quaternion();
  if(parent){parent.updateWorldMatrix(true,false);parent.getWorldQuaternion(pq);obj.position.copy(parent.worldToLocal(pos.clone()));}else obj.position.copy(pos);
  obj.quaternion.copy(pq.invert().multiply(quat));obj.updateMatrixWorld(true);
}
export function dropToSurface({THREE,scene,obj,mode='drop',mm=.001,skip=null}){
  const start={p:obj.position.clone(),q:obj.quaternion.clone()},undo=reason=>{obj.position.copy(start.p);obj.quaternion.copy(start.q);obj.updateMatrixWorld(true);return {ok:false,reason};};
  let c=corners(THREE,obj);if(!c)return {ok:false,reason:'It has no shape to drop.'};
  const minY0=Math.min(...c.map(p=>p.y));
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0),tol=TOLERANCE_MM*mm;
  const cast=(x,y,z)=>{
    const top=Math.max(...c.map(p=>p.y))+10*mm;ray.set(new THREE.Vector3(x,top,z),down);
    const hits=ray.intersectObject(scene,true).filter(h=>!within(obj,h.object)&&solid(h,skip));
    let hit=hits.find(h=>h.point.y<=y+tol);
    if(!hit)return null;
    while(thin(THREE,hit.object,mm)){   // a decal: rest on what it lies on
      const next=hits.slice(hits.indexOf(hit)+1).find(h=>h.object!==hit.object);
      if(!next||hit.point.y-next.point.y>DECAL_ON_MM*mm)break;hit=next;
    }const n=hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):up.clone();if(n.y<0)n.negate();return {hit,n};
  };
  const aabbBottom=()=>{const b=new THREE.Box3().setFromPoints(c),m=b.getCenter(new THREE.Vector3());return new THREE.Vector3(m.x,b.min.y,m.z);};
  let rotated=false,normal=up.clone();
  if(mode==='flat'||mode==='align'){
    const pivot=aabbBottom(),wq=obj.getWorldQuaternion(new THREE.Quaternion()),yaw=new THREE.Euler().setFromQuaternion(wq,'YXZ').y;
    const level=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0,'YXZ')),delta=level.multiply(wq.clone().invert());
    if(delta.angleTo(new THREE.Quaternion())>1e-5){turnAbout(THREE,obj,delta,pivot);rotated=true;c=corners(THREE,obj);}
    if(mode==='align'){
      const m=c.reduce((s,p)=>s.add(p),new THREE.Vector3()).divideScalar(8),b=new THREE.Box3().setFromPoints(c),hit=cast(m.x,b.min.y,m.z);
      if(!hit)return undo('Nothing below it to rest on.');
      if(hit.n.y<.2)return undo('The surface under it is too steep to align to.');
      normal=hit.n;const tilt=new THREE.Quaternion().setFromUnitVectors(up,normal);
      if(tilt.angleTo(new THREE.Quaternion())>1e-5){turnAbout(THREE,obj,tilt,aabbBottom());rotated=true;c=corners(THREE,obj);}
    }
  }
  // Samples: the four lowest corners, the middles of their edges and their centre, pulled in a little.
  const low=[...c].sort((a,b)=>a.y-b.y).slice(0,4),mid=low.reduce((s,p)=>s.add(p),new THREE.Vector3()).divideScalar(4),all=c.reduce((s,p)=>s.add(p),new THREE.Vector3()).divideScalar(8);
  const pts=[...low,...low.map((p,i)=>p.clone().add(low[(i+1)%4]).multiplyScalar(.5)),mid].map(p=>{const q=p.clone();q.x+=(all.x-q.x)*INSET;q.z+=(all.z-q.z)*INSET;return q;});
  let best=null,centre=null;
  for(const p of pts){const r=cast(p.x,p.y,p.z);if(!r)continue;const d=p.y-r.hit.point.y;if(!best||d<best.d)best={d,...r};if(p===pts.at(-1))centre=r;}
  if(!best)return undo('Nothing below it to rest on.');
  const move=best.d-REST_MM*mm,wp=obj.getWorldPosition(new THREE.Vector3());wp.y-=move;
  place(THREE,obj,wp,obj.getWorldQuaternion(new THREE.Quaternion()));
  const distance=minY0-Math.min(...corners(THREE,obj).map(p=>p.y));   // how far its lowest point went down (turning it first counts)
  return {ok:true,distance,surface:(centre||best).hit.object,normal:mode==='align'?normal:up,rotated};
}
