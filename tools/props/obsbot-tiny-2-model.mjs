// Geometry adapted from the local obsbot-refined.html reference.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
export function createObsbotTiny2() {
const M = {
  base : new THREE.MeshPhysicalMaterial({ color:0x24262a, roughness:.55, metalness:.3, clearcoat:.3, clearcoatRoughness:.4 }),
  body : new THREE.MeshPhysicalMaterial({ color:0x2a2c30, roughness:.5, metalness:.25, clearcoat:.35, clearcoatRoughness:.35 }),
  gloss: new THREE.MeshPhysicalMaterial({ color:0x0a0b0e, roughness:.15, metalness:.4, clearcoat:1, clearcoatRoughness:.08 }),
  disc : new THREE.MeshStandardMaterial({ color:0x1e2023, roughness:.5, metalness:.45 }),
  silver:new THREE.MeshStandardMaterial({ color:0xb4b8bc, roughness:.3, metalness:.95 }),
  silver2:new THREE.MeshStandardMaterial({ color:0x9da1a5, roughness:.35, metalness:.9 }),
  dark : new THREE.MeshStandardMaterial({ color:0x0f1013, roughness:.6, metalness:.2 }),
  inner: new THREE.MeshStandardMaterial({ color:0x060608, roughness:.7, metalness:.1, side:THREE.DoubleSide }),
};

/* ---------------- canvas textures ---------------- */
function logoTexture(){
  const c=document.createElement('canvas'); c.width=1024; c.height=256; const g=c.getContext('2d');
  const text='OBSBOT', sp=2;
  g.font='600 140px Arial, sans-serif'; g.textBaseline='middle';
  const ws=[...text].map(ch=>g.measureText(ch).width);
  let x=(1024-(ws.reduce((a,b)=>a+b,0)+sp*(text.length-1)))/2;
  g.fillStyle='#b9bdc0'; g.textAlign='left';
  [...text].forEach((ch,i)=>{ g.fillText(ch,x,134); x+=ws[i]+sp; });
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}
function dialTexture(){ // machined concentric-ring pattern for the side dial
  const c=document.createElement('canvas'); c.width=c.height=512; const g=c.getContext('2d');
  const grad=g.createRadialGradient(256,256,30,256,256,256);
  grad.addColorStop(0,'#c2c6c9'); grad.addColorStop(1,'#878b8f');
  g.fillStyle=grad; g.fillRect(0,0,512,512);
  for(let r=252;r>2;r-=5){
    const v=150+Math.round(28*Math.sin(r*.55))-((r%16<2)?16:0);
    g.strokeStyle=`rgba(65,68,70,.30)`; g.lineWidth=1.2;
    g.beginPath(); g.arc(256,256,r,0,Math.PI*2); g.stroke();
  }
  
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}

/* ---------------- helpers ---------------- */
function rrect(p,w,h,r){ const x=-w/2,y=-h/2;
  p.moveTo(x,y+r); p.lineTo(x,y+h-r); p.quadraticCurveTo(x,y+h,x+r,y+h);
  p.lineTo(x+w-r,y+h); p.quadraticCurveTo(x+w,y+h,x+w,y+h-r);
  p.lineTo(x+w,y+r); p.quadraticCurveTo(x+w,y,x+w-r,y);
  p.lineTo(x+r,y); p.quadraticCurveTo(x,y,x,y+r); }
function frame(w1,h1,r1,w2,h2,r2,d){ // rounded-square outline (LED ring)
  const s=new THREE.Shape(); rrect(s,w1,h1,r1);
  const h=new THREE.Path(); rrect(h,w2,h2,r2); s.holes.push(h);
  return new THREE.ExtrudeGeometry(s,{ depth:d, bevelEnabled:false, curveSegments:12 }); }

/* ================= REFERENCE-MATCHED MODEL ================= */
const model = new THREE.Group(); model.name = "OBSBOT Tiny 2";
const graphite = new THREE.MeshPhysicalMaterial({color:0x484b4d,metalness:.40,roughness:.45,clearcoat:.18});
const shellMat = new THREE.MeshPhysicalMaterial({color:0x151719,metalness:.32,roughness:.38,clearcoat:.4});
const faceMat = new THREE.MeshPhysicalMaterial({color:0x1b1e20,metalness:.15,roughness:.38,clearcoat:.65,clearcoatRoughness:.28});
const trimMat = new THREE.MeshStandardMaterial({color:0x292c2e,metalness:.6,roughness:.3});
M.base.color.setHex(0x1b1d1f); M.base.roughness=.49; M.base.metalness=.24;
function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function rb(w,h,d,r,mat,parent,x,y,z){return mesh(new RoundedBoxGeometry(w,h,d,3,r),mat,parent,x,y,z);}
function cyl(r,d,mat,parent,x,y,z){return mesh(new THREE.CylinderGeometry(r,r,d,48),mat,parent,x,y,z);}
function tor(r,t,mat,parent,x,y,z){return mesh(new THREE.TorusGeometry(r,t,12,64),mat,parent,x,y,z);}
// Rounded plan-view profiles preserve the soft corners at every height.
function roundedPrism(w,h,d,r,mat,parent,x,y,z){
 const shape=new THREE.Shape();rrect(shape,w,h,r);
 const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,curveSegments:16});
 geo.translate(0,0,-d/2);return mesh(geo,mat,parent,x,y,z);
}
function basePrism(w,d,h,r,mat,y){
 const m=roundedPrism(w,d,h,r,mat,model,0,y,0);m.rotation.x=-Math.PI/2;return m;
}
const base=basePrism(3.38,2.46,1.42,.53,M.base,.84);
basePrism(3.36,2.44,.23,.54,M.dark,.18);
basePrism(3.35,2.43,.025,.53,trimMat,1.575);
const logo=mesh(new THREE.PlaneGeometry(1.08,.27),new THREE.MeshBasicMaterial({map:logoTexture(),transparent:true,depthWrite:false}),model,0,1.16,1.270);
const micMat=new THREE.MeshStandardMaterial({color:0x020303,roughness:.9});
[-.70,.70].forEach(x=>{
  mesh(new THREE.CircleGeometry(.043,32),micMat,model,x,.49,1.270);
  tor(.045,.007,trimMat,model,x,.49,1.271);
});
// Rear USB-C recess and an inset connector, visible in the rear view.
rb(.49,.20,.015,.065,M.dark,model,0,.42,-1.285);
const usb=mesh(frame(.35,.13,.052,.28,.066,.025,.011),graphite,model,0,.42,-1.278);usb.rotation.y=Math.PI;
rb(.20,.022,.022,.009,trimMat,model,0,.42,-1.285);
const pan=new THREE.Group();pan.name="Webcam pan gimbal";model.add(pan);
const seam=cyl(1.20,.035,M.dark,pan,0,1.635,0);
const disc=cyl(1.23,.27,graphite,pan,0,1.787,0);
cyl(1.225,.012,trimMat,pan,0,1.923,0);
// A narrow curved slot across the front of the turntable, with rounded ends.
function arcBand(radius,height,halfAngle,mat){
 const geo=new THREE.CylinderGeometry(radius,radius,height,48,1,true,-halfAngle,halfAngle*2);
 return mesh(geo,mat,pan,0,1.775,0);
}
arcBand(1.234,.075,.73,M.dark);
const ledMat=new THREE.MeshBasicMaterial({color:0x40df56,toneMapped:false,side:THREE.DoubleSide});
const led=arcBand(1.24,.043,.70,ledMat);
[-.70,.70].forEach(a=>{
 const cap=mesh(new THREE.CircleGeometry(.0215,24),ledMat,pan,Math.sin(a)*1.24,1.775,Math.cos(a)*1.24);
 cap.rotation.y=a;
});
// Emissive status strip uses no extra room light.
// One-piece L-shaped right arm, bent into the turntable at its foot.
const armShape=new THREE.Shape();
armShape.moveTo(.46,1.76);armShape.lineTo(1.15,1.76);
armShape.quadraticCurveTo(1.34,1.76,1.34,1.96);
armShape.lineTo(1.34,3.47);armShape.lineTo(.93,3.47);
armShape.lineTo(.93,2.12);armShape.quadraticCurveTo(.93,1.94,.73,1.94);
armShape.lineTo(.46,1.94);armShape.closePath();
const armGeo=new THREE.ExtrudeGeometry(armShape,{depth:.60,bevelEnabled:true,bevelSize:.045,bevelThickness:.045,bevelSegments:3,curveSegments:16});
armGeo.translate(0,0,-.30);
mesh(armGeo,graphite,pan);
const tilt=new THREE.Group();tilt.name="Webcam tilt gimbal";tilt.position.set(0,3.43,0);pan.add(tilt);
// Slightly deeper at the front, with a rounded rear housing.
const head=rb(1.98,1.97,1.55,.40,shellMat,tilt,-.39,0,.03);
rb(1.66,1.66,.55,.32,shellMat,tilt,-.28,0,-.59);
const panel=roundedPrism(1.91,1.90,.09,.45,M.gloss,tilt,-.39,0,.780);
// Very thin red accent; it is a trim line, not a luminous square frame.
const ring=mesh(frame(1.88,1.87,.46,1.823,1.813,.432,.014),
 new THREE.MeshStandardMaterial({color:0xf32532,roughness:.36,metalness:.1,emissive:0x630008,emissiveIntensity:.3}),tilt,-.39,0,.868);
// Continuous sculpted concave front: soft curved shoulders taper into the lens.
function faceDish(){
 const n=64,verts=[],indices=[];
 const rows=[{w:1.79,h:1.78,r:.42,z:.863},{w:1.70,h:1.69,r:.44,z:.91},
 {w:1.48,h:1.47,r:.48,z:.966},{w:1.27,h:1.26,r:.53,z:.914},
 {w:1.13,h:1.13,r:.565,z:.882}];
 for(const row of rows){
  for(let i=0;i<n;i++){
   const a=i/n*Math.PI*2,c=Math.cos(a),v=Math.sin(a);
   // Rounded rectangle sampled by intersecting rays with its curved contour.
   const ax=Math.abs(c),ay=Math.abs(v),hx=row.w/2,hy=row.h/2,r=row.r;
   let t=Math.min(hx/(ax||1e-9),hy/(ay||1e-9));
   if(t*ax>hx-r && t*ay>hy-r){
    const cx=hx-r,cy=hy-r,B=-2*(ax*cx+ay*cy),C=cx*cx+cy*cy-r*r;
    t=(-B+Math.sqrt(Math.max(0,B*B-4*C)))/2;
   }
   verts.push(c*t,v*t,row.z);
  }
 }
 for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){
  const a=j*n+i,b=j*n+(i+1)%n,c=(j+1)*n+i,d=(j+1)*n+(i+1)%n;
  indices.push(a,b,c,b,d,c);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
mesh(faceDish(),faceMat,tilt,-.39,0,0);
// Fine black concentric grooves on the broad lens bezel.
const lens=new THREE.Group();lens.position.set(-.39,0,0);tilt.add(lens);
const put=(geo,mat,z)=>mesh(geo,mat,lens,0,0,z);
const bezelMat=new THREE.MeshStandardMaterial({color:0x25282a,metalness:.68,roughness:.45});
put(new THREE.CylinderGeometry(.575,.575,.078,64).rotateX(Math.PI/2),bezelMat,.897);
function brushedTexture(){
 const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');
 const grad=g.createRadialGradient(512,512,0,512,512,512);grad.addColorStop(0,'#272a2c');grad.addColorStop(.5,'#4b4e50');grad.addColorStop(1,'#343739');g.fillStyle=grad;g.fillRect(0,0,1024,1024);
 for(let r=235;r<512;r+=8){g.beginPath();g.arc(512,512,r,0,Math.PI*2);g.strokeStyle='rgba(9,11,13,.62)';g.lineWidth=2.2;g.stroke();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
put(new THREE.CircleGeometry(.574,64),new THREE.MeshStandardMaterial({map:brushedTexture(),metalness:.45,roughness:.46}),.938);
put(new THREE.TorusGeometry(.576,.008,10,64),trimMat,.930);
put(new THREE.CircleGeometry(.259,48),M.inner,.942);
put(new THREE.TorusGeometry(.256,.017,14,48),M.gloss,.941);
put(new THREE.TorusGeometry(.211,.014,12,48),M.dark,.944);
const glass=put(new THREE.SphereGeometry(.204,32,16),new THREE.MeshPhysicalMaterial({color:0x142227,metalness:.25,roughness:.11,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.0,iridescence:.25}),.923);
glass.scale.z=.20;
put(new THREE.CircleGeometry(.109,64),new THREE.MeshPhysicalMaterial({color:0x02080e,roughness:.1,metalness:.2,clearcoat:1}),.969);
put(new THREE.TorusGeometry(.105,.011,12,64),new THREE.MeshPhysicalMaterial({color:0x386572,metalness:.8,roughness:.22}),.971);
put(new THREE.CircleGeometry(.071,64),M.inner,.973);
const spark=mesh(new THREE.SphereGeometry(.016,16,12),new THREE.MeshBasicMaterial({color:0xa6d7e0}),lens,-.035,.040,.982);spark.scale.set(1,.45,.3);
// Compact dark pivot barrel; the original oversized silver cap is removed.
const dial=mesh(new THREE.CylinderGeometry(.73,.73,.82,48).rotateZ(Math.PI/2),graphite,tilt,.99,0,0);
const axle=mesh(new THREE.CylinderGeometry(.69,.69,.028,48).rotateZ(Math.PI/2),M.dark,tilt,.617,0,0);
const capMaterial=new THREE.MeshStandardMaterial({color:0xb6b8b9,map:dialTexture(),roughness:.48,metalness:.48});
const cap=mesh(new THREE.CircleGeometry(.705,64),capMaterial,pan,1.410,3.43,0);cap.rotation.y=Math.PI/2;
const capEdge=tor(.713,.012,trimMat,pan,1.411,3.43,0);capEdge.rotation.y=Math.PI/2;

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
  const centered = new THREE.Group(); centered.name = 'OBSBOT Tiny 2 webcam and microphone'; centered.add(model);
  model.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);
  // Manufacturer's 47 × 44 × 62.02 mm envelope; GLB uses metres and a bottom anchor.
  centered.scale.set(.047/size.x,.06202/size.y,.044/size.z);
  centered.updateMatrixWorld(true);
  return centered;
}
