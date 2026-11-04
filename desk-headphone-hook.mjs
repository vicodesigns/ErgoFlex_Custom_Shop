import * as THREE from 'three';
export const isDeskHeadphone=id=>['headphones','ergoflex-headphones-2','ergoflex-hanging-headphones'].includes(id);
// The round accessory port is measured from the CAD: radius .5671 inches.
// The matching owner's plug shaft radius is .557 inches. Use the original
// panel coordinates, then follow its actual world transform as the desk lifts.
export function measureHeadphoneSockets(hardware,mountWorld){
 const inverse=mountWorld.clone().invert(),result=[];
 for(const panel of hardware){
  if(!panel.geometry)continue;panel.geometry.computeBoundingBox();const b=panel.geometry.boundingBox,s=b.getSize(new THREE.Vector3());
  if(!(s.z<1&&s.x>15&&s.y>8))continue;
  panel.updateWorldMatrix(true,false);const matrix=inverse.clone().multiply(panel.matrixWorld);
  const mid=new THREE.Vector3(b.max.x-1.17995,b.max.y-2.3294,(b.min.z+b.max.z)/2).applyMatrix4(matrix);
  const side=mid.x>0?1:-1,normal=new THREE.Vector3(0,0,1).transformDirection(matrix);if(normal.x*side<0)normal.negate();
  const face=new THREE.Vector3(b.max.x-1.17995,b.max.y-2.3294,normal.dot(new THREE.Vector3(0,0,1).transformDirection(matrix))>0?b.max.z:b.min.z).applyMatrix4(matrix).addScaledVector(normal,.5);
  result.push({side:side>0?'right':'left',position:face.toArray(),yaw:Math.atan2(-normal.z,normal.x),radius:14.4044,panelThickness:s.z*25.4});
 }
 return result;
}
export function markDeskHeadphones(object){object.userData.deskHeadphones=true;object.userData.fixedHardware=true;return object;}
const plain=m=>{const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();m.decompose(p,q,s);return {p:{x:p.x,y:p.y,z:p.z},q:{x:q.x,y:q.y,z:q.z,w:q.w},s:{x:s.x,y:s.y,z:s.z}};};
export function headphoneSocketTransform(object,saved,mounts,recovery){
 if(!object.userData.deskHeadphones||saved.headphoneSocket==='original-v2')return saved;
 const sockets=mounts.shelf?.userData.headphoneSockets;if(!sockets?.length)return saved;
 // Recover only the exact transforms written by the withdrawn v1 replacement.
 if(recovery&&saved.role==='shelf'&&sockets.some(s=>Math.abs(saved.transform.p.x-s.position[0])<.01&&Math.abs(saved.transform.p.y-s.position[1])<.01&&Math.abs(saved.transform.p.z-s.position[2])<.01))saved=structuredClone(recovery);
 const t=saved.transform,wanted=t.p.x<0?'left':'right',socket=sockets.find(s=>s.side===wanted)||sockets[0];
 const manual=Math.abs(t.p.y)>.01||Math.abs(t.q.x)+Math.abs(t.q.y)+Math.abs(t.q.z)>.01;
 let transform;
 if(manual){
  const from=mounts[saved.role],to=mounts.shelf;from.updateWorldMatrix(true,false);to.updateWorldMatrix(true,false);
  const authored=new THREE.Matrix4().compose(new THREE.Vector3(t.p.x,t.p.y,t.p.z),new THREE.Quaternion(t.q.x,t.q.y,t.q.z,t.q.w),new THREE.Vector3(t.s.x,t.s.y,t.s.z));
  transform=plain(to.matrixWorld.clone().invert().multiply(from.matrixWorld).multiply(authored));
 }else{
  const side=socket.side==='right'?1:-1,q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),socket.yaw+Math.PI/2);
  transform={p:{x:socket.position[0]+side*50,y:socket.position[1]-180.92,z:socket.position[2]},q:{x:q.x,y:q.y,z:q.z,w:q.w},s:{x:1000,y:1000,z:1000}};
 }
 return {...saved,role:'shelf',headphoneSocket:'original-v2',transform};
}
export function headphoneHookState(socket){const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),socket.yaw);return {role:'shelf',added:true,removed:false,label:'Headphone hook · '+socket.side,headphoneSocket:'hook-v1',propId:'ergoflex-headphone-hook',transform:{p:{x:socket.position[0],y:socket.position[1],z:socket.position[2]},q:{x:q.x,y:q.y,z:q.z,w:q.w},s:{x:1000,y:1000,z:1000}}};}
export function finishDeskHeadphones(object,deskId){
 const index=[...deskId].reduce((n,c)=>n+c.charCodeAt(0),0)%3,finish=deskId==='main'?'black':['black','white','silver'][index];
 if(object.userData.headphoneFinish===finish)return;object.userData.headphoneFinish=finish;
 const materials=new Map();object.traverse(o=>{if(!o.isMesh)return;o.material=[].concat(o.material).map(source=>{if(materials.has(source))return materials.get(source);const m=source.clone();m.userData.sharedTextures=true;materials.set(source,m);o.ownedMaterials||=[];o.ownedMaterials.push(m);
 const metal=/Hinge|Sider|Aluminum|Logo/.test(m.name),dark=/Mesh|Black|Jack|LED/.test(m.name);m.color.set(metal?'#bcc5ca':dark?'#20272d':finish==='white'?'#e9e8e2':finish==='silver'?'#a3adb2':'#20262b');m.metalness=metal?.72:0;m.roughness=metal?.32:/Cushion/.test(m.name)?.84:.55;return m;});if(o.material.length===1)o.material=o.material[0];});
}

export function finishHeadphonePlug(root){
 root.traverse(o=>{if(!o.isMesh)return;const owned=[];const materials=[].concat(o.material).map(m=>{
  if(!m.name.startsWith('Plug ·'))return m;
  const aluminum=new THREE.MeshPhysicalMaterial({name:'Plug · polished aluminum',color:'#ffffff',metalness:1,roughness:.14,ior:2.5,envMapIntensity:1.35});
  aluminum.userData.sharedTextures=true;owned.push(aluminum);return aluminum;
 });if(owned.length){o.material=Array.isArray(o.material)?materials:materials[0];o.ownedMaterials=[...(o.ownedMaterials||[]),...owned];}});
 return root;
}
