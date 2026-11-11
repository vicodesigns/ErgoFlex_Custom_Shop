import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {grooveDestination,segmentIsClear} from './room-groove.mjs';
import {CHILD_PERSONALITY_PALETTES} from './child-personality-detail.mjs';
import {earlyYearsProfile} from './early-years-profiles.mjs';

// The evidence of a year of living in the room: belongings, half-finished
// hobbies, clothes and bedding that change with the five activities. Every
// floor cluster is placed by measurement (room walls, registered furniture,
// the desk's swept travel envelope, glazing and curtains) and registers its own
// footprint; supported belongings sit on the bed, chair, cabinet, nightstand
// or project table they belong to. Each cluster is baked into one mesh per
// material so the extra life costs a handful of draw calls, not hundreds.
const PHASES=['morning','afternoon','evening','night','party'];
const ALL=PHASES,DAY=['morning','afternoon','party'],AWAKE=['morning','afternoon','evening','party'];
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};

export function enhanceChildLivedIn({room,root,layout:l,helpers:h,materials:m,groups,bounds=[]}){
 const age=l.ageStage||'early',early=age==='early',profile=earlyYearsProfile(l);
 const {material,markSceneAsset}=h,{bed,cubby,craft,rug}=groups;
 const W=l.width/2,front=l.back+l.depth,tier=l.tier||0;
 const pal=profile?.palette||CHILD_PERSONALITY_PALETTES[age]||CHILD_PERSONALITY_PALETTES.early;
 const own=t=>{(root.ownedTextures||=[]).push(t);return t;};
 const matCache=new Map();
 const fin=(color,roughness=.85,extra={})=>{const key=color+'|'+roughness+'|'+JSON.stringify(Object.keys(extra).filter(k=>k!=='map'));if(!extra.map&&matCache.has(key))return matCache.get(key);const mat=material(color,{roughness,metalness:0,...extra});mat.userData.roomFinishLocked=true;mat.userData.livedOwn=true;if(!extra.map)matCache.set(key,mat);return mat;};
 const canvasMap=(draw,w=256,hh=256)=>{const c=document.createElement('canvas');c.width=w;c.height=hh;draw(c.getContext('2d'),w,hh);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.needsUpdate=true;return own(t);};
 // Stage colours. Accent/second/feature/ink follow the personality palette, so
 // belongings coordinate with the walls without re-tinting anyone's textiles.
 const C={
  accent:fin(pal.accent,.8),second:fin(pal.second,.82),feature:fin(pal.feature,.8),ink:fin(pal.ink,.7),cloth:fin(pal.cloth,.97),
  cream:fin('#efe6d2',.92),white:fin('#f3f0e8',.8),paper:fin('#f4eddc',.97),denim:fin('#56708a',.95),grey:fin('#8d9294',.9),charcoal:fin('#2e3438',.6),
  black:fin('#202427',.45),rubber:fin('#2a2a2a',.9),sole:fin('#ebe6da',.8),wood:m.oak,steel:fin('#aab2b4',.3,{metalness:.85}),
  brass:fin('#c7a35c',.35,{metalness:.8}),leaf:fin('#5f8a5e',.85),leafDark:fin('#3f6b4c',.85),terracotta:fin('#b9714f',.9),
  red:fin('#c0584a',.75),yellow:fin('#e1b84a',.75),blue:fin('#5d86b5',.75),green:fin('#6fa37a',.75),pink:fin('#d99a9a',.95),
  plush:fin('#b98c66',.99),plushLight:fin('#e8d6bc',.99),rabbit:fin(age==='early'?'#e9dfcc':age==='primary'?'#e2d7c3':age==='preteen'?'#dacfba':'#d3c8b3',.99),
  cardboard:fin('#c6a57a',.95),glass:fin('#cfe3e6',.08,{transparent:true,opacity:.45,depthWrite:false}),screenOff:fin('#1d2328',.25)
 };
 // --- geometry helpers (room-local millimetres) -----------------------------
 const add=(p,geo,mat,at=[0,0,0],rot=null,scale=null)=>{const o=new THREE.Mesh(geo,mat);o.position.set(...at);if(rot)o.rotation.set(...rot);if(scale)o.scale.set(...scale);p.add(o);return o;};
 const rbox=(p,[x,y,z],at,mat,r=0,rot=null)=>add(p,r?roundedBox(x,y,z,Math.min(r,x/2-.5,y/2-.5,z/2-.5)):new THREE.BoxGeometry(x,y,z),mat,at,rot);
 const cyl=(p,r1,r2,hh,at,mat,rot=null,seg=18)=>add(p,new THREE.CylinderGeometry(r1,r2,hh,seg),mat,at,rot);
 const ball=(p,[sx,sy,sz],at,mat,rot=null)=>add(p,new THREE.SphereGeometry(1,18,12),mat,at,rot,[sx,sy,sz]);
 const tube=(p,points,r,mat,closed=false)=>add(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)),closed),Math.max(8,points.length*6),r,6,closed),mat);
 const lathe=(p,profileXY,at,mat,seg=22)=>add(p,new THREE.LatheGeometry(profileXY.map(([r,y])=>new THREE.Vector2(r,y)),seg),mat,at);
 const rod=(p,a,b,r,mat)=>{const s=new THREE.Vector3(...a),e=new THREE.Vector3(...b),d=e.clone().sub(s),o=add(p,new THREE.CylinderGeometry(r,r,d.length(),10),mat);o.position.copy(s).add(e).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
 function roundedBox(x,y,z,r){const g=new THREE.BoxGeometry(x,y,z,4,4,4),p=g.attributes.position,v=new THREE.Vector3(),hx=x/2-r,hy=y/2-r,hz=z/2-r;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const c=new THREE.Vector3(THREE.MathUtils.clamp(v.x,-hx,hx),THREE.MathUtils.clamp(v.y,-hy,hy),THREE.MathUtils.clamp(v.z,-hz,hz)),d=v.clone().sub(c);if(d.lengthSq()>1e-6)d.setLength(r);p.setXYZ(i,c.x+d.x,c.y+d.y,c.z+d.z);}g.computeVertexNormals();return g;}
 // A soft, irregular lump (clothes, cushions, plush bodies). The base is
 // flattened so it rests on its support at exactly y=at[1].
 const lump=(p,[sx,sy,sz],at,mat,seed=1,rough=.16,rotY=0)=>{let g=new THREE.IcosahedronGeometry(1,3);g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g);const pos=g.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const n=1+rough*Math.sin(v.x*4.3+seed)*Math.sin(v.z*3.7+seed*1.9)+rough*.6*Math.sin(v.y*6.1+seed*2.7);v.multiplyScalar(n);if(v.y<-.3)v.y=-.3+(v.y+.3)*.08;pos.setXYZ(i,v.x,v.y,v.z);}
  g.computeVertexNormals();g.computeBoundingBox();const bottom=g.boundingBox.min.y;const o=add(p,g,mat,[at[0],at[1]-bottom*sy,at[2]],[0,rotY,0],[sx,sy,sz]);return o;};
 // Cloth draped over a surface: a grid whose height follows a function.
 const sheet=(p,wid,dep,at,heightFn,mat,segX=24,segZ=18)=>{const g=new THREE.PlaneGeometry(wid,dep,segX,segZ);g.rotateX(-Math.PI/2);const pos=g.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,heightFn(x,z));}g.computeVertexNormals();return add(p,g,mat,at);};

 // --- belongings ------------------------------------------------------------
 const book=(p,at,[w,t,d],cover,rotY=0)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[w,2.5,d],[0,1.25,0],cover,.8);rbox(g,[w-7,t-5,d-8],[2,t/2,0],C.paper,1);rbox(g,[w,2.5,d],[0,t-1.25,0],cover,.8);rbox(g,[5,t,d],[-w/2+2.5,t/2,0],cover,1.5);return g;};
 const bookStack=(p,at,count,covers,seed=1,size=[180,24,240])=>{let y=at[1];for(let i=0;i<count;i++){const s=[size[0]-hash(seed+i)*40,size[1]+hash(seed*3+i)*10,size[2]-hash(seed*5+i)*40];book(p,[at[0]+(hash(seed+i*7)-.5)*18,y,at[2]+(hash(seed+i*9)-.5)*18],s,covers[i%covers.length],(hash(seed+i*11)-.5)*.5);y+=s[1];}return y;};
 const tentBook=(p,at,cover,rotY=0,w=150,d=210)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);for(const s of [-1,1]){const half=rbox(g,[w,6,d],[s*w*.48,24,0],cover,2);half.rotation.z=-s*.32;}rbox(g,[w*1.7,10,d-10],[0,8,0],C.paper,3);return g;};
 const openBook=(p,at,cover,rotY=0,w=290,d=210,map=null)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[w,4,d],[0,2,0],cover,1.5);for(const s of [-1,1]){const page=rbox(g,[w/2-6,8,d-10],[s*(w/4-2),8,0],C.paper,2);page.rotation.z=s*.05;}if(map)add(g,new THREE.PlaneGeometry(w-20,d-20),fin('#ffffff',.97,{map}),[0,13,0],[-Math.PI/2,0,0]);return g;};
 const mug=(p,at,mat,r=40,hh=95)=>{cyl(p,r,r*.92,hh,[at[0],at[1]+hh/2,at[2]],mat);cyl(p,r*.86,r*.86,2,[at[0],at[1]+hh-6,at[2]],C.charcoal);const hdl=add(p,new THREE.TorusGeometry(r*.55,r*.14,8,16,Math.PI*1.3),mat,[at[0]+r*1.05,at[1]+hh*.5,at[2]],[0,0,-Math.PI*.65]);return hdl;};
 const phone=(p,at,rotY=0,mat=C.black)=>{const g=rbox(p,[78,9,160],[at[0],at[1]+4.5,at[2]],mat,4);g.rotation.y=rotY;return g;};
 const cable=(p,pts,mat=C.white)=>tube(p,pts,3,mat);
 const headphones=(p,at,rotY=0,mat=C.charcoal,pad=C.cloth)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);add(g,new THREE.TorusGeometry(95,9,8,24,Math.PI),mat,[0,22,0],[-Math.PI/2+.25,0,0]);for(const s of [-1,1]){cyl(g,45,45,30,[s*95,22,0],mat,[0,0,Math.PI/2]);cyl(g,40,40,8,[s*76,22,0],pad,[0,0,Math.PI/2]);}return g;};
 const sneaker=(p,at,rotY,upper,seed=1)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[105,26,280],[0,13,0],C.sole,10);lump(g,[48,46,122],[0,24,-8],upper,seed,.06,0);rbox(g,[86,52,92],[0,40,-86],upper,22);rbox(g,[60,6,80],[0,74,30],C.white,3);return g;};
 const shoePair=(p,at,rotY,upper,seed=1,splay=.25)=>{sneaker(p,[at[0]-62,at[1],at[2]],rotY-splay*.3,upper,seed);sneaker(p,[at[0]+62,at[1],at[2]+(splay>.2?40:0)],rotY+splay,upper,seed+3);};
 const backpack=(p,at,rotY,body,trim,open=false,lying=false)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);
  if(lying){rbox(g,[300,130,400],[0,65,0],body,55);rbox(g,[220,40,190],[0,138,70],trim,18);if(open){rbox(g,[240,12,200],[0,150,-120],body,6).rotation.x=-.6;rbox(g,[200,30,140],[-20,170,-60],C.paper,4);}for(const s of [-1,1])tube(g,[[s*70,128,-170],[s*95,150,-40],[s*70,130,80]],11,trim);}
  else{rbox(g,[300,400,150],[0,200,0],body,60);rbox(g,[230,170,50],[0,140,85],trim,20);rbox(g,[160,8,4],[0,232,112],C.steel,2);tube(g,[[-60,390,-60],[-60,440,-40],[60,440,-40],[60,390,-60]],10,trim);for(const s of [-1,1])tube(g,[[s*90,370,-80],[s*120,200,-110],[s*90,30,-80]],13,trim);}
  return g;};
 const plushBear=(p,at,s,fur,muzzle,seated=true,rotY=0)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;g.scale.setScalar(s);p.add(g);
  ball(g,[85,95,75],[0,95,0],fur);ball(g,[72,66,64],[0,225,8],fur);for(const x of [-52,52]){ball(g,[24,24,14],[x,280,0],fur);ball(g,[13,13,8],[x,281,7],muzzle);}
  ball(g,[30,22,26],[0,212,62],muzzle);ball(g,[9,7,6],[0,222,86],C.charcoal);for(const x of [-24,24])ball(g,[6,6,4],[x,240,64],C.charcoal);
  for(const x of [-82,82])ball(g,[26,58,26],[x*1.05,120,22],fur,[0,0,x>0?-.5:.5]);
  for(const x of [-45,45])seated?ball(g,[32,30,58],[x,32,62],fur):ball(g,[30,58,30],[x,-30,0],fur);
  return g;};
 const rabbit=(p,at,s=1,rotY=0,slump=0)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.set(slump,rotY,0);g.scale.setScalar(s);p.add(g);
  ball(g,[70,90,58],[0,90,0],C.rabbit);ball(g,[58,55,52],[0,212,6],C.rabbit);for(const x of [-25,25]){const e=ball(g,[17,78,15],[x*1.3,310,0],C.rabbit,[0,0,x*.012]);ball(g,[9,58,6],[x*1.3,310,12],C.pink,[0,0,x*.012]);}
  for(const x of [-20,20])ball(g,[4,4,3],[x,222,52],C.charcoal);ball(g,[6,5,4],[0,205,57],C.pink);for(const x of [-60,60])ball(g,[22,50,22],[x,100,18],C.rabbit,[0,0,x>0?-.4:.4]);for(const x of [-35,35])ball(g,[26,24,48],[x,26,50],C.rabbit);
  return g;};
 const laptop=(p,at,rotY,open=true,screen=null,shell=C.grey)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[330,14,230],[0,7,0],shell,4);rbox(g,[300,1,140],[0,14.5,-20],C.charcoal,.4);
  if(open){const lid=new THREE.Group();lid.position.set(0,14,-115);lid.rotation.x=-.32;g.add(lid);rbox(lid,[330,225,8],[0,112,0],shell,4);if(screen){const s=add(lid,new THREE.PlaneGeometry(300,195),screen,[0,114,4.5]);s.userData.screen=true;}}else rbox(g,[330,8,230],[0,18,0],shell,4);return g;};
 const water=(p,at)=>{cyl(p,32,28,110,[at[0],at[1]+55,at[2]],C.glass);cyl(p,28,25,70,[at[0],at[1]+36,at[2]],fin('#b9d3d8',.1,{transparent:true,opacity:.35,depthWrite:false}));};
 const snackBowl=(p,at,r=110,fill=C.yellow,seed=4)=>{lathe(p,[[0,0],[r*.55,0],[r,r*.5],[r*.93,r*.5],[r*.5,r*.08],[0,r*.08]],at,C.second);for(let i=0;i<18;i++){const a=hash(seed+i)*Math.PI*2,rr=hash(seed*2+i)*r*.7;ball(p,[16,13,16],[at[0]+Math.cos(a)*rr,at[1]+r*.38+hash(i+seed)*18,at[2]+Math.sin(a)*rr],fill);}};
 const cup=(p,at,mat)=>cyl(p,36,28,110,[at[0],at[1]+55,at[2]],mat);
 const stickies=(p,at,mats,rotY=0)=>mats.forEach((mat,i)=>{const s=rbox(p,[76,3+i*0.01,76],[at[0]+i*30,at[1]+1.5+i*3.2,at[2]+(i%2)*26],mat,.8);s.rotation.y=rotY+i*.35;});
 const floorCushion=(p,at,mat,rotY=0,seed=1,size=[520,110,520])=>{const o=lump(p,size,at,mat,seed,.07);o.rotation.y=rotY;return o;};
 // Tall wooden toy chest: lid can hinge open.
 const toyChest=(p,at,rotY,open,col)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);if(open){rbox(g,[760,30,400],[0,30,0],col,6);for(const z of [-185,185])rbox(g,[760,345,30],[0,202,z],col,10);for(const x of [-365,365])rbox(g,[30,345,400],[x,202,0],col,10);}else rbox(g,[760,360,400],[0,195,0],col,14);for(const x of [-360,360])rbox(g,[40,30,410],[x,15,0],C.wood,6);rbox(g,[700,10,6],[0,250,201],C.wood,2);
  const lid=new THREE.Group();lid.position.set(0,375,-200);lid.rotation.x=open?-1.25:0;g.add(lid);rbox(lid,[780,32,420],[0,16,210],C.wood,10);return g;};
 const rockingHorse=(p,at,rotY,body,mane)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);
  for(const z of [-120,120]){const rocker=add(g,new THREE.TorusGeometry(900,16,8,30,.82),C.wood,[0,916,z],[0,0,-Math.PI/2-.41]);rocker.scale.set(1,1,1.4);}
  // Rockers touch the floor at their lowest point (centre, y=20).
  for(const x of [-250,0,250])rbox(g,[30,30,270],[x,30+Math.pow(x/900,2)*450,0],C.wood,6);
  for(const [x,z] of [[-200,-90],[-200,90],[200,-90],[200,90]])rod(g,[x,40+Math.pow(x/900,2)*450,z],[x*.7,330,z*.55],16,C.wood);
  rbox(g,[520,190,180],[0,410,0],body,80);
  // Carved head and neck in one profile: crest, forehead, long face, muzzle, jaw.
  const hs=new THREE.Shape();hs.moveTo(170,430);hs.bezierCurveTo(200,560,250,690,330,760);hs.bezierCurveTo(360,790,400,780,430,745);hs.lineTo(520,640);hs.bezierCurveTo(545,610,530,580,495,585);hs.lineTo(430,600);hs.bezierCurveTo(390,600,365,560,350,520);hs.bezierCurveTo(330,470,300,430,260,400);hs.closePath();
  const head=new THREE.ExtrudeGeometry(hs,{depth:110,bevelEnabled:true,bevelThickness:18,bevelSize:16,bevelSegments:3,curveSegments:14});head.translate(0,0,-55);add(g,head,body);
  for(const z of [-40,40]){const ear=add(g,new THREE.ConeGeometry(24,80,10),body,[355,800,z]);ear.rotation.z=-.35;}for(const z of [-74,74])ball(g,[12,12,6],[430,690,z],C.charcoal);ball(g,[8,6,6],[512,612,48],C.charcoal);ball(g,[8,6,6],[512,612,-48],C.charcoal);
  for(let i=0;i<11;i++){const t=i/10,x=200+t*160,y=480+t*300;ball(g,[34,30,22],[x-30,y+12,0],mane,[0,0,-.6]);}for(let i=0;i<5;i++)ball(g,[26,40,22],[-262-i*10,400-i*36,0],mane);
  rbox(g,[230,40,200],[-10,512,0],C.red,14);for(const z of [-1,1])rbox(g,[60,140,12],[-10,430,z*96],C.red,4);rod(g,[470,640,-62],[300,560,-80],5,C.charcoal);rod(g,[470,640,62],[300,560,80],5,C.charcoal);
  for(let i=0;i<7;i++)ball(g,[22,22,6],[-180+i*55,380+(i%2)*60,92],fin('#d8cdb8',.9));
  rod(g,[300,620,-95],[300,620,95],9,C.wood);return g;};
 const walker=(p,at,rotY,col,loaded)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[460,160,320],[0,170,0],col,16);rbox(g,[420,6,280],[0,252,0],C.wood,2);
  for(const x of [-170,170])for(const z of [-170,170])cyl(g,62,62,32,[x,62,z],C.wood,[Math.PI/2,0,0]);for(const z of [-150,150])rod(g,[-230,240,z],[-330,560,z],14,C.wood);rod(g,[-330,560,-150],[-330,560,150],18,C.wood);
  if(loaded)for(const [i,[x,z]] of [[-120,-70],[0,-70],[120,-70],[-60,70],[70,70]].entries())rbox(g,[95,95,95],[x,207+(i===4?0:0),z],[C.red,C.yellow,C.blue,C.green,C.accent][i],8);return g;};
 const rainbow=(p,at,rotY=0)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);[C.red,C.accent,C.yellow,C.green,C.blue].forEach((mat,i)=>{const r=140-i*24;add(g,new THREE.TorusGeometry(r,11,8,24,Math.PI),mat,[0,11,0]);});return g;};
 const stackingRings=(p,at)=>{cyl(p,70,70,20,[at[0],at[1]+10,at[2]],C.wood);rod(p,[at[0],at[1]+20,at[2]],[at[0],at[1]+230,at[2]],12,C.wood);[C.red,C.accent,C.yellow,C.green,C.blue].forEach((mat,i)=>add(p,new THREE.TorusGeometry(62-i*8,22-i*1.5,10,22),mat,[at[0],at[1]+42+i*38,at[2]],[Math.PI/2,0,0]));ball(p,[30,30,30],[at[0],at[1]+232,at[2]],C.red);};
 const softBall=(p,at,r,matA,matB)=>{ball(p,[r,r,r],[at[0],at[1]+r,at[2]],matA);add(p,new THREE.TorusGeometry(r*.92,r*.08,6,28),matB,[at[0],at[1]+r,at[2]],[0,.5,0]);add(p,new THREE.TorusGeometry(r*.92,r*.08,6,28),matB,[at[0],at[1]+r,at[2]],[Math.PI/2,0,.3]);};
 const soccer=(p,at,r=110)=>{ball(p,[r,r,r],[at[0],at[1]+r,at[2]],C.white);for(let i=0;i<9;i++){const th=hash(i+3)*Math.PI*2,ph=Math.acos(.2+.8*hash(i+17)),v=new THREE.Vector3(Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th));const d=add(p,new THREE.CircleGeometry(r*.28,5),C.charcoal,[at[0]+v.x*r*1.004,at[1]+r+v.y*r*1.004,at[2]+v.z*r*1.004]);d.lookAt(d.position.clone().add(v));}};
 const scooter=(p,at,rotY,col)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[560,28,130],[0,80,0],col,10);for(const x of [-300,300]){cyl(g,62,62,30,[x,62,0],C.rubber,[Math.PI/2,0,0]);cyl(g,26,26,34,[x,62,0],C.steel,[Math.PI/2,0,0]);}
  rod(g,[290,90,0],[330,800,0],15,C.steel);rod(g,[330,800,-220],[330,800,220],13,C.steel);for(const z of [-220,220])cyl(g,17,17,90,[330,800,z*0.86],C.charcoal,[Math.PI/2,0,0]);rod(g,[-250,85,40],[-200,20,120],5,C.steel);return g;};
 const skateboard=(p,at,rotY,deck,grip=C.charcoal)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[790,13,210],[0,85,0],deck,11);rbox(g,[760,2,190],[0,92.5,0],grip,1);for(const s of [-1,1]){const tail=rbox(g,[120,13,200],[s*425,98,0],deck,10);tail.rotation.z=s*.28;}
  for(const x of [-270,270]){rbox(g,[50,30,170],[x,60,0],C.steel,6);for(const z of [-80,80])cyl(g,27,27,32,[x,27,z],C.cream,[Math.PI/2,0,0]);}return g;};
 const beanbag=(p,at,mat,seed=5)=>{const g=new THREE.Group();g.position.set(...at);p.add(g);const b=lump(g,[400,260,380],[0,0,0],mat,seed,.07);const pos=b.geometry.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);if(y>0)pos.setY(i,y+Math.max(0,-z)*.55*y-Math.max(0,.45-x*x-z*z)*.5*y);}b.geometry.computeVertexNormals();return g;};
 const hamper=(p,at,open=true,clothes=[C.cloth,C.denim,C.white])=>{const g=new THREE.Group();g.position.set(...at);p.add(g);const basket=add(g,new THREE.CylinderGeometry(215,190,520,24,6,true),fin('#cdbb98',.98),[0,260,0]);basket.material.side=THREE.DoubleSide;cyl(g,190,190,10,[0,5,0],fin('#cdbb98',.98));
  for(let i=0;i<5;i++)add(g,new THREE.TorusGeometry(195+i*5,6,6,28),fin('#b29f7c',.98),[0,60+i*100,0],[Math.PI/2,0,0]);for(const s of [-1,1])add(g,new THREE.TorusGeometry(48,9,6,14,Math.PI),fin('#b29f7c',.98),[s*214,470,0],[0,Math.PI/2,0]);
  if(open){lump(g,[200,110,190],[0,430,0],clothes[0],7,.22);lump(g,[150,80,130],[60,500,-40],clothes[1],9,.25);const sl=tube(g,[[120,440,30],[190,520,40],[224,508,45],[232,420,50],[228,300,58]],20,clothes[2]);sl.scale.set(1,1,.55);}
  return g;};
 const duffel=(p,at,rotY,body,trim)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);const c=add(g,new THREE.CapsuleGeometry(118,330,6,14),body,[0,118,0],[0,0,Math.PI/2]);c.scale.set(1,1,.85);rbox(g,[340,10,36],[0,234,0],trim,4);tube(g,[[-120,222,0],[-70,320,0],[70,320,0],[120,222,0]],11,trim);tube(g,[[-230,170,50],[-130,70,120],[140,45,120],[260,120,50]],9,trim);return g;};
 const guitarStand=(p,at,rotY,body,neckMat=C.wood)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);
  // A-frame stand.
  for(const z of [-150,150])rod(g,[-140,12,z],[0,320,z*.2],10,C.black);rod(g,[150,12,0],[0,320,0],10,C.black);for(const z of [-60,60])rod(g,[0,320,z*.3],[30,180,z],8,C.black);
  rod(g,[0,320,0],[-100,980,0],8,C.black);
  // Offset double-cutaway body, extruded and leaning back on its neck rest.
  const s=new THREE.Shape();s.moveTo(0,-230);s.bezierCurveTo(170,-230,190,-80,140,-10);s.bezierCurveTo(115,30,135,95,160,150);s.bezierCurveTo(175,195,120,230,80,195);s.bezierCurveTo(50,170,30,160,0,160);s.bezierCurveTo(-30,160,-60,175,-95,200);s.bezierCurveTo(-140,225,-180,190,-160,140);s.bezierCurveTo(-140,90,-120,40,-140,-10);s.bezierCurveTo(-190,-80,-170,-230,0,-230);
  const guitar=new THREE.Group();guitar.position.set(-15,250,0);guitar.rotation.set(0,Math.PI/2,.0);g.add(guitar);const tilt=new THREE.Group();tilt.rotation.x=-.12;guitar.add(tilt);
  const bodyGeo=new THREE.ExtrudeGeometry(s,{depth:44,bevelEnabled:true,bevelThickness:5,bevelSize:6,bevelSegments:2,curveSegments:10});bodyGeo.translate(0,0,-22);add(tilt,bodyGeo,body,[0,0,0]);
  rbox(tilt,[140,200,4],[-20,-40,27],C.white,8);for(const y of [-100,-20])rbox(tilt,[80,18,6],[0,y,28],C.black,3);rbox(tilt,[60,22,8],[0,-160,28],C.steel,3);
  rbox(tilt,[54,620,22],[0,480,10],neckMat,6);rbox(tilt,[80,170,18],[0,860,8],neckMat,8);for(let i=0;i<6;i++)cyl(tilt,5,5,22,[(i<3?-1:1)*48,800+(i%3)*45,10],C.steel,[0,0,Math.PI/2]);
  for(let i=0;i<6;i++)rod(tilt,[-14+i*5.6,-160,32],[-12+i*4.8,780,24],.9,C.steel);
  return g;};
 const amp=(p,at,rotY,body)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[420,360,230],[0,180,0],body,14);rbox(g,[360,230,6],[0,155,116],fin('#3a3a36',.98),6);rbox(g,[380,40,6],[0,315,116],C.cream,4);for(let i=0;i<5;i++)cyl(g,9,9,14,[-140+i*48,315,124],C.black,[Math.PI/2,0,0]);rod(g,[-120,362,0],[120,362,0],10,C.black);return g;};
 const fridge=(p,at,rotY)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[460,500,460],[0,260,0],fin('#e5e2da',.5),12);for(const x of [-180,180])for(const z of [-180,180])cyl(g,12,12,10,[x,5,z],C.black);rbox(g,[452,4,6],[0,360,232],fin('#c9c5bb',.6),2);rbox(g,[24,120,22],[190,250,240],C.steel,6);
  // Round 3: magnets, a photo and a sticker on the door, a postcard on the side, so it reads as a fridge from any side.
  rbox(g,[110,140,2],[-90,390,233],C.paper,1);rbox(g,[92,96,1],[-90,398,234.5],C.second,.5);for(const [x,y,mat] of [[-150,455,C.red],[-30,455,C.yellow],[60,300,C.blue],[-120,180,C.green]])cyl(g,13,13,8,[x,y,236],mat,[Math.PI/2,0,0],12);cyl(g,34,34,2,[40,420,233],C.accent,[Math.PI/2,0,0],18);rbox(g,[2,110,150],[-232,330,-20],C.paper,1);rbox(g,[2,60,90],[-233.5,345,-20],C.feature,.5);
  // Kettle, two mugs and a tin of tea on top.
  lathe(g,[[0,0],[85,0],[95,60],[80,150],[45,175],[0,178]],[-90,510,-30],C.charcoal);rod(g,[-160,640,-30],[-140,560,-30],9,C.charcoal);rod(g,[-20,560,-30],[10,610,-30],8,C.charcoal);
  mug(g,[90,510,60],C.accent,38,90);mug(g,[140,510,-90],C.cream,36,86);cyl(g,45,45,120,[60,570,-150],C.second);return g;};
 const floorPlant=(p,at,potMat,seed=3,big=true)=>{const g=new THREE.Group();g.position.set(...at);p.add(g);lathe(g,[[0,0],[130,0],[160,300],[150,300],[0,300]],[0,0,0],potMat);cyl(g,145,145,6,[0,295,0],fin('#4e3d30',1));
  const n=big?11:7;for(let i=0;i<n;i++){const a=i*2.4+seed,len=big?(380+hash(i+seed)*420):(200+hash(i+seed)*180),out=big?(70+hash(i*3+seed)*110):(70+hash(i*3)*60),tip=[Math.cos(a)*out,300+len,Math.sin(a)*out];rod(g,[Math.cos(a)*20,300,Math.sin(a)*20],tip,5,C.leafDark);
   const leaf=ball(g,[big?105:70,10,big?75:48],tip,i%3?C.leaf:C.leafDark);leaf.rotation.set(.35*Math.sin(a*2),-a,.55);}return g;};
 // Trailing pothos: vines reach forward past the shelf lip, then fall.
 const pothos=(p,at,potMat,seed=2)=>{const g=new THREE.Group();g.position.set(...at);p.add(g);lathe(g,[[0,0],[55,0],[65,95],[0,95]],[0,0,0],potMat);cyl(g,58,58,4,[0,92,0],fin('#4e3d30',1));
  for(let k=0;k<4;k++){const pts=[],side=(k-1.5)*45;for(let i=0;i<8;i++){const t=i/7,fwd=Math.min(1,t/.38);pts.push([side*(.3+t)+Math.sin(seed+k+t*4)*12,105-(t>.42?(t-.42)*(300+k*60):0)+fwd*12,25+fwd*175]);}tube(g,pts,3,C.leafDark);pts.forEach((pt,i)=>{if(i)ball(g,[26,6,20],pt,i%2?C.leaf:C.leafDark,[0.5+i*.1,k+i,0.6]);});}
  for(let i=0;i<6;i++)ball(g,[28,7,22],[Math.cos(i*1.1)*35,118+i*6,Math.sin(i*1.1)*35],i%2?C.leaf:C.leafDark,[.3,i,.4]);return g;};
 const nightstand=(p,at,rotY,body,top=C.wood,hh=520)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);for(const x of [-160,160])for(const z of [-115,115])rod(g,[x,.45,z],[x*.95,hh-180,z*.95],14,top);rbox(g,[380,170,290],[0,hh-95,0],body,10);rbox(g,[400,24,310],[0,hh-12,0],top,6);rbox(g,[340,4,4],[0,hh-95,146],top,1);cyl(g,14,14,16,[0,hh-95,150],C.brass,[Math.PI/2,0,0]);rbox(g,[340,14,250],[0,150,0],top,4);return g;};
 const trophy=(p,at,metal=C.brass,s=1)=>{const g=new THREE.Group();g.position.set(...at);g.scale.setScalar(s);p.add(g);rbox(g,[90,40,90],[0,20,0],C.ink,4);cyl(g,10,14,60,[0,70,0],metal);lathe(g,[[0,0],[18,0],[42,30],[50,85],[44,85],[0,20]],[0,100,0],metal);for(const s2 of [-1,1])add(g,new THREE.TorusGeometry(20,4,6,12,Math.PI),metal,[s2*48,155,0],[0,0,s2*Math.PI/2]);return g;};
 const medal=(p,at,ribbon,metal=C.brass)=>{tube(p,[[at[0]-25,at[1]+190,at[2]],[at[0]-6,at[1]+40,at[2]+2],[at[0],at[1]+30,at[2]+2]],4,ribbon);tube(p,[[at[0]+25,at[1]+190,at[2]],[at[0]+6,at[1]+40,at[2]+2]],4,ribbon);cyl(p,30,30,5,[at[0],at[1]+12,at[2]+4],metal,[Math.PI/2,0,0]);};
 const pizzaBox=(p,at,rotY,open)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[380,40,380],[0,20,0],C.cardboard,3);if(open){const lid=new THREE.Group();lid.position.set(0,40,-190);lid.rotation.x=-1.9;g.add(lid);rbox(lid,[380,5,380],[0,0,190],C.cardboard,2);cyl(g,170,170,4,[0,42,0],fin('#d9a35c',.9),null,24);for(let i=0;i<9;i++)cyl(g,22,22,3,[Math.cos(i*2.1)*90*hash(i+1),44,Math.sin(i*2.1)*90*hash(i+5)],C.red,null,12);}else rbox(g,[380,5,380],[0,42,0],C.cardboard,2);return g;};
 const crate=(p,at,rotY,count,covers)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);for(const x of [-170,170])rbox(g,[18,330,330],[x,165,0],C.wood,3);rbox(g,[358,16,330],[0,8,0],C.wood,3);for(const z of [-160,160])for(const y of [60,250])rbox(g,[340,60,14],[0,y,z],C.wood,3);
  for(let i=0;i<count;i++){const s=rbox(g,[6,300,300],[-140+i*(280/count),168,0],covers[i%covers.length],1);s.rotation.z=(hash(i+2)-.5)*.12+(i===count-1?.35:0);}return g;};
 const sleeveArt=(i)=>canvasMap((c,w,hh)=>{const cols=[[pal.accent,pal.ink],[pal.second,'#efe3c8'],[pal.feature,pal.ink],['#2f3a44',pal.accent]][i%4];c.fillStyle=cols[0];c.fillRect(0,0,w,hh);c.fillStyle=cols[1];if(i%4===0){c.beginPath();c.arc(w*.5,hh*.5,w*.3,0,7);c.fill();c.fillStyle=cols[0];c.beginPath();c.arc(w*.5,hh*.5,w*.05,0,7);c.fill();}else if(i%4===1){for(let k=0;k<6;k++)c.fillRect(0,hh*(.12+k*.14),w*(.3+hash(k+i)*.6),hh*.06);}else if(i%4===2){c.beginPath();c.moveTo(0,hh);c.lineTo(w*.5,hh*.25);c.lineTo(w,hh);c.fill();}else{c.lineWidth=6;c.strokeStyle=cols[1];for(let k=0;k<5;k++){c.beginPath();c.arc(w*.3,hh*.7,40+k*30,-1.6,0);c.stroke();}}c.font='bold 22px sans-serif';c.fillStyle=cols[1];c.fillText(['NIGHT BUS','SLOW TIDE','PAPER SUNS','LOW HUM'][i%4],14,hh-16);},256,256);
 const sleeveMats=new Map(),sleeveMat=i=>{i=((i%4)+4)%4;if(!sleeveMats.has(i))sleeveMats.set(i,fin('#ffffff',.9,{map:sleeveArt(i)}));return sleeveMats.get(i);};
 const puzzle=(p,at,rotY)=>{const map=canvasMap((c,w,hh)=>{c.fillStyle='#e8dcc2';c.fillRect(0,0,w,hh);const g=c.createLinearGradient(0,0,0,hh);g.addColorStop(0,'#8fb6c8');g.addColorStop(.6,'#cfe0d6');g.addColorStop(1,'#87a77d');c.fillStyle=g;c.fillRect(0,0,w*.72,hh*.8);c.fillStyle='#e7c45b';c.beginPath();c.arc(w*.5,hh*.25,28,0,7);c.fill();c.fillStyle='#5b7f62';c.beginPath();c.moveTo(0,hh*.8);c.lineTo(w*.25,hh*.45);c.lineTo(w*.45,hh*.8);c.fill();c.strokeStyle='rgba(60,60,50,.35)';c.lineWidth=2;for(let x=0;x<w*.72;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,hh*.8);c.stroke();}for(let y=0;y<hh*.8;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w*.72,y);c.stroke();}},256,256);
  const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[520,4,520],[0,2,0],C.cardboard,1);add(g,new THREE.PlaneGeometry(512,512),fin('#ffffff',.95,{map}),[0,4.2,0],[-Math.PI/2,0,0]);
  for(let i=0;i<12;i++)rbox(g,[30,4,30],[300+hash(i)*160,2,-200+hash(i+40)*400],[C.green,C.blue,C.yellow,C.leaf][i%4],1).rotation.y=hash(i+9)*3;rbox(g,[260,60,190],[340,30,240],C.cardboard,3);return g;};
 const brickBuild=(p,at,rotY,size=1)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;g.scale.setScalar(size);p.add(g);rbox(g,[400,8,400],[0,4,0],C.green,1);const cols=[C.red,C.yellow,C.blue,C.white,C.accent];
  // A small house going up: four walls of staggered bricks, one wall unfinished.
  for(let y=0;y<5;y++)for(let i=0;i<4;i++){const off=y%2?16:0;rbox(g,[64,38,32],[-110+i*68+off,27+y*38,-110],cols[(y+i)%5],2);if(y<3||i<2)rbox(g,[64,38,32],[-110+i*68+off,27+y*38,110],cols[(y+i+2)%5],2);rbox(g,[32,38,64],[-150,27+y*38,-60+i*58-off],cols[(y+i+1)%5],2);if(y<4)rbox(g,[32,38,64],[150,27+y*38,-60+i*58-off],cols[(y+i+3)%5],2);}
  rbox(g,[340,14,90],[0,227,-60],C.red,2);
  // Loose bricks and a tipped bin beside the plate.
  for(let i=0;i<14;i++){const b=rbox(g,[64,38,32],[300+hash(i)*220,19,-150+hash(i+20)*360],cols[i%5],2);b.rotation.y=hash(i+33)*3;}
  const bin=cyl(g,120,110,180,[330,120,-260],C.blue,[0,0,1.25]);return g;};
 const boardGame=(p,at,rotY,players=3)=>{const map=canvasMap((c,w,hh)=>{c.fillStyle='#efe2c4';c.fillRect(0,0,w,hh);c.strokeStyle=pal.ink;c.lineWidth=5;c.beginPath();for(let i=0;i<=40;i++){const t=i/40,x=w*(.15+.7*t),y=hh*(.5+.32*Math.sin(t*Math.PI*3));i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();for(let i=0;i<20;i++){const t=i/19;c.fillStyle=[pal.accent,pal.second,pal.feature][i%3];c.beginPath();c.arc(w*(.15+.7*t),hh*(.5+.32*Math.sin(t*Math.PI*3)),11,0,7);c.fill();}c.fillStyle=pal.ink;c.font='bold 26px sans-serif';c.fillText('RIVER RACE',18,34);},256,256);
  const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[520,8,520],[0,4,0],C.ink,2);add(g,new THREE.PlaneGeometry(500,500),fin('#ffffff',.95,{map}),[0,8.3,0],[-Math.PI/2,0,0]);
  for(let i=0;i<players;i++){cyl(g,14,20,36,[-140+i*60,26,-120+i*80],[C.red,C.blue,C.yellow,C.green][i]);ball(g,[14,14,14],[-140+i*60,52,-120+i*80],[C.red,C.blue,C.yellow,C.green][i]);}
  rbox(g,[40,40,40],[180,28,180],C.white,6);rbox(g,[300,50,300],[-360,25,220],C.ink,3);return g;};
 const sleepingBag=(p,at,rotY,body,lining)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[700,70,1500],[0,35,0],body,30);rbox(g,[690,20,420],[0,78,-480],lining,10);const fold=rbox(g,[700,46,300],[0,95,-180],body,20);fold.rotation.x=.05;lump(g,[230,60,150],[0,70,-600],C.white,11,.06);return g;};
 const yogaMat=(p,at,rotY,col)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[610,5,1650],[0,2.5,0],col,2);cyl(g,58,58,610,[0,58,-850],col,[0,0,Math.PI/2]);rbox(g,[100,150,230],[220,75,620],C.cream,10);cyl(g,36,36,250,[-200,125,640],C.steel);return g;};
 const lunchbox=(p,at,rotY,col)=>{const g=rbox(p,[240,120,170],[at[0],at[1]+60,at[2]],col,14);g.rotation.y=rotY;rbox(p,[100,22,14],[at[0],at[1]+132,at[2]],C.charcoal,6);};
 const juiceBox=(p,at)=>{rbox(p,[50,100,35],[at[0],at[1]+50,at[2]],C.yellow,3);rod(p,[at[0]+10,at[1]+100,at[2]],[at[0]+18,at[1]+150,at[2]],2.5,C.red);};
 const apple=(p,at,mat=C.red)=>{ball(p,[38,36,38],[at[0],at[1]+34,at[2]],mat);rod(p,[at[0],at[1]+66,at[2]],[at[0]+3,at[1]+82,at[2]],3,C.wood);};
 const chipBag=(p,at,rotY,col)=>lump(p,[70,25,95],at,col,21,.12,rotY);
 const highlighters=(p,at,rotY=0)=>[C.yellow,C.green,C.pink].forEach((mat,i)=>{const o=cyl(p,9,9,130,[at[0]+i*24,at[1]+9,at[2]+i*6],mat,[Math.PI/2,0,rotY+i*.15]);o.rotation.order='YXZ';});
 const charger=(p,at,pts)=>{rbox(p,[70,26,70],[at[0],at[1]+13,at[2]],C.white,6);cable(p,pts);};
 const flashlight=(p,at,rotY)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);cyl(g,20,20,170,[0,22,0],C.yellow,[0,0,Math.PI/2]);cyl(g,30,24,40,[100,30,0],C.yellow,[0,0,Math.PI/2]);cyl(g,26,26,2,[121,30,0],fin('#fff7da',.4,{emissive:'#ffe9b0',emissiveIntensity:.25}),[0,0,Math.PI/2]);return g;};
 const alarmClock=(p,at)=>{cyl(p,60,60,45,[at[0],at[1]+75,at[2]],C.accent,[Math.PI/2,0,0]);cyl(p,52,52,2,[at[0],at[1]+75,at[2]+24],C.white,[Math.PI/2,0,0]);for(const s of [-1,1]){ball(p,[24,18,20],[at[0]+s*38,at[1]+135,at[2]],C.brass);rod(p,[at[0]+s*30,at[1]+30,at[2]],[at[0]+s*40,at[1],at[2]],5,C.charcoal);}rod(p,[at[0],at[1]+75,at[2]+26],[at[0]+28,at[1]+95,at[2]+26],2.5,C.charcoal);};
 const glasses=(p,at,rotY=0)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);for(const x of [-30,30])add(g,new THREE.TorusGeometry(24,3,6,18),C.charcoal,[x,4,0],[Math.PI/2,0,0]);rod(g,[-8,4,0],[8,4,0],2.5,C.charcoal);for(const x of [-54,54])rod(g,[x,4,0],[x*1.05,4,-120],2.5,C.charcoal);};
 const figurine=(p,at,body,head)=>{cyl(p,22,26,60,[at[0],at[1]+30,at[2]],body);ball(p,[34,32,32],[at[0],at[1]+88,at[2]],head);for(const x of [-12,12])ball(p,[4,5,3],[at[0]+x,at[1]+92,at[2]+30],C.charcoal);};
 const rocks=(p,at)=>{rbox(p,[260,36,110],[at[0],at[1]+18,at[2]],C.cardboard,4);for(let i=0;i<10;i++){const x=at[0]-105+(i%5)*52,z=at[2]-25+Math.floor(i/5)*50;lump(p,[18+hash(i)*7,14+hash(i+3)*6,18],[x,at[1]+30,z],[C.grey,fin('#b8a58e',.9),fin('#7d8b8c',.6),C.terracotta,C.cream][i%5],i+2,.25);}};
 const cassettes=(p,at,count)=>{for(let i=0;i<count;i++){rbox(p,[110,17,70],[at[0]+(hash(i)-.5)*10,at[1]+8.5+i*17,at[2]+(hash(i+4)-.5)*8],[C.ink,C.accent,C.second,C.charcoal][i%4],2).rotation.y=(hash(i+9)-.5)*.3;rbox(p,[96,2,40],[at[0],at[1]+17+i*17,at[2]],C.cream,.5);}};
 const candle=(p,at,col=C.cream)=>{cyl(p,40,40,80,[at[0],at[1]+40,at[2]],col);cyl(p,42,42,6,[at[0],at[1]+3,at[2]],C.brass);rod(p,[at[0],at[1]+80,at[2]],[at[0],at[1]+92,at[2]],1.5,C.charcoal);};
 const frame=(p,at,rotY,mat,w=130,hh=170)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);const f=rbox(g,[w,hh,14],[0,hh/2,0],C.wood,3);f.rotation.x=-.12;const ph=add(g,new THREE.PlaneGeometry(w-26,hh-26),mat,[0,hh/2+1,8]);ph.rotation.x=-.12;return g;};
 const craftCart=(p,at,rotY,stocked)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);const frameMat=C.second;for(const x of [-190,190])for(const z of [-130,130]){rod(g,[x,45,z],[x,760,z],9,frameMat);ball(g,[24,24,24],[x,24,z],C.black);}
  for(const [i,y] of [110,380,650].entries()){rbox(g,[420,10,300],[0,y,0],frameMat,3);for(const z of [-150,150])rbox(g,[420,70,6],[0,y+35,z],frameMat,2);for(const x of [-210,210])rbox(g,[6,70,300],[x,y+35,0],frameMat,2);
   if(i===0){lump(g,[110,60,90],[-110,y+5,0],C.accent,3);lump(g,[90,55,80],[50,y+5,40],C.feature,4);ball(g,[60,60,60],[140,y+65,-60],C.second);}
   if(i===1){for(let k=0;k<12;k++)cyl(g,8,8,120,[-150+k*14,y+60,-60+(k%3)*30],[C.red,C.yellow,C.blue,C.green,C.pink,C.accent][k%6]);rbox(g,[190,40,240],[90,y+25,0],C.paper,3);}
   if(i===2){rbox(g,[300,22,220],[0,y+11,0],C.paper,2);if(stocked){for(let k=0;k<4;k++)ball(g,[45,40,45],[-120+k*80,y+48,-40+(k%2)*60],[C.pink,C.yellow,C.second,C.accent][k]);}}}
  if(stocked){rod(g,[210,760,0],[260,820,0],4,C.charcoal);}return g;};

 // --- groups and phases -------------------------------------------------------
 const floorIds=[],clusters=[],looseNodes=[],phaseNodes=[];
 const phase=(parent,phases,name='')=>{const g=new THREE.Group();g.name=name||'Lived-in · '+phases.join('/');g.userData.livedPhases=phases;parent.add(g);phaseNodes.push(g);return g;};
 const loose=g=>{g.userData.livedLoose=true;looseNodes.push(g);return g;};
 const fixture=(parent,id,name,at=[0,0,0],turn=0)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;g.userData.childLivedIn=age;markSceneAsset(g,{key:`childroom:${l.id}:fixture:${id}`});return g;};
 // Merge everything below a phase group (but not inside a nested phase group)
 // into one mesh per material.
 const ownerPhase=o=>{let a=o.parent;while(a&&!a.userData.livedPhases)a=a.parent;return a;};
 const hasMesh=o=>{let f=false;o.traverse(c=>{if(c.isMesh)f=true;});return f;};
 // Plain opaque belongings share one vertex-coloured material per finish band
 // (matte / satin / metal), so a phase costs two or three draws, not twenty.
 // Textured, glowing, transparent, double-sided and shared room materials
 // (oak, the quilt) keep their own material so palette changes still reach them.
 const paintKey=mat=>{if(!mat.userData.livedOwn||mat.map||mat.transparent||mat.side!==THREE.FrontSide||mat.emissiveIntensity>0&&!mat.emissive.equals(new THREE.Color(0,0,0)))return mat;return 'paint|'+(mat.metalness>.5?'metal':mat.roughness<.45?'gloss':mat.roughness<.88?'satin':'matte');};
 const paints=new Map(),paintMat=key=>{if(!paints.has(key)){const band=key.split('|')[1],mat=material('#ffffff',{vertexColors:true,roughness:{metal:.3,gloss:.35,satin:.72,matte:.95}[band],metalness:band==='metal'?.85:0});mat.userData.roomFinishLocked=true;mat.name='Lived-in · '+band;paints.set(key,mat);}return paints.get(key);};
 const bake=group=>{group.updateMatrixWorld(true);const inv=group.matrixWorld.clone().invert(),buckets=new Map(),drop=[];
  group.traverse(o=>{if(!o.isMesh||ownerPhase(o)!==group)return;let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const k of Object.keys(g.attributes))if(!['position','normal','uv',...(o.material.vertexColors?['color']:[])].includes(k))g.deleteAttribute(k);if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!g.attributes.normal)g.computeVertexNormals();
   g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));const key=paintKey(o.material);if(key!==o.material){const c=o.material.color,n=g.attributes.position.count,col=new Float32Array(n*3);for(let i=0;i<n;i++){col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(col,3));}if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(g);drop.push(o);});
  for(const o of drop){o.removeFromParent();o.geometry.dispose();}
  for(let pass=0;pass<5;pass++)group.traverse(o=>{if(o!==group&&!o.isMesh&&!o.userData.livedPhases&&!hasMesh(o))o.userData.livedDrop=true;});
  const dead=[];group.traverse(o=>{if(o.userData.livedDrop)dead.push(o);});dead.forEach(o=>o.removeFromParent());
  for(const [key,list] of buckets){const merged=mergeGeometries(list,false);list.forEach(g=>g.dispose());if(!merged)continue;const mat=typeof key==='string'?paintMat(key):key;const o=new THREE.Mesh(merged,mat);o.castShadow=!mat.transparent;o.receiveShadow=true;o.name='Lived-in · '+group.name;if(mat.userData.lampShade)o.userData.lampShade=true;group.add(o);}};
 const bakeAll=g=>{const parts=[];g.traverse(o=>{if(o.userData.livedPhases)parts.push(o);});parts.reverse().forEach(bake);};

 // --- measured placement --------------------------------------------------------
 // A floor cluster is accepted only where it is inside the room, clear of every
 // registered furnishing (40 mm), clear of the play mat, away from glazing and
 // curtains when tall, and where every authored desk route stays clear of it
 // (the same swept-footprint test the room test applies, with extra margin).
 const deskFoot={halfWidth:l.desktopSize==='60x30'?762:610,halfDepth:381,margin:45+80};
 const poses=[{x:l.desk[0],z:l.desk[1],yaw:0},...PHASES.map(p=>grooveDestination('childroom',l,p))];
 const roomRect={minX:-W,maxX:W,minZ:l.back,maxZ:front};
 const rugHalf=[(tier?2200:1750)/2,(tier?1700:1300)/2],rugRect={minX:l.play[0]-rugHalf[0],maxX:l.play[0]+rugHalf[0],minZ:l.play[1]-rugHalf[1],maxZ:l.play[1]+rugHalf[1]};
 // Rug spots are authored for the 2200 × 1700 mat (its camera-facing half,
 // clear of the project seat) and scale with the compact mat.
 const R=(x,z)=>[x*rugHalf[0]/1100,0,z*rugHalf[1]/850];
 const windowZ=l.back+1500,glazing={minX:W-700,maxX:W,minZ:windowZ-750-420,maxZ:windowZ+750+420};
 const overlaps=(a,b,margin=0)=>a.minX<b.maxX+margin&&a.maxX>b.minX-margin&&a.minZ<b.maxZ+margin&&a.maxZ>b.minZ-margin;
 const furniture=()=>bounds.map(b=>({id:b.id,minX:b.x-b.halfWidth,maxX:b.x+b.halfWidth,minZ:b.z-b.halfDepth,maxZ:b.z+b.halfDepth}));
 const routesClear=r=>{for(const a of poses)for(const b of poses)if(!segmentIsClear(a,b,{minX:-1e9,maxX:1e9,minZ:-1e9,maxZ:1e9},[r],deskFoot))return false;return true;};
 // Vertex-exact bounds in room millimetres (arc and rotated parts have loose
 // geometry boxes, which would read as sinking into the floor).
 const extent=g=>{root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),box=new THREE.Box3(),v=new THREE.Vector3(),mtx=new THREE.Matrix4();g.traverse(o=>{if(!o.isMesh)return;mtx.multiplyMatrices(inv,o.matrixWorld);const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++)box.expandByPoint(v.fromBufferAttribute(pos,i).applyMatrix4(mtx));});return box;};
 const why=(r,{tall=false,onRug=false}={})=>[r.minX>=-W+60&&r.maxX<=W-60&&r.minZ>=l.back+60&&r.maxZ<=front-60?'':'walls',furniture().filter(f=>overlaps(r,f,40)).map(f=>f.id).join('+'),(onRug||!overlaps(r,rugRect,-120))?'':'rug',!(tall&&overlaps(r,glazing))?'':'glazing',routesClear(r)?'':'route'].filter(Boolean).join(' ');
 const clearOf=(r,{tall=false,onRug=false}={})=>r.minX>=-W+60&&r.maxX<=W-60&&r.minZ>=l.back+60&&r.maxZ<=front-60&&!furniture().some(f=>overlaps(r,f,40))&&(onRug||!overlaps(r,rugRect,tier?-120:-260))&&!(tall&&overlaps(r,glazing))&&doorClear(r)&&routesClear(r);
 // Stay clear of the walls layer's own fixtures (root.userData.childWallLife.rects:
 // u along the wall, v height) wherever a cluster comes within 260 mm of a wall.
 // The walls layer's decor door (right wall): keep its swing zone free.
 const doorClear=r=>{const d=root.userData.childWallLife?.door;if(!d||d.wall!=='right')return true;return !overlaps(r,{minX:W-600,maxX:W,minZ:d.u-520,maxZ:d.u+520});};
 const wallClear=b=>{const rects=root.userData.childWallLife?.rects;if(!rects)return true;const hit=(list,u0,u1)=>(list||[]).some(o=>o.v0>150&&!/skirting|window|curtain|switch/.test(o.id)&&u0<o.u1+20&&u1>o.u0-20&&b.max.y>o.v0-20);
  return !(b.max.x>W-260&&hit(rects.right,b.min.z,b.max.z))&&!(b.min.z<l.back+260&&hit(rects.rear,b.min.x,b.max.x))&&!(b.min.x<-W+260&&hit(rects.left,-b.max.z,-b.min.z));};
 const detach=list=>list.splice(0,list.length,...list.filter(n=>{let inside=false;n.traverseAncestors(a=>{if(a===root)inside=true;});return inside;}));
 // The cluster is built once at the origin and measured (vertex-exact), so
 // candidate screening uses its true extent; the same group is then moved to
 // the first candidate that passes and re-measured there before it is kept.
 function placeFloor(id,name,candidatesFor,build,{tall=false,front=true}={}){
  const g=fixture(root,id,name,[0,0,0],0);build(g);const b0=extent(g),rel=[b0.min.x,b0.max.x,b0.min.z,b0.max.z];
  const nominal=(x,z,turn)=>{const t=turned(rel,turn);return {minX:x+t[0],maxX:x+t[1],minZ:z+t[2],maxZ:z+t[3]};};
  let tries=0;
  if(Math.abs(b0.min.y)<1)for(const [x,z,turn=0] of candidatesFor(rel).concat(front?frontAnchors(rel,0):[],front?frontAnchors(rel,Math.PI):[])){if(!clearOf(nominal(x,z,turn),{tall}))continue;if(++tries>6)break;
   g.position.set(x,0,z);g.rotation.y=turn;const b=extent(g),r={minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z};
   if(Math.abs(b.min.y)<1&&clearOf(r,{tall})&&wallClear(b)){bakeAll(g);const fb=extent(g);bounds.push({id,x:(fb.min.x+fb.max.x)/2,z:(fb.min.z+fb.max.z)/2,halfWidth:(fb.max.x-fb.min.x)/2+2,halfDepth:(fb.max.z-fb.min.z)/2+2});floorIds.push(id);clusters.push(g);return g;}}
  g.removeFromParent();g.traverse(o=>{if(o.isMesh)o.geometry.dispose();});detach(phaseNodes);detach(looseNodes);
  return null;}
 const bedFoot=l.bed[1]+1060,bedRight=l.bed[0]+590,bedLeftWall=-W+70;
 // Foot of the bed: rows that step away from the footboard, columns ordered
 // from the bed's centre line outward. Right wall: beyond the curtains.
 const turned=(rel,turn)=>{const c=Math.round(Math.cos(turn)),s=Math.round(Math.sin(turn)),pts=[[rel[0],rel[2]],[rel[1],rel[2]],[rel[0],rel[3]],[rel[1],rel[3]]].map(([u,v])=>[u*c+v*s,-u*s+v*c]);return [Math.min(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[1]))];};
 const footAnchors=(rel0,turn=0)=>{const rel=turned(rel0,turn),out=[],w=rel[1]-rel[0],xs=[];for(let x=bedLeftWall-rel[0]+10;x+rel[1]<=bedRight+260;x+=50)xs.push(x);xs.sort((a,b)=>Math.abs(a+(rel[0]+rel[1])/2-l.bed[0])-Math.abs(b+(rel[0]+rel[1])/2-l.bed[0]));for(let z=bedFoot+60-rel[2];z<=bedFoot+60-rel[2]+900;z+=60)for(const x of xs)out.push([x,z,turn]);return w?out:out;};
 // Front strip: along the open (camera) edge, between the nook and cabinet.
 const frontAnchors=(rel0,turn=0,prefer=l.play[0]+500)=>{const rel=turned(rel0,turn),out=[];const xs=[];for(let x=-W+60-rel[0];x+rel[1]<=W-60;x+=50)xs.push(x);xs.sort((a,b)=>Math.abs(a-prefer)-Math.abs(b-prefer));for(let z=front-70-rel[3];z>=front-70-rel[3]-300;z-=60)for(const x of xs)out.push([x,z,turn]);return out;};
 const rightAnchors=(rel0,tall,turn=0)=>{const rel=turned(rel0,turn),out=[];for(let z=l.back+(tall?2700:2350)-rel[2];z+rel[3]<front-60;z+=60)for(const off of [80,140,220])out.push([W-off-rel[1],z,turn]);return out;};
 // Rug clusters: built where they sit, then kept only if clear of furniture.
 const rugClear=g=>{const b=extent(g);if(b.isEmpty())return true;const r={minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z};return r.minX>=-W+40&&r.maxX<=W-40&&r.minZ>=l.back+40&&r.maxZ<=front-40&&!furniture().some(f=>overlaps(r,f,30));};
 const settleRug=r=>{for(const g of [...r.children])if(g.userData.livedPhases&&!rugClear(g)){const shifts=[[0,120],[160,0],[-160,0],[0,240],[300,0],[-300,0]];let ok=false;for(const [dx,dz] of shifts){g.position.set(dx,0,dz);if(rugClear(g)){ok=true;break;}}if(!ok){g.removeFromParent();g.traverse(o=>{if(o.isMesh)o.geometry.dispose();});}}detach(phaseNodes);detach(looseNodes);bakeAll(r);};

 // --- stage recipes: the five people ------------------------------------------------
 const covers=[C.accent,C.second,C.ink,C.feature,C.cloth,C.denim];
 const quilt=bed?.children.find(o=>o.isMesh&&Math.abs(o.position.y-361)<.1);
 const quiltY=(x,z)=>377+4*Math.sin(x*.009)*Math.sin((z+230)*.009)-5*Math.pow(Math.min(1,Math.abs(x)/555),10)-3*Math.pow(Math.min(1,Math.abs(z-300)/660),10);
 // A duvet kicked down toward the foot: soft diagonal folds that rise out of
 // the quilt surface and settle back into it at every edge.
 // A duvet thrown back toward the foot: one clean, fat roll with a smooth
 // incline behind it, in a plain cloth that copies the quilt's colour (the
 // quilt's printed map, stretched over folds, read as a blotch at the wide camera).
 const duvetCloth=material('#ffffff',{roughness:.95,metalness:0});duvetCloth.userData.roomFinishLocked=true;duvetCloth.side=THREE.DoubleSide;
 const kickedDuvet=(p,height=70,seed=1,cx=0,cz=430)=>{const g=new THREE.Group();p.add(g);const rollZ=cz+120,r=Math.max(55,height*.9);
  const geo=new THREE.CapsuleGeometry(r,940,8,16);geo.rotateZ(Math.PI/2);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i);pos.setZ(i,pos.getZ(i)+38*Math.sin(x/230+seed)+(x>0?x*.06:0));pos.setY(i,pos.getY(i)*.72);}geo.computeVertexNormals();
  add(g,geo,duvetCloth,[cx,quiltY(cx,rollZ)+r*.72+2,rollZ]);
  sheet(g,1000,300,[cx,0,cz-80],(x,z)=>{const t=Math.max(0,Math.min(1,(z+150)/300));return quiltY(x+cx,z+cz-80)+4+t*t*r*1.15+6*Math.sin(x*.012+seed)*t;},duvetCloth,30,12);
  g.userData.livedDuvet=true;return g;};
 const bedTop=(x,z)=>quiltY(x,z)+1;
 const screenMat=(kind)=>{const map=canvasMap((c,w,hh)=>{c.fillStyle=kind==='music'?'#1f2a33':'#f1eee6';c.fillRect(0,0,w,hh);if(kind==='music'){for(let t=0;t<6;t++){c.fillStyle=[pal.accent,pal.second,pal.feature][t%3];c.fillRect(16,20+t*26,40+hash(t)*150,16);}c.strokeStyle='#e9e3d4';c.lineWidth=2;c.beginPath();for(let x=0;x<w;x+=4)c.lineTo(x,hh*.82+Math.sin(x*.21)*10*hash(x));c.stroke();}else{c.fillStyle='#d9d4c7';c.fillRect(0,0,w,18);c.fillStyle=pal.ink;for(let t=0;t<9;t++)c.fillRect(20,32+t*14,(t%3===0?120:200)-hash(t)*60,6);c.fillStyle=pal.second;c.fillRect(w*.62,34,w*.3,hh*.4);}},256,170);return fin('#ffffff',.5,{map,emissive:'#ffffff',emissiveMap:map,emissiveIntensity:.32});};
 const bedLayer=bed?fixture(bed,'lived-bed-'+age,'Bed as it was left · '+age):null;
 const chair=(()=>{let s;root.traverse(o=>{if(o.userData.propId==='desk-stool')s=o;});return s;})();
 const drape=(p,col,hood=true)=>{// Clothes over the study-chair backrest.
  const g=new THREE.Group();p.add(g);const path=[[640,-150],[860,-158],[922,-185],[922,-235],[880,-262],[560,-268]],pts=path.map(([y,z])=>new THREE.Vector2(z,y)),curve=new THREE.SplineCurve(pts);
  const geo=new THREE.PlaneGeometry(410,1,14,30),pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),t=(pos.getY(i)+.5);const q=curve.getPoint(t),wave=Math.sin(x*.03+t*5)*5*(1-Math.abs(.45-t));pos.setXYZ(i,x*(1+.08*Math.abs(t-.45)),q.y+wave*.4,q.x+wave);}geo.computeVertexNormals();const dm=col.clone();dm.side=THREE.DoubleSide;dm.userData.roomFinishLocked=true;add(g,geo,dm);
  for(const s of [-1,1])tube(g,[[s*190,905,-245],[s*235,760,-275],[s*215,600,-290],[s*190,470,-276]],34,col);
  if(hood)lump(g,[150,70,110],[0,895,-262],col,13,.12,0);return g;};

 const SHEET=345;// exposed sheet strip between the pillows and the quilt's top edge
 // A small blanket over a plush that has been put to bed: a smooth cloth tent.
 const blanket=(p,x,z,mat,w=330,d=300,hgt=70)=>sheet(p,w,d,[x,0,z],(u,v)=>{const e=Math.max(0,1-(u/(w*.42))**2-(v/(d*.42))**2);return SHEET+3+hgt*Math.sqrt(e);},mat,18,16);
 // A square throw cushion leaning back against the sleeping pillows.
 const throwPillow=(p,x,mat,rotY=0,w=300)=>{const o=rbox(p,[w,w*.92,95],[x,SHEET+w*.44,-545],mat,40);o.rotation.set(-.32,rotY,0,'YXZ');return o;};
 const sleepingPlush=(p,x,mat,cover)=>{const b=plushBear(p,[x,402,-430],1.3,mat,C.plushLight,false,0);b.rotation.x=-1.25;blanket(p,x,-330,cover,360,330,85);return b;};

 // ================= ROUND 2: each stage re-dresses its own furniture ==========
 // The bed, the foreground story rack and reading nook and the right-wall
 // cabinet keep their editor IDs, positions and footprints; only their visual
 // pieces change per stage. Original frame meshes are hidden (not removed, so
 // other layers that look them up still find them) and the stage's own piece
 // is built inside the same group, within the same footprint, so owner moves
 // carry it along.
 const hideFrame=(g,test)=>{for(const o of g?.children||[])if(o.isMesh&&test(o)){o.visible=false;o.userData.livedHidden=true;}};
 const near=(a,b,t=.6)=>Math.abs(a-b)<t;
 const stagePaint=(color,r=.72)=>fin(color,r);
 const restyled={};
 // Dinosaur figure (about 150 mm): ellipsoid body, neck, head, tail and legs.
 const dino=(p,at,rotY,mat,s=1)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;g.scale.setScalar(s);p.add(g);ball(g,[70,42,36],[0,78,0],mat);rod(g,[45,95,0],[85,160,0],13,mat);ball(g,[24,16,15],[95,166,0],mat);rod(g,[-55,82,0],[-125,40,0],11,mat);for(const x of [-35,35])for(const z of [-22,22])cyl(g,11,12,48,[x,24,z],mat);return g;};
 const jar=(p,at,fill,h=150,r=48)=>{cyl(p,r,r,h,[at[0],at[1]+h/2,at[2]],C.glass);cyl(p,r*.86,r*.86,h*.62,[at[0],at[1]+h*.32,at[2]],fill);cyl(p,r+3,r+3,22,[at[0],at[1]+h+11,at[2]],C.red);};
 const legoBuild=(p,at,w,d,seed=1)=>{const cols=[C.red,C.yellow,C.blue,C.white,C.green,C.accent];rbox(p,[w,8,d],[at[0],at[1]+4,at[2]],C.green,1);
  // a small town: towers, a bridge and a roof, stud-scale bricks.
  for(let k=0;k<5;k++){const x=at[0]-w/2+70+hash(seed+k)*(w-140),z=at[2]-d/2+60+hash(seed*3+k)*(d-120),hh=2+Math.floor(hash(seed+k*7)*5);for(let y=0;y<hh;y++)rbox(p,[64,38,64],[x,at[1]+27+y*38,z],cols[(k+y)%6],2);if(k%2===0){const r=add(p,new THREE.ConeGeometry(52,60,4),C.red,[x,at[1]+8+hh*38+30,z]);r.rotation.y=Math.PI/4;}}
  for(let i=0;i<5;i++)rbox(p,[64,38,32],[at[0]-w/2+60+i*64,at[1]+27,at[2]+d/2-40],cols[(i+2)%6],2);};
 const ringLight=(p,at,h=1350)=>{for(let i=0;i<3;i++){const a=i*2.1;rod(p,[at[0],at[1]+380,at[2]],[at[0]+Math.cos(a)*165,at[1]+4,at[2]+Math.sin(a)*165],7,C.black);}rod(p,[at[0],at[1]+380,at[2]],[at[0],at[1]+h,at[2]],9,C.black);add(p,new THREE.TorusGeometry(150,16,10,32),fin('#fff8ec',.4,{emissive:'#fff2dc',emissiveIntensity:.18}),[at[0],at[1]+h+150,at[2]],[0,.6,0]);rbox(p,[80,150,10],[at[0],at[1]+h+150,at[2]],C.black,4).rotation.y=.6;};
 const speaker=(p,at,rotY,mat=C.charcoal,h=260)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[170,h,160],[0,h/2,0],mat,14);for(const y of [h*.3,h*.72]){cyl(g,y>h/2?36:56,y>h/2?36:56,6,[0,y,81],fin('#3c3c3a',.95),[Math.PI/2,0,0]);}return g;};
 const turntable=(p,at,rotY)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,[440,90,340],[0,45,0],C.wood,8);cyl(g,150,150,8,[-40,94,0],C.black,null,32);cyl(g,48,48,9,[-40,95,0],C.accent,null,20);rod(g,[150,100,-120],[40,106,40],5,C.steel);cyl(g,18,18,20,[150,100,-120],C.steel);return g;};
 const flightCase=(p,at,size,rotY=0)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);rbox(g,size,[0,size[1]/2,0],C.black,10);for(const x of [-1,1])for(const z of [-1,1])rbox(g,[50,size[1]+4,50],[x*(size[0]/2-20),size[1]/2,z*(size[2]/2-20)],C.steel,6);rbox(g,[size[0]+4,24,size[2]+4],[0,size[1]*.55,0],C.steel,4);return g;};
 const drumKit=(p,at)=>{const g=new THREE.Group();g.position.set(...at);p.add(g);const shell=C.accent,head=fin('#ece6da',.6),pad=C.black;
  const kick=add(g,new THREE.CylinderGeometry(200,200,300,28),shell,[-150,200,-170],[Math.PI/2,0,0]);cyl(g,192,192,4,[-150,200,-18],head,[Math.PI/2,0,0],28);for(const x of [-1,1])rod(g,[-150+x*150,60,-40],[-150+x*230,7,40],7,C.steel);
  for(const [x,y,z,r] of [[-270,560,-30,140],[-60,600,-90,120],[150,470,-130,150]]){const d=cyl(g,r,r,90,[x,y,z],shell,[.35,0,0],24);cyl(g,r-6,r-6,4,[x,y+42*Math.cos(.35),z+42*Math.sin(.35)],pad,[.35,0,0],24);rod(g,[x,y-40,z],[x,0,z-20],9,C.steel);}
  for(const [x,y,z,r] of [[-300,980,-120,150],[270,1050,-120,150],[0,1120,-140,140]]){rod(g,[x,0,z],[x,y,z],8,C.steel);for(let k=0;k<3;k++){const a=k*2.1;rod(g,[x,90,z],[x+Math.cos(a)*110,5,z+Math.sin(a)*110],6,C.steel);}const cym=cyl(g,r,r,5,[x,y,z],C.brass,[.18,0,.1],28);}
  return g;};
 const armchair=(p,at,rotY,body,throwMat)=>{const g=new THREE.Group();g.position.set(...at);g.rotation.y=rotY;p.add(g);for(const x of [-300,300])for(const z of [-130,130])cyl(g,16,12,140,[x,70,z],C.wood);
  rbox(g,[700,170,480],[0,225,0],body,50);rbox(g,[700,520,130],[0,470,-175],body,55).rotation.x=-.12;for(const x of [-310,310])rbox(g,[110,330,480],[x,360,0],body,45);rbox(g,[480,90,360],[0,350,40],body,40);
  const t=sheet(g,300,520,[-120,0,-60],(u,v)=>0,throwMat,4,8);t.geometry.dispose();t.geometry=new THREE.BoxGeometry(320,14,600,3,1,6);t.position.set(-140,470,-90);t.rotation.set(-.9,.0,.12);return g;};
 // Round 3: the reading light is a low lamp on a little side table beside the
 // armchair (the 1.5 m floor-lamp pole read as a post in the foreground). The
 // shade material carries userData.lampShade so the lighting layer finds it
 // explicitly after the bake (it keeps its own material: double-sided).
 const shadeMat=fin('#efe4cf',.95,{side:THREE.DoubleSide});shadeMat.userData.lampShade=true;
 const readingLamp=(p,at)=>{const [x,,z]=at;cyl(p,80,88,14,[x,7,z],C.wood,null,24);rod(p,[x,14,z],[x,545,z],13,C.wood);cyl(p,95,95,18,[x,551,z],C.wood,null,28);
  lathe(p,[[0,0],[42,0],[50,55],[34,125],[14,142],[0,142]],[x,560,z],C.accent);rod(p,[x,700,z],[x,770,z],5,C.brass);cyl(p,72,95,150,[x,830,z],shadeMat,null,28);};
 const outfit=(p,x,z,top,bottom,rotY=0)=>{// clothes laid out flat for the day: a shirt and trousers.
  const g=new THREE.Group();g.position.set(x,bedTop(x,z)+1,z);g.rotation.y=rotY;p.add(g);const sh=new THREE.Shape();sh.moveTo(-150,-210);sh.lineTo(150,-210);sh.lineTo(150,90);sh.lineTo(250,40);sh.lineTo(290,120);sh.lineTo(170,210);sh.lineTo(60,210);sh.quadraticCurveTo(0,170,-60,210);sh.lineTo(-170,210);sh.lineTo(-290,120);sh.lineTo(-250,40);sh.lineTo(-150,90);sh.closePath();
  const shirt=add(g,new THREE.ExtrudeGeometry(sh,{depth:10,bevelEnabled:false}),top,[0,0,-180]);shirt.rotation.x=-Math.PI/2;
  const pt=new THREE.Shape();pt.moveTo(-130,0);pt.lineTo(130,0);pt.lineTo(150,-520);pt.lineTo(25,-520);pt.lineTo(0,-120);pt.lineTo(-25,-520);pt.lineTo(-150,-520);pt.closePath();const pants=add(g,new THREE.ExtrudeGeometry(pt,{depth:10,bevelEnabled:false}),bottom,[0,0,60]);pants.rotation.x=-Math.PI/2;return g;};

 const stageBed=()=>{if(early||!bed)return;
  hideFrame(bed,o=>(near(o.position.y,15)&&Math.abs(o.position.z)>800)||(near(o.position.y,110)&&near(o.position.z,0))||(near(o.position.z,-1000)&&near(o.position.y,540))||(near(o.position.z,-955)&&near(o.position.y,590)));
  const f=fixture(bed,'lived-bed-frame-'+age,{primary:'Captain’s bed · drawers & a bookshelf headboard',preteen:'Upholstered arched bed & rolled foot',teen:'Low dark platform & slatted shelf headboard',college:'Walnut frame & tall linen headboard'}[age]),a=phase(f,ALL,'Bed frame');
  const headShape=(w,h,r)=>{const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-r);s.quadraticCurveTo(w/2,h,w/2-r,h);s.lineTo(-w/2+r,h);s.quadraticCurveTo(-w/2,h,-w/2,h-r);s.closePath();return s;};
  const headboard=(w,h,r,depth,mat,z,y0=190)=>{const g=add(a,new THREE.ExtrudeGeometry(headShape(w,h,r),{depth,bevelEnabled:true,bevelThickness:8,bevelSize:8,bevelSegments:3,curveSegments:16}),mat,[0,y0,z]);return g;};
  if(age==='primary'){const wood=C.wood,front=stagePaint(pal.second,.7);
   rbox(a,[1150,180,2100],[0,100,0],wood,10);rbox(a,[1130,10,2080],[0,5,0],C.charcoal,2);
   for(const z of [-680,0,680]){rbox(a,[12,130,620],[581,100,z],front,5);rbox(a,[6,22,140],[585,120,z],C.cream,2);}
   for(const x of [-300,300]){rbox(a,[540,130,10],[x,100,1053],front,4);rbox(a,[140,22,4],[x,120,1058],C.cream,1);}
   headboard(1164,700,260,60,wood,-1050);rbox(a,[1180,24,130],[0,760,-990],wood,4);rbox(a,[1180,22,60],[0,560,-1030],wood,3);
   let x=-520;for(let i=0;i<9;i++){const w=34+hash(i+3)*20,hh=150+hash(i+9)*60;rbox(a,[w,hh,110],[x+w/2,772+hh/2,-985],covers[i%covers.length],2);x+=w+4;}dino(a,[150,772,-990],.3,C.green,1.1);dino(a,[330,772,-990],-.4,C.accent,.9);
   rbox(a,[1180,300,44],[0,340,1030],wood,10);rbox(a,[1100,40,56],[0,505,1030],wood,8);}
  if(age==='preteen'){const up=stagePaint(pal.cloth,.97),leg=C.wood;
   rbox(a,[1180,150,2120],[0,115,0],up,30);for(const x of [-540,540])for(const z of [-1010,1010])cyl(a,22,16,40,[x,20,z],leg);
   const hb=headboard(1164,760,520,90,up,-1050);for(let i=-4;i<=4;i++)rod(a,[i*120,215,-975],[i*120,860-Math.pow(i/4.6,2)*330,-975],6,fin('#b07c68',.97));
   const foot=add(a,new THREE.CylinderGeometry(105,105,1170,24),up,[0,420,950]);foot.rotation.z=Math.PI/2;rbox(a,[1170,240,60],[0,310,1025],up,24);}
  if(age==='teen'){const dark=C.charcoal,slat=C.wood;
   rbox(a,[1020,70,1960],[0,35,0],C.black,4);rbox(a,[1180,120,2120],[0,130,0],dark,8);
   for(let i=0;i<8;i++)rbox(a,[130,560,36],[-525+i*150,470,-1040],slat,4);rbox(a,[1180,40,190],[0,770,-965],dark,6);rbox(a,[1180,10,12],[0,748,-875],fin('#c7b6ff',.5,{emissive:'#b49cff',emissiveIntensity:.25}),2);
   speaker(a,[-400,790,-965],.1,C.ink,200);rbox(a,[300,32,170],[-80,806,-965],C.accent,3);rbox(a,[280,28,160],[-80,836,-965],C.cream,3);cyl(a,60,52,90,[220,835,-965],C.cream);for(let k=0;k<5;k++)ball(a,[34,8,24],[220+Math.cos(k*1.3)*40,895+k*8,-965+Math.sin(k*1.3)*30],C.leaf,[.3,k,.5]);rbox(a,[80,150,14],[440,865,-930],C.black,6).rotation.x=-.25;
   // The show-off: a race bib pinned to the slats, a county medal and spikes hung by their laces.
   const bib=canvasMap((c,w,hh)=>{c.fillStyle='#f6f3ec';c.fillRect(0,0,w,hh);c.fillStyle='#c0584a';c.fillRect(0,0,w,34);c.fillStyle='#fff';c.font='bold 22px sans-serif';c.fillText('COUNTY XC FINALS',12,25);c.fillStyle='#202427';c.font='bold 110px sans-serif';c.textAlign='center';c.fillText('214',w/2,hh-30);},256,192);
   const bm=add(a,new THREE.PlaneGeometry(330,250),fin('#ffffff',.9,{map:bib}),[150,480,-1020]);bm.rotation.z=.06;
   tube(a,[[-190,770,-880],[-205,700,-870],[-200,640,-868]],3,C.accent);cyl(a,48,48,7,[-200,610,-866],C.brass,[Math.PI/2,0,0],24);
   for(const [x,k] of [[400,0],[480,1]]){const sp=new THREE.Group();sp.position.set(x,610,-890);sp.rotation.set(Math.PI/2-.2,0,.15*(k?1:-1));a.add(sp);sneaker(sp,[0,0,0],0,k?C.accent:C.yellow,40+k);tube(a,[[x,770,-890],[x+10,700,-895],[x,640,-890]],2.5,C.white);}}
  if(age==='college'){const walnut=C.wood,linen=stagePaint(pal.cloth,.97);
   for(const x of [-545,545])for(const z of [-1015,1015])cyl(a,22,15,160,[x,80,z],walnut);
   for(const x of [-570,570])rbox(a,[40,90,2120],[x,195,0],walnut,8);rbox(a,[1180,90,40],[0,195,1040],walnut,8);rbox(a,[1100,40,2040],[0,165,0],walnut,4);
   rbox(a,[1180,760,60],[0,560,-1028],walnut,14);rbox(a,[1100,690,80],[0,560,-990],linen,40);for(const x of [-275,0,275])rbox(a,[6,640,6],[x,560,-958],fin('#a59580',.97),2);}
  restyled.bed=f;};

 const stageRack=()=>{const rack=groups.rack;if(early||!rack)return;hideFrame(rack,()=>true);
  const f=fixture(rack,'lived-rack-'+age,{primary:'Collection & build shelf · dinosaurs, jars and a brick town',preteen:'Hangout shelf · speaker, ring light & mirror',teen:'Sneaker wall · two shelves of trainers',college:'Plank-and-brick bookcase, overstuffed'}[age]),a=phase(f,ALL,'Stage shelf');
  if(age==='primary'){const frame=stagePaint(pal.second,.7);for(const x of [-640,-213,213,640])rbox(a,[28,640,340],[x,320,0],frame,4);for(const y of [14,330,640])rbox(a,[1308,28,340],[0,y,0],frame,4);rbox(a,[1290,620,10],[0,330,-165],C.cream,2);
   for(const [i,x] of [-426,0,426].entries()){if(i===1){for(let k=0;k<4;k++)dino(a,[-120+k*80,28,40-k*24],k*.6-.6,[C.green,C.accent,C.yellow,C.blue][k],1);}else for(let k=0;k<3;k++)jar(a,[x-120+k*120,28,30],[C.red,C.yellow,C.blue,C.green,C.pink,C.accent][(i+k)%6],150+k%2*40,46);}
   rocks(a,[-426,344,60]);for(let k=0;k<3;k++)rbox(a,[110,110,110],[300+k*120,399,40],[C.red,C.yellow,C.blue][k],10);trophy(a,[0,344,40],C.brass,1.1);bookStack(a,[150,344,40],3,covers,4,[160,30,220]);
   legoBuild(a,[0,654,10],1240,300,7);}
  if(age==='preteen'){const white=fin('#efeae2',.7);rbox(a,[1300,40,360],[0,420,0],white,8);for(const x of [-560,-180,180,560])rbox(a,[40,420,340],[x,210,0],white,6);rbox(a,[1300,24,340],[0,12,0],white,4);
   for(const [i,x] of [-370,0,370].entries())rbox(a,[330,330,300],[x,195,20],[fin(pal.second,.95),fin('#e9c7b8',.95),fin(pal.feature,.95)][i],22);
   speaker(a,[-470,440,-20],.2,C.accent,240);rbox(a,[300,360,30],[-60,620,-120],C.white,20).rotation.x=-.18;const glassM=add(a,new THREE.PlaneGeometry(250,300),fin('#c8d8de',.15,{metalness:.6}),[-60,622,-102]);glassM.rotation.x=-.18;for(let k=0;k<6;k++)ball(a,[18,18,4],[-160+hash(k)*200,480+hash(k+3)*260,-98],[C.pink,C.yellow,C.blue,C.accent][k%4]);
   ringLight(a,[360,440,0],520);bookStack(a,[200,440,60],2,covers,6,[150,26,200]);}
  if(age==='teen'){const dark=C.charcoal;for(const x of [-640,640])rbox(a,[30,660,340],[x,330,0],dark,4);for(const y of [14,300,600])rbox(a,[1310,24,330],[0,y,0],dark,4);rbox(a,[1290,640,10],[0,330,-165],C.ink,2);
   const ups=[C.white,C.accent,C.red,C.black,C.blue,C.yellow,C.green,C.white];for(let s=0;s<2;s++)for(let k=0;k<4;k++){const g=new THREE.Group();g.position.set(-450+k*300,s?312:26,0);g.rotation.y=-Math.PI/2+.15*(k%2?1:-1);a.add(g);sneaker(g,[0,0,-60],0,ups[s*4+k],k+s*4);sneaker(g,[0,0,60],0,ups[s*4+k],k+s*4+9);}
   speaker(a,[-430,612,0],.25,C.black,230);turntable(a,[200,612,0],0);for(let k=0;k<5;k++){const sl=rbox(a,[300,300,6],[470-k*14,762,-120+k*4],sleeveMat(k),1);sl.rotation.set(-.08,0,(k-2)*.08);}}
  if(age==='college'){const brick=fin('#a5533f',.95),plank=C.wood;for(const y of [0,300,600])for(const x of [-560,560]){for(let k=0;k<2;k++)rbox(a,[200,90,140],[x,y+45+k*92,0],brick,4);}for(const y of [184,484,784])rbox(a,[1320,30,330],[0,y+15,0],plank,4);
   for(const [r,y] of [[0,214],[1,514]]){let x=-620;let i=r*13;while(x<600){const w=28+hash(i)*30,hh=170+hash(i+40)*90,lean=x>440&&r===0?.25:0;const b=rbox(a,[w,hh,180],[x+w/2,y+hh/2,10],covers[i%covers.length],3);b.rotation.z=-lean;x+=w+2;i++;if(hash(i*3)>.88){x+=10;}}}
   bookStack(a,[-430,814,10],4,covers,9,[220,34,170]);turntable(a,[120,814,0],0);pothos(a,[500,814,-90],C.terracotta,6);}
  restyled.rack=f;};

 const stageNook=()=>{const nook=groups.nook;if(!nook)return;
  if(early){const f=fixture(nook,'lived-nook-early','Giant bear slumped on the floor cushion'),a=loose(phase(f,AWAKE,'Giant bear'));const b=plushBear(a,[-120,150,-130],1.9,C.plush,C.plushLight,true,.35);b.rotation.z=.12;restyled.nook=f;return;}
  hideFrame(nook,()=>true);
  const f=fixture(nook,'lived-nook-'+age,{primary:'Brick-building table · a town in progress',preteen:'Beanbag corner · round shag cushion & skateboard',teen:'Practice drum kit & road case',college:'Reading armchair, ottoman & a lamp on the side table'}[age]),a=phase(f,ALL,'Stage corner');let read=[0,0,0];
  if(age==='primary'){rbox(a,[940,40,640],[0,430,20],C.wood,10);for(const x of [-430,430])for(const z of [-270,310])rod(a,[x,0,z],[x,410,z],20,C.wood);legoBuild(a,[-120,450,-120],640,330,3);legoBuild(a,[300,450,-170],240,220,11);for(let k=0;k<6;k++)rbox(a,[64,38,32],[250+hash(k)*180,479,-200+hash(k+5)*140],[C.red,C.yellow,C.blue,C.green][k%4],2).rotation.y=hash(k+2)*3;cyl(a,150,130,170,[330,85,-120],C.yellow);read=[0,310,150];}
  if(age==='preteen'){const shag=fin(pal.feature,.99);const cush=lump(a,[340,70,250],[-110,0,62],shag,71,.06);const bb=lump(a,[200,190,180],[230,0,-120],C.second,73,.12);lump(a,[150,100,90],[250,160,-190],C.second,75,.1);
   read=[-73,0,0];}
  if(age==='teen'){drumKit(a,[0,0,0]);flightCase(a,[-40,0,210],[640,300,300]);read=[-40,150,100];}
  if(age==='college'){armchair(a,[60,0,-20],0,stagePaint(pal.second,.95),C.cloth);rbox(a,[620,330,260],[-40,165,245],stagePaint(pal.cloth,.97),40);readingLamp(a,[-395,0,-60]);read=[-40,180,170];}
  for(const o of nook.children)if(o.userData.childActivity)o.position.set(...read);
  restyled.nook=f;};

 const stageCubby=()=>{if(early||!cubby)return;
  // The cabinet carcass and its paint belong to the materials layer; this
  // stage only changes what fills the lower bays.
  for(const id of ['basket-0','basket-1']){let b;cubby.traverse(o=>{if(o.userData.propId===id)b=o;});if(b)b.visible=false;}
  const f=fixture(cubby,'lived-cubby-'+age,{primary:'Bright toy bins in the cubbies',preteen:'Fabric drawers in the cubbies',teen:'Cubbies packed with records',college:'Woven boxes & folded throws'}[age]),a=phase(f,ALL,'Cabinet');
  for(const [i,x] of [-344,344].entries()){
   if(age==='primary'){rbox(a,[600,250,470],[x,153,10],[C.red,C.yellow][i],24);rbox(a,[200,30,8],[x,240,247],C.white,6);}
   if(age==='preteen'){rbox(a,[620,262,500],[x,159,10],[fin('#e9c7b8',.97),fin(pal.second,.95)][i],18);cyl(a,40,40,10,[x,230,262],C.brass,[Math.PI/2,0,0]);}
   if(age==='teen'){for(let k=0;k<22;k++){const s=rbox(a,[8,262,262],[x-290+k*27,160,40],sleeveMat(k%4),1);s.rotation.z=(hash(k+i*30)-.5)*.1;}}
   if(age==='college'){rbox(a,[600,240,470],[x,148,10],fin('#cdbb98',.98),20);for(let k=0;k<3;k++)rbox(a,[520,40,400],[x,280+k*1,10],k%2?C.cloth:C.white,8);}}
  restyled.cubby=f;};
 stageBed();stageRack();stageNook();stageCubby();for(const f of Object.values(restyled))bakeAll(f);
 // Morning: what is out before the day starts (clothes laid out on the bed).
 if(bedLayer&&!early){const morn=phase(bedLayer,['morning'],'Clothes laid out for the day');({primary:()=>outfit(morn,-120,0,C.white,C.blue,.1),preteen:()=>outfit(morn,-110,0,C.yellow,C.denim,-.12),teen:()=>outfit(morn,-140,0,fin('#9a9d9f',.98),C.black,.2),college:()=>outfit(morn,-120,0,C.cream,C.ink,-.05)})[age]();}
 if(bedLayer&&early){const morn=phase(bedLayer,['morning'],'A tiny outfit laid out');outfit(morn,-160,100,C.yellow,C.pink,.15).scale.setScalar(.6);}

 // ---------------- EARLY YEARS: big, soft, chunky and within reach -------------
 if(early){
  if(bedLayer){
   const friends=phase(bedLayer,['morning','afternoon','evening','party'],'Soft friends on the pillow');plushBear(friends,[-150,SHEET,-480],1.15,C.plush,C.plushLight,true,.15);plushBear(friends,[150,SHEET,-490],.75,fin(pal.cloth,.99),C.plushLight,true,-.3);
   const pj=loose(phase(bedLayer,['morning'],'Pyjamas left where they came off'));kickedDuvet(pj,85,2,40,520);lump(pj,[170,45,150],[-280,bedTop(-280,-60),-60],C.pink,6,.22,.4);lump(pj,[150,40,130],[-60,bedTop(-60,80),80],fin('#d9e1e6',.97),8,.22,-.6);
   const books=phase(bedLayer,['evening'],'Board books for the story');bookStack(books,[-260,bedTop(-260,120),120],3,[C.red,C.blue,C.yellow],3,[200,34,200]);openBook(books,[120,bedTop(120,260),260],C.green,.3,300,200);
   const asleep=phase(bedLayer,['night'],'Bear tucked in for the night');sleepingPlush(asleep,-120,C.plush,C.pink);plushBear(asleep,[200,SHEET,-490],.75,fin(pal.cloth,.99),C.plushLight,true,-.3);
  }
  // Foot of the bed: a chunky toy chest; the rocking horse where it fits.
  placeFloor('lived-toychest-early','Painted toy chest · everything has a home',r=>frontAnchors(r,Math.PI).concat(rightAnchors(r,false,Math.PI/2),footAnchors(r)),g=>{
   const shut=phase(g,['evening','night'],'Toy chest closed for the night');toyChest(shut,[0,0,0],0,false,C.second);
   // Bedtime: the giant bear leaves the floor cushion and is sat on the closed lid (lid top 407 mm).
   const bedtime=phase(g,['night'],'Giant bear put away on the toy chest');plushBear(bedtime,[0,407,-20],1.6,C.plush,C.plushLight,true,Math.PI);
   const open=phase(g,DAY,'Toy chest open');toyChest(open,[0,0,0],0,true,C.second);lump(open,[330,80,165],[0,230,0],C.cloth,61,.25);ball(open,[70,70,70],[-210,372,30],C.red);rbox(open,[110,110,110],[20,362,-60],C.yellow,10).rotation.set(.3,.5,.2);plushBear(open,[210,300,20],.55,C.plush,C.plushLight,true,-.5);
  });
  placeFloor('lived-rocker-early','Rocking horse · first big ride',r=>rightAnchors(r,false,Math.PI/2).concat(footAnchors(r),footAnchors(r,Math.PI/2)),g=>{const a=phase(g,ALL,'Rocking horse');rockingHorse(a,[0,0,0],0,C.cream,C.accent);});
  if(cubby){const s=fixture(cubby,'lived-shelf-early','Rainbow stacker & chunky cups');const a=phase(s,ALL);rainbow(a,[330,322,40],0);for(let i=0;i<3;i++)cyl(a,48-i*8,40-i*8,70,[560,322+35+i*70,40],[C.red,C.yellow,C.blue][i]);}
  const r=fixture(root,'lived-rug-early','Chunky toys on the play mat',[l.play[0],9.2,l.play[1]]);
  const rm=loose(phase(r,['morning'],'Stacking rings by the mat edge'));stackingRings(rm,R(860,600));
  const ra=loose(phase(r,['afternoon'],'Big soft ball rolled to the corner'));softBall(ra,R(860,600),120,C.red,C.cream);
  // Round 3: on the open back-right of the mat, turned side-on to the camera (the front half put it behind the pouf, the back-left behind the book rack); out for morning and afternoon only.
  const rw=loose(phase(r,['morning','afternoon'],'Push-along walker loaded with blocks'));walker(rw,tier?R(640,-560):R(780,-330),-.35,C.accent,true).scale.setScalar(tier?.9:1);
  const rp=loose(phase(r,['party'],'Soft friends watching the railway'));plushBear(rp,R(920,620),.9,C.plush,C.plushLight,true,-.6);rabbit(rp,R(700,700),.8,-.4);
  settleRug(r);
 }

 // ---------------- ELEMENTARY: collections, school days, sport ---------------
 if(age==='primary'){
  if(bedLayer){
   const keep=phase(bedLayer,AWAKE,'Rabbit and the dog on the pillow');rabbit(keep,[-180,SHEET,-480],.75,.2);plushBear(keep,[170,SHEET,-490],.68,fin('#8a6a52',.99),C.plushLight,true,-.3);
   const m0=loose(phase(bedLayer,['morning'],'Bed kicked open and pyjamas'));kickedDuvet(m0,90,4,0,480);lump(m0,[170,40,150],[-260,bedTop(-260,40),40],fin('#a7bfd0',.97),3,.22,.5);
   const a0=loose(phase(bedLayer,['afternoon'],'Comic face-down on the quilt'));tentBook(a0,[-160,bedTop(-160,120),120],C.red,.4);
   const e0=phase(bedLayer,['evening'],'Chapter book and a flashlight');openBook(e0,[-150,bedTop(-150,100),100],C.second,-.2);flashlight(e0,[60,bedTop(60,220),220],2.2);
   const n0=phase(bedLayer,['night'],'Rabbit tucked in, flashlight on the pillow');rabbit(n0,[-130,390,-470],.75,0,-1.2);blanket(n0,-130,-440,C.second);flashlight(n0,[230,437,-790],.4);
   const p0=loose(phase(bedLayer,['party'],'Game box on the bed'));rbox(p0,[420,60,300],[-160,bedTop(-160,120)+30,120],C.ink,4);
  }
  placeFloor('lived-bench-primary','Bench at the bed foot · bag, bin & shoes',r=>footAnchors(r),g=>{
   const b=phase(g,ALL,'Storage bench');rbox(b,[900,40,360],[0,400,0],C.wood,8);for(const x of [-420,420])rbox(b,[50,380,330],[x,190,0],C.wood,6);rbox(b,[790,30,300],[0,90,0],C.wood,4);rbox(b,[380,230,280],[-180,220,0],C.blue,14);rbox(b,[300,150,250],[200,180,0],C.yellow,14);
   const morning=loose(phase(g,['morning'],'Backpack unpacked onto the bench'));backpack(morning,[150,420,0],1.35,C.second,C.accent,true,true);lunchbox(morning,[-260,420,30],-.2,C.red);shoePair(morning,[-120,0,280],.5,C.blue,1,.5);
   const after=loose(phase(g,['afternoon','party'],'Bag dropped and shoes kicked off'));backpack(after,[230,420,0],-.1,C.second,C.accent,false,false);shoePair(after,[-180,0,280],-.6,C.blue,4,.7);
   const ready=phase(g,['evening','night'],'Packed for tomorrow');backpack(ready,[220,420,0],0,C.second,C.accent,false,false);shoePair(ready,[-150,0,270],0,C.blue,7,0);
  });
  // Round 3: where the door takes the window wall, the front strip (in full view) comes before the bed foot (behind the rack).
  placeFloor('lived-sport-primary','Scooter, football & boots',r=>rightAnchors(r,true).concat(frontAnchors(r,Math.PI/2),frontAnchors(r,-Math.PI/2),footAnchors(r,Math.PI/2)),g=>{
   const a=phase(g,ALL,'Scooter on its stand');scooter(a,[0,0,0],-Math.PI/2,C.accent);
   const b=loose(phase(g,['morning','afternoon','party'],'Football waiting by the scooter'));soccer(b,[-80,0,-290]);shoePair(b,[60,0,330],2.6,C.green,9,.4);
   const c=phase(g,['evening','night'],'Ball put by the wall');soccer(c,[110,0,-300]);
  },{tall:true});
  if(cubby){const s=fixture(cubby,'lived-shelf-primary','Rock collection & first trophy');const a=phase(s,ALL);rocks(a,[-175,322,60]);trophy(a,[230,616,40],C.brass,1);}
  const r=fixture(root,'lived-rug-primary','Brick builds and games on the rug',[l.play[0],9.2,l.play[1]]);
  const rm=loose(phase(r,['morning'],'A puzzle half done'));puzzle(rm,R(380,330),.15);
  const ra=loose(phase(r,['afternoon'],'Brick house going up'));brickBuild(ra,R(380,360),.2,1);
  const rp=loose(phase(r,['party'],'Game night on the rug'));brickBuild(rp,R(-20,480),.4,.8);boardGame(rp,R(560,300),-.2,3);floorCushion(rp,R(930,120),C.second,.3,3,[170,55,170]);floorCushion(rp,R(560,720),C.feature,.2,5,[170,55,150]);snackBowl(rp,R(920,560),100,C.yellow,4);
  settleRug(r);
 }

 // ---------------- PRETEEN: a hobby in progress, a phone, a beanbag ----------
 if(age==='preteen'){
  if(bedLayer){
   const keep=phase(bedLayer,ALL,'Throw pillows');throwPillow(keep,-200,C.accent,.12);throwPillow(keep,150,C.second,-.15,260);
   const m0=loose(phase(bedLayer,['morning'],'Hoodie and phone on an unmade bed'));kickedDuvet(m0,75,6,-40,470);lump(m0,[200,45,170],[-260,bedTop(-260,20),20],C.cloth,11,.2,.3);phone(m0,[60,bedTop(60,100),100],.6);
   const a0=loose(phase(bedLayer,['afternoon'],'Sketchbook and pencils'));openBook(a0,[-160,bedTop(-160,140),140],C.ink,.25,320,220);for(let i=0;i<3;i++)rod(a0,[70+i*25,bedTop(70,240)+5,200],[80+i*25,bedTop(70,300)+5,330],4,[C.accent,C.second,C.charcoal][i]);
   const e0=phase(bedLayer,['evening'],'Graphic novel, earbuds and phone');openBook(e0,[-150,bedTop(-150,120),120],C.red,-.15);phone(e0,[80,bedTop(80,150),150],-.3);rbox(e0,[60,26,50],[110,bedTop(110,290)+13,290],C.white,12);
   const p0=loose(phase(bedLayer,['party'],'Card game on the bed'));for(let i=0;i<6;i++)rbox(p0,[60,3,90],[-260+i*70,bedTop(-260+i*70,160)+2,160+hash(i)*40],i%2?C.white:C.accent,1).rotation.y=hash(i+3)*1.5;
  }
  placeFloor('lived-beanbag-preteen','Beanbag & skateboard at the bed foot',r=>footAnchors(r).concat(rightAnchors(r,false,-Math.PI/2)),g=>{
   const a=phase(g,ALL,'Beanbag');beanbag(a,[-160,0,30],C.feature,5);
   const sk=loose(phase(g,['morning','afternoon','party'],'Skateboard left by the beanbag'));skateboard(sk,[60,0,330],-.25,C.accent);
   const sk2=phase(g,['evening','night'],'Skateboard parked');skateboard(sk2,[60,0,380],0,C.accent);
   const sb=loose(phase(g,['afternoon'],'Sketchbook on the beanbag'));openBook(sb,[-170,250,60],C.ink,.4,260,190);
  });
  placeFloor('lived-cart-preteen','Rolling craft cart · supplies & a half-made bracelet',r=>rightAnchors(r,true).concat(footAnchors(r)),g=>{
   const a=phase(g,AWAKE,'Craft cart with a project on top');craftCart(a,[0,0,0],-Math.PI/2,true);
   const b=phase(g,['night'],'Craft cart tidied');craftCart(b,[0,0,0],-Math.PI/2,false);
  },{tall:true});
  if(cubby){const s=fixture(cubby,'lived-shelf-preteen','Figurine collection & the old rabbit');const a=phase(s,ALL);[C.accent,C.second,C.feature,C.ink].forEach((mat,i)=>figurine(a,[-270+i*72,322,80-i*8],mat,[C.cream,C.yellow,C.pink,C.white][i]));rabbit(a,[230,616,40],.6,-.3);}
  const r=fixture(root,'lived-rug-preteen','Floor projects and a sleepover',[l.play[0],9.2,l.play[1]]);
  const ra=loose(phase(r,['afternoon'],'Drawing on the floor'));floorCushion(ra,R(160,380),C.feature,.4,3,[170,55,170]);openBook(ra,R(480,340),C.ink,.2,380,260);for(let i=0;i<5;i++){const a=R(700+i*22,250+i*14),b=R(724+i*26,390+i*10);rod(ra,[a[0],6,a[2]],[b[0],6,b[2]],6,[C.red,C.yellow,C.blue,C.green,C.pink][i]);}phone(ra,R(330,90),.8);
  const rp=loose(phase(r,['party'],'Sleepover on the rug'));sleepingBag(rp,R(430,440),Math.PI/2,C.accent,C.cream);cyl(rp,140,140,640,R(930,-120).map((v,i)=>i===1?140:v),C.second,[Math.PI/2,0,.1]);snackBowl(rp,R(160,40),110,C.yellow,7);
  settleRug(r);
 }

 // ---------------- HIGH SCHOOL: the musician who runs track -------------------
 if(age==='teen'){
  if(bedLayer){
   const keep=phase(bedLayer,ALL,'Throw pillows');throwPillow(keep,-210,C.accent,.1);throwPillow(keep,160,C.cloth,-.12,270);
   const unmade=phase(bedLayer,['morning','afternoon','evening','party'],'Duvet never quite made');kickedDuvet(unmade,95,8,30,460);
   const m0=loose(phase(bedLayer,['morning'],'Phone and yesterday’s hoodie'));phone(m0,[-250,bedTop(-250,-80),-80],.9);lump(m0,[210,50,170],[30,bedTop(30,80),80],C.charcoal,15,.2,-.4);
   const a0=loose(phase(bedLayer,['afternoon'],'Revision guide left open'));openBook(a0,[-170,bedTop(-170,-40),-40],C.feature,.3,300,215);
   const e0=phase(bedLayer,['evening'],'Laptop, headphones, half a song');laptop(e0,[-150,bedTop(-150,-20),-20],.25,true,screenMat('music'));headphones(e0,[120,bedTop(120,100),100],.7);phone(e0,[-400,bedTop(-400,90),90],-.4);
   const p0=loose(phase(bedLayer,['party'],'Jackets thrown on the bed'));lump(p0,[220,50,190],[-200,bedTop(-200,0),0],C.denim,17,.2,.5);lump(p0,[200,45,160],[60,bedTop(60,90),90],C.accent,19,.2,-.3);
  }
  placeFloor('lived-laundry-teen','Hamper, the floor-drobe & trainers',r=>footAnchors(r),g=>{
   const a=phase(g,ALL,'Laundry hamper');hamper(a,[-300,0,-20],true,[C.cloth,C.denim,C.white]);
   const pile=loose(phase(g,['morning','afternoon','party'],'Clothes that never made it to the hamper'));lump(pile,[240,42,190],[-20,0,40],C.denim,23,.32,.3);lump(pile,[190,34,140],[60,40,-30],fin('#9a9d9f',.98),25,.34,-.8);lump(pile,[160,30,120],[-90,30,140],C.cloth,27,.3,1.2);
   const shoes=loose(phase(g,['morning','afternoon','evening','party'],'Running spikes and trainers'));shoePair(shoes,[300,0,60],.9,C.accent,31,.6);shoePair(shoes,[180,0,-200],-.4,C.white,33,.2);
   const tidy=phase(g,['night'],'Trainers paired for the morning');shoePair(tidy,[220,0,0],0,C.accent,35,0);shoePair(tidy,[220,0,-240],0,C.white,37,0);
   const bag=loose(phase(g,['afternoon','evening'],'Track bag dumped'));duffel(bag,[260,0,-180],.15,C.ink,C.accent);
  });
  placeFloor('lived-guitar-teen','Electric guitar, practice amp & pedal',r=>rightAnchors(r,true).concat(frontAnchors(r,-Math.PI/2),frontAnchors(r,Math.PI/2),footAnchors(r,Math.PI/2)),g=>{
   const a=phase(g,ALL,'Guitar on its stand');guitarStand(a,[0,0,-200],0,C.accent);amp(a,[0,0,240],-Math.PI/2,C.charcoal);
   const c=loose(phase(g,['afternoon','evening','party'],'Lead plugged in, pedal on the floor'));rbox(c,[110,50,150],[-180,25,40],C.feature,8);cable(c,[[-20,250,-200],[-110,40,-160],[-150,14,-60],[-180,30,40]],C.black);cable(c,[[-180,30,100],[-150,14,170],[-80,30,250],[-100,200,240]],C.black);
  },{tall:true});
  if(cubby){const s=fixture(cubby,'lived-shelf-teen','Mixtapes, medals and a small trophy');const a=phase(s,ALL);cassettes(a,[-230,322,90],6);cassettes(a,[-90,322,80],4);{const box=fin('#e0793f',.8);rbox(a,[280,120,190],[250,676,30],box,4);const lid=rbox(a,[290,24,200],[250,748,-8],box,4);lid.rotation.x=-.18;rbox(a,[150,4,2],[250,690,126],C.white,1);lump(a,[110,30,80],[250,736,40],C.white,52,.15);}/* a sneaker box, lid pushed back (no second trophy) */medal(a,[150,402,276],C.accent);}
  const r=fixture(root,'lived-rug-teen','Records and the study group',[l.play[0],9.2,l.play[1]]);
  const ra=loose(phase(r,['afternoon'],'Record sleeves spread out'));crate(ra,R(860,430),.2,7,[0,1,2,3].map(i=>sleeveMat(i)));for(let i=0;i<3;i++){const sl=rbox(ra,[300,4,300],R(140+i*230,360+(i%2)*80).map((v,k)=>k===1?2+i*4:v),sleeveMat(i+1),1);sl.rotation.y=(hash(i)-.5)*.8;}
  const rp=loose(phase(r,['party'],'Floor seats, pizza and notes'));pizzaBox(rp,R(450,360),.2,true);[[R(90,430),C.ink],[R(860,380),C.accent],[R(470,760),C.second]].forEach(([at,col],i)=>floorCushion(rp,at,col,i,7+i,[170,55,170]));[R(240,90),R(680,110),R(900,700)].forEach((at,i)=>cup(rp,at,[C.red,C.white,C.second][i]));openBook(rp,R(140,720),C.feature,-.3);
  settleRug(r);
 }

 // ---------------- COLLEGE: home between terms, plants and coffee -----------
 if(age==='college'){
  if(bedLayer){
   const keep=phase(bedLayer,ALL,'Throw pillows and the old rabbit');throwPillow(keep,-230,C.cloth,.08);throwPillow(keep,90,C.second,-.1,280);rbox(keep,[360,150,90],[-60,SHEET+75,-470],C.feature,38).rotation.x=-.2;rabbit(keep,[360,SHEET,-480],.6,-.6);
   const m0=loose(phase(bedLayer,['morning'],'Tote bag packed on the bed'));backpack(m0,[-200,bedTop(-200,150),150],1.2,C.cloth,C.ink,false,true);
   const a0=loose(phase(bedLayer,['afternoon'],'Laptop and a notebook'));laptop(a0,[-170,bedTop(-170,0),0],.2,true,screenMat('doc'));openBook(a0,[170,bedTop(170,190),190],C.ink,-.3,280,200);
   const e0=phase(bedLayer,['evening'],'Novel face-down and reading glasses');tentBook(e0,[-120,bedTop(-120,120),120],C.accent,.3);glasses(e0,[-330,bedTop(-330,40),40],.4);
   const p0=loose(phase(bedLayer,['party'],'Coats on the bed'));lump(p0,[230,55,190],[-180,bedTop(-180,40),40],C.charcoal,41,.2,.3);lump(p0,[210,50,170],[60,bedTop(60,200),200],C.denim,43,.2,-.6);
  }
  placeFloor('lived-bench-college','Bench at the bed foot · laundry & a weekend bag',r=>footAnchors(r),g=>{
   const bench=phase(g,ALL,'Upholstered bench');rbox(bench,[900,90,380],[0,415,0],C.cloth,30);for(const x of [-400,400])for(const z of [-150,150])rod(bench,[x,0,z],[x,370,z],16,C.wood);rbox(bench,[860,30,340],[0,385,0],C.wood,6);
   const basket=loose(phase(bench,['afternoon','party'],'Clean laundry, folded and not put away'));rbox(basket,[420,180,320],[-170,550,0],fin('#cdbb98',.98),20);for(let i=0;i<4;i++)rbox(basket,[300,32,240],[-170,656+i*32,0],[C.white,C.denim,C.second,C.cloth][i],10);
   const bag=loose(phase(g,['morning','afternoon','evening'],'Weekend bag on the floor'));duffel(bag,[200,0,262],-.12,C.ink,C.cloth);
   const shoes=phase(g,ALL,'Boots by the bench');shoePair(shoes,[-250,0,262],.15,fin('#6d4f3a',.7),45,.2);
  });
  // Against the window wall when it has room; otherwise along the front strip, the fridge
  // turned so its door faces the cabinet side (and the camera), the plant beside it.
  if(!placeFloor('lived-kitchenette-college','Mini fridge, kettle & a big plant',r=>rightAnchors(r,true),g=>{
   const a=phase(g,ALL,'Mini fridge & plant');fridge(a,[0,0,-250],-Math.PI/2);floorPlant(a,[-10,0,260],C.terracotta,3,true);
  },{tall:true,front:false}))placeFloor('lived-kitchenette-college','Mini fridge, kettle & a big plant',r=>frontAnchors(r,0).concat(footAnchors(r,Math.PI/2)),g=>{
   const a=phase(g,ALL,'Mini fridge & plant');fridge(a,[150,0,0],Math.PI/2);floorPlant(a,[-330,0,-20],C.terracotta,3,true);
  },{tall:true});
  if(cubby){const s=fixture(cubby,'lived-shelf-college','Trailing pothos, candle & a photo');const a=phase(s,ALL);pothos(a,[-185,322,110],C.cream,2);candle(a,[-60,322,60]);frame(a,[230,616,30],-.2,fin('#ffffff',.9,{map:canvasMap((c,w,hh)=>{c.fillStyle='#efe8da';c.fillRect(0,0,w,hh);c.strokeStyle='#4f6b52';c.lineWidth=3;c.beginPath();c.moveTo(w*.5,hh*.92);c.quadraticCurveTo(w*.46,hh*.5,w*.56,hh*.1);c.stroke();for(let i=0;i<9;i++){const t=.18+i*.08,y=hh*(.9-t*.85),x=w*(.5+.04*Math.sin(t*3));for(const s of [-1,1]){c.fillStyle=i%2?'#7d9a6e':'#5f7f5a';c.beginPath();c.ellipse(x+s*w*(.1-i*.006),y,w*(.11-i*.007),hh*.025,s*.5,0,7);c.fill();}}c.fillStyle='#4f4a40';c.font='14px serif';c.fillText('Pteridium, pressed',w*.18,hh*.97);},192,256)}));/* a pressed-fern print, the only framed piece on any cabinet */}
  const r=fixture(root,'lived-rug-college','Yoga mat, notes and a shared project',[l.play[0],9.2,l.play[1]]);
  const rm=loose(phase(r,['morning'],'Yoga mat out before class'));yogaMat(rm,R(430,400),Math.PI/2-.05,C.second);
  const rp=loose(phase(r,['party'],'Cushions, snacks and a laptop'));[[R(110,380),C.cloth],[R(880,360),C.second]].forEach(([at,col],i)=>floorCushion(rp,at,col,i,51+i,[180,55,180]));snackBowl(rp,R(480,300),120,C.feature,9);laptop(rp,R(480,660),2.9,true,screenMat('doc'));
  settleRug(r);
 }

 // ---------------- Nightstand and the study chair (school ages onward) ----------
 if(!early){
  const nsCands=[];for(let dx=270;dx<=420;dx+=30)for(let dz=240;dz<=420;dz+=60)nsCands.push([bedRight+dx,l.back+dz]);
  placeFloor('lived-nightstand-'+age,'Nightstand · what is kept within reach',()=>nsCands,g=>{
   const body=age==='primary'?C.second:age==='preteen'?C.cream:age==='teen'?C.charcoal:C.cloth;const hh=age==='primary'?470:520;const a=phase(g,ALL,'Nightstand');nightstand(a,[0,0,0],0,body,C.wood,hh);
   const top=hh,day=phase(g,AWAKE,'Things on the nightstand'),night=phase(g,['night'],'Night things on the nightstand');
   if(age==='primary'){alarmClock(day,[-100,top,-40]);bookStack(day,[90,top,20],2,[C.red,C.blue],2,[150,22,200]);alarmClock(night,[-100,top,-40]);water(night,[110,top,-60]);book(night,[60,top,60],[150,24,190],C.second,.2);}
   if(age==='preteen'){pothos(day,[-110,top,-40],C.accent,4);rbox(day,[160,4,160],[80,top+2,60],C.accent,1);pothos(night,[-110,top,-40],C.accent,4);phone(night,[90,top,40],.2);cable(night,[[90,top+5,-40],[150,top+3,-110],[185,top-5,-140],[185,top-180,-140]]);water(night,[40,top,-80]);}
   if(age==='teen'){cassettes(day,[-90,top,-20],2);phone(night,[-60,top,10],.3);cable(night,[[-60,top+5,-70],[40,top+3,-110],[185,top-10,-140],[185,top-200,-140]]);headphones(night,[80,top,40],.4);const keep=phase(g,ALL,'The old rabbit on the low shelf');rabbit(keep,[0,157,20],.42,0,0);}
   if(age==='college'){mug(day,[100,top,-40],C.accent,38,92);bookStack(day,[-80,top,30],2,[C.ink,C.feature],5,[160,24,210]);bookStack(night,[-80,top,30],3,[C.ink,C.feature,C.accent],5,[160,24,210]);glasses(night,[80,top,60],.5);water(night,[110,top,-80]);}
  },{front:false});
  if(chair){
   const d=fixture(chair,'lived-chair-'+age,'Clothes on the chair back');
   const day=phase(d,['morning','afternoon','evening','party'],'Hoodie over the chair');drape(day,age==='primary'?C.yellow:age==='preteen'?C.accent:age==='teen'?fin('#9a9d9f',.98):fin('#dccdb2',.98),age!=='primary');
   const night=phase(d,['night'],'Tomorrow’s clothes over the chair');drape(night,age==='primary'?C.blue:age==='teen'?C.accent:C.denim,false);
   bakeAll(d);
  }
  // Project table clutter: drinks, snacks, cables, notes. The 1000 × 700 top
  // keeps its central work; these belongings use its free corners.
  if(craft){
   const y=age==='primary'?450:720,t=fixture(craft,'lived-table-'+age,'Snacks, drinks and notes on the project table');
   const s=[[-430,-280],[-430,275],[420,265],[455,-285]];
   const dayT=phase(t,['afternoon'],'Working clutter'),bf=phase(t,['morning'],'Breakfast at the table');
   // Morning: breakfast before school/class, eaten at the project table.
   {const [bx,bz]=s[0];lathe(bf,[[0,0],[45,0],[78,48],[72,48],[40,8],[0,8]],[bx+20,y,bz+20],C.white);for(let k=0;k<8;k++)ball(bf,[12,6,12],[bx+20+Math.cos(k)*35,y+40,bz+20+Math.sin(k)*35],C.yellow);rod(bf,[bx+50,y+40,bz+10],[bx+110,y+60,bz-30],4,C.steel);
    cyl(bf,90,90,8,[s[1][0]+30,y+4,s[1][1]-20],C.white,null,24);rbox(bf,[100,16,90],[s[1][0]+20,y+16,s[1][1]-20],fin('#d9a35c',.9),6).rotation.y=.4;rbox(bf,[90,14,80],[s[1][0]+45,y+30,s[1][1]-30],fin('#d9a35c',.9),6).rotation.y=-.2;
    if(age==='primary'||age==='preteen')cyl(bf,32,28,110,[s[2][0],y+55,s[2][1]],fin('#f0a33a',.3));else mug(bf,[s[2][0],y,s[2][1]],age==='teen'?C.accent:C.ink);
    if(age==='primary')lunchbox(bf,[s[3][0]-60,y,s[3][1]+40],.2,C.red);if(age==='teen'){const b=ball(bf,[90,24,24],[s[3][0]-60,y+22,s[3][1]+40],C.yellow);b.rotation.y=.5;}if(age==='college'){lathe(bf,[[0,0],[48,0],[48,190],[30,215],[0,215]],[s[3][0]-60,y,s[3][1]+40],C.glass);rod(bf,[s[3][0]-60,y+215,s[3][1]+40],[s[3][0]-60,y+260,s[3][1]+40],5,C.charcoal);}if(age==='preteen')phone(bf,[s[3][0]-60,y,s[3][1]+40],.5);}const party=phase(t,['party'],'Snacks for the group');const night=phase(t,['night'],'Mug left from the evening');
   if(age==='primary'){juiceBox(dayT,[s[0][0],y,s[0][1]]);apple(dayT,[s[1][0],y,s[1][1]]);stickies(dayT,[s[2][0]-40,y,s[2][1]-30],[C.yellow,C.pink]);for(let i=0;i<3;i++)cup(party,[s[i][0],y,s[i][1]],[C.red,C.blue,C.yellow][i]);snackBowl(party,[s[3][0]-30,y,s[3][1]+20],70,C.yellow,6);}
   if(age==='preteen'){mug(dayT,[s[0][0],y,s[0][1]],C.second);stickies(dayT,[s[1][0]-20,y,s[1][1]-30],[C.yellow,C.pink,C.green]);phone(dayT,[s[2][0],y,s[2][1]],.4);for(let i=0;i<3;i++)cup(party,[s[i][0],y,s[i][1]],[C.red,C.second,C.yellow][i]);snackBowl(party,[s[3][0]-30,y,s[3][1]+20],70,C.yellow,8);mug(night,[s[0][0],y,s[0][1]],C.second);}
   if(age==='teen'){mug(dayT,[s[0][0],y,s[0][1]],C.accent);mug(dayT,[s[0][0]+90,y,s[0][1]+40],C.white);chipBag(dayT,[s[1][0]+30,y,s[1][1]-40],.4,C.yellow);charger(dayT,[s[2][0],y,s[2][1]],[[s[2][0],y+10,s[2][1]-35],[s[2][0]-60,y+3,s[2][1]-90],[s[2][0]-150,y+3,s[2][1]-40],[s[2][0]-190,y+3,s[2][1]+20]]);stickies(dayT,[s[3][0]-40,y,s[3][1]],[C.yellow,C.pink,C.green]);
    for(let i=0;i<3;i++)cup(party,[s[i][0],y,s[i][1]],[C.red,C.white,C.second][i]);chipBag(party,[s[3][0]-40,y,s[3][1]+10],-.3,C.yellow);mug(night,[s[0][0],y,s[0][1]],C.accent);mug(night,[s[0][0]+90,y,s[0][1]+40],C.white);}
   if(age==='college'){mug(dayT,[s[0][0],y,s[0][1]],C.ink);highlighters(dayT,[s[1][0]-30,y,s[1][1]-40],.3);stickies(dayT,[s[2][0]-40,y,s[2][1]-30],[C.yellow,C.green]);charger(dayT,[s[3][0],y,s[3][1]],[[s[3][0]-35,y+10,s[3][1]],[s[3][0]-120,y+3,s[3][1]+40],[s[3][0]-200,y+3,s[3][1]+10]]);
    for(let i=0;i<3;i++)mug(party,[s[i][0],y,s[i][1]],[C.ink,C.accent,C.white][i]);snackBowl(party,[s[3][0]-30,y,s[3][1]+20],70,C.feature,10);mug(night,[s[0][0],y,s[0][1]],C.ink);}
   bakeAll(t);
  }
 }
 // Bed-top stories have to read at the wide camera: books, torches, laptops,
 // headphones and glasses are built 40% larger (furniture props stay true).
 if(bedLayer)for(const ph of bedLayer.children)if(ph.userData.livedPhases&&!/Throw|Soft friends|Rabbit and|old rabbit|laid out|tiny outfit|tucked|never quite/i.test(ph.name))for(const c of ph.children)if(!c.isMesh&&!c.userData.livedDuvet)c.scale.multiplyScalar(1.4);
 if(bedLayer)bakeAll(bedLayer);
 if(cubby)for(const f of [...cubby.children])if(f.userData.childLivedIn)bakeAll(f);
 // Duvet folds follow whatever material the bedding layer gives the quilt.
 // The quilt is usually a white material carrying a printed map: average the
 // map (once per map) so the thrown-back duvet wears the quilt's real colour.
 const mapTone=new WeakMap(),toneOf=map=>{if(!map?.image)return null;if(mapTone.has(map))return mapTone.get(map);let tone=null;try{const src=map.image,c=document.createElement('canvas');c.width=c.height=8;const x=c.getContext('2d');x.drawImage(src,0,0,8,8);const d=x.getImageData(0,0,8,8).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}const n=d.length/4;if(n&&Number.isFinite(r))tone=new THREE.Color().setRGB(r/n/255,g/n/255,b/n/255,THREE.SRGBColorSpace);}catch{tone=null;}mapTone.set(map,tone);return tone;};
 const syncDuvet=()=>{const q=bed?.children.find(o=>o.isMesh&&Math.abs(o.position.y-361)<.1);if(!q?.material?.color)return;duvetCloth.color.copy(q.material.color);const t=toneOf(q.material.map);if(t)duvetCloth.color.multiply(t);duvetCloth.color.multiplyScalar(.95);};
 let meshes=0;[...clusters,bedLayer,...root.children.filter(o=>/^lived-/.test(o.userData.propId||'')),...(cubby?cubby.children:[]),...(craft?craft.children:[]),chair].filter(Boolean).forEach(g=>{if(g.userData.childLivedIn!==undefined||g===bedLayer)g.traverse(o=>{if(o.isMesh)meshes++;});});
 root.userData.childLivedIn={age,floorIds,clusters:clusters.map(c=>c.userData.propId),meshes,phase:'morning',looseOut:0};
 return {floorIds,update(phaseId){for(const g of phaseNodes)g.visible=g.userData.livedPhases.includes(phaseId);syncDuvet();
  let out=0;for(const g of looseNodes)if(g.visible)out++;root.userData.childLivedIn.phase=phaseId;root.userData.childLivedIn.looseOut=out;}};
}
