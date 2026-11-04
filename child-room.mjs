import * as THREE from 'three';
import {interiorCraftFinishes} from './interior-craft-detail.mjs';
import {buildChildActivities} from './child-room-activities.mjs';
import {enhanceChildInteriors} from './child-interior-detail.mjs';

const tiers=[
 ['apartment','Little explorer · cozy room',3800,4400,2700],
 ['house','Storybook bedroom & play corner',4600,5200,2800],
 ['spacious','Little maker · bedroom & playroom',5600,6200,2900],
 ['premium','Story garden · family play studio',6600,7200,3000],
 ['executive','Little worlds · bedroom & discovery room',7800,8200,3100]
];
export const CHILD_LAYOUTS=Object.fromEntries(tiers.map(([id,name,width,depth,height],tier)=>{
 const back=-1600,front=back+depth;
 return [id,{id,name,width,depth,height,back,tier,desktopSize:'48x30',customLife:true,
  desk:[width/2-900,back+920],bed:[-width/2+720,back+1180],
  storage:[-width/2+700,front-1450],play:[tier?0:250,front-(tier?1450:1000)],
  reading:[-width/2+1150,front-550],groovePoses:{morning:{dx:-70,dz:25,yaw:0},afternoon:{dx:0,dz:0,yaw:0},evening:{dx:-80,dz:30,yaw:0},night:{dx:0,dz:0,yaw:0},party:{dx:-60,dz:20,yaw:0}},props:[],daylight:[width/2-100,back+1500]}];
}));
export const childLayoutById=id=>CHILD_LAYOUTS[id]||CHILD_LAYOUTS.house;
export const childLayoutForSize=()=>CHILD_LAYOUTS.house;
export function migrateChildRack(obj,saved,layout){
 if(obj.userData.propId!=='story-rack'||!saved)return saved;
 const front=layout.back+layout.depth,first={p:[-layout.width/2+260,0,front-1150],q:{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2}},second={p:[-layout.width/2+700,0,front-1150],q:{x:0,y:0,z:0,w:1}};
 const untouched=[first,second].some(old=>['x','y','z'].every((a,i)=>Math.abs(saved.p[a]-old.p[i])<.01&&Math.abs(saved.s[a]-1)<.00001)&&['x','y','z','w'].every(a=>Math.abs(saved.q[a]-old.q[a])<.00001));
 if(!untouched)return saved;
 // Original auto-saved defaults gain a browsing aisle. Owner edits stay put.
 return {p:{x:obj.position.x,y:obj.position.y,z:obj.position.z},q:{x:obj.quaternion.x,y:obj.quaternion.y,z:obj.quaternion.z,w:obj.quaternion.w},s:{x:obj.scale.x,y:obj.scale.y,z:obj.scale.z}};
}
const mode=(label,description,power,ambient,exposure,sky,colors,practical,tilt=0)=>({label,description,power,ambient,bounce:ambient*1.4,exposure,sky,colors,practical,wash:practical,key:sky[1],fill:'#d7e4ec',accent:colors[0],height:28,tilt,offset:[0,0],yaw:0,leds:false});
export const CHILD_MODES={
 morning:{...mode('Wake & discover','Fresh window light · a small building and sorting invitation',1.5,.46,1.06,['#9bc9df','#fff1d7'],['#ffe5b8','#b3d0bd'],.12),fill:'#dde9ef'},
 afternoon:{...mode('Make & play','Low drawing station · colours and a work in progress',1.25,.48,1.06,['#aed4e3','#fff2dd'],['#ffe5bc','#c3d7c3'],.2,8),fill:'#e6eceb'},
 evening:{...mode('Story time','An open picture book · warm light in the reading nook',.48,.27,1.12,['#6b88a5','#f4bc98'],['#ffd6a0','#bac8d1'],.85),fill:'#c5cedd'},
 night:{...mode('Sleepy stars','Play mat cleared · reading lamp off and a low amber moon',.07,.13,1.1,['#14253b','#344c64'],['#ffcf91','#9cb3cb'],.22),fill:'#96a7bf'},
 party:{...mode('Family play','A railway village · shared drawing and picture books',1.0,.44,1.08,['#9dbbd0','#f0e4ce'],['#ffe0ac','#a9cbbb'],.5),fill:'#e2e5de'}
};
export const CHILD_LIGHT_CUES={
 morning:{reading:0,moon:0,blind:.04,window:.22},
 afternoon:{reading:.08,moon:0,blind:.1,window:.2},
 evening:{reading:1,moon:.15,blind:.4,window:.06},
 night:{reading:0,moon:.26,blind:.9,window:.008},
 party:{reading:.35,moon:0,blind:.07,window:.18}
};
const jitter=n=>{const s=Math.sin(n*127.1+91.7)*43758.54;return s-Math.floor(s);};
function canvasTexture(draw,w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function illustration(kind){return canvasTexture((c,w,h)=>{
 c.fillStyle='#f4ead5';c.fillRect(0,0,w,h);
 if(kind==='rainbow'){
  for(const [i,col] of ['#c68469','#dfb665','#8aab9c','#7e9eab'].entries()){c.strokeStyle=col;c.lineWidth=30;c.beginPath();c.arc(w/2,h*.77,155-i*35,Math.PI,0);c.stroke();}
  c.fillStyle='#526d65';c.font='24px serif';c.textAlign='center';c.fillText('little wonders',w/2,h*.95);
 }else if(kind==='forest'){
  c.fillStyle='#e4c47d';c.beginPath();c.arc(w*.75,h*.22,50,0,7);c.fill();
  for(let i=0;i<4;i++){c.fillStyle=['#b7c7a2','#8faf98','#6a8f82','#486e68'][i];c.beginPath();c.moveTo(0,h);for(let x=0;x<=w;x+=8)c.lineTo(x,h*(.52+i*.1)+Math.sin(x/70+i)*32);c.lineTo(w,h);c.fill();}
 }else if(kind==='boat'){
  c.fillStyle='#83a8b6';c.fillRect(0,h*.65,w,h*.35);c.fillStyle='#b67b61';c.beginPath();c.moveTo(w*.2,h*.6);c.lineTo(w*.8,h*.6);c.lineTo(w*.68,h*.76);c.lineTo(w*.33,h*.76);c.fill();c.strokeStyle='#5b7569';c.lineWidth=7;c.beginPath();c.moveTo(w*.5,h*.2);c.lineTo(w*.5,h*.62);c.stroke();c.fillStyle='#d4b268';c.beginPath();c.moveTo(w*.48,h*.2);c.lineTo(w*.48,h*.54);c.lineTo(w*.23,h*.54);c.fill();
 }else if(kind==='animal'){
  c.fillStyle='#c78664';c.beginPath();c.ellipse(w*.5,h*.62,w*.24,h*.19,0,0,7);c.fill();c.beginPath();c.moveTo(w*.3,h*.47);c.lineTo(w*.35,h*.22);c.lineTo(w*.49,h*.44);c.lineTo(w*.65,h*.22);c.lineTo(w*.7,h*.47);c.fill();c.fillStyle='#f4e5cb';c.beginPath();c.ellipse(w*.5,h*.66,w*.13,h*.09,0,0,7);c.fill();c.fillStyle='#445f59';for(const x of [.41,.59]){c.beginPath();c.arc(w*x,h*.53,7,0,7);c.fill();}
 }else if(kind==='moon'){
  c.fillStyle='#778da8';c.fillRect(0,0,w,h);c.fillStyle='#f4dfac';c.beginPath();c.arc(w*.57,h*.38,w*.2,0,7);c.fill();c.fillStyle='#778da8';c.beginPath();c.arc(w*.66,h*.32,w*.18,0,7);c.fill();c.fillStyle='#f3e7c5';for(let i=0;i<20;i++){c.beginPath();c.arc(jitter(i+40)*w,jitter(i+80)*h,2+i%3,0,7);c.fill();}
 }else{
  c.strokeStyle='#8ba8a0';c.lineWidth=7;c.beginPath();c.arc(w*.36,h*.36,55,0,7);c.moveTo(w*.36,h*.47);c.lineTo(w*.36,h*.78);c.moveTo(w*.18,h*.59);c.lineTo(w*.54,h*.59);c.moveTo(w*.36,h*.78);c.lineTo(w*.2,h*.95);c.moveTo(w*.36,h*.78);c.lineTo(w*.51,h*.93);c.stroke();
  c.strokeStyle='#cf976d';c.strokeRect(w*.62,h*.46,w*.25,h*.36);c.beginPath();c.moveTo(w*.59,h*.46);c.lineTo(w*.74,h*.23);c.lineTo(w*.9,h*.46);c.stroke();
 }
});}
export function createChildDeskKit({box,mesh,material}){
 const root=new THREE.Group();root.name='Little maker · colouring book';root.userData.dayKit=true;
 const cover=material('#b38b65',{roughness:.87}),paper=material('#f3e9d3',{roughness:.96});
 for(let phase=0;phase<5;phase++){
  const g=new THREE.Group();root.add(g);g.visible=phase===0;g.userData.childDeskPhase=phase;
  box(g,[160,4,135],[0,2,0],cover,2);box(g,[154,8,130],[0,8,0],paper,1);
  if(phase===3){box(g,[160,4,135],[0,14,0],cover,2);continue;}
  const page=mesh(g,new THREE.PlaneGeometry(150,126),material('#ffffff',{map:illustration(['animal','drawing','moon','moon','boat'][phase]),roughness:.96}),[0,12.1,0]);page.rotation.x=-Math.PI/2;page.userData.presentationOnly=true;
  for(let i=0;i<3;i++){const crayon=mesh(g,new THREE.CylinderGeometry(4.5,4.5,65,8),material(['#b97962','#6f9785','#c6a44e'][i],{roughness:.88}),[87+i*12,4.5,0]);crayon.rotation.x=Math.PI/2;}
 }
 return root;
}

export function buildChildRoom(room,root,l,h){
 room.migrateSavedTransform=(obj,saved)=>migrateChildRack(obj,saved,l);
 const {box,mesh,rod,sphere,material,markSceneAsset}=h,{width:w,depth:d,height:height,back,tier,bed,play,storage,reading}=l,front=back+d;
 root.ownedTextures||=[];const own=t=>(root.ownedTextures.push(t),t),artMaps=new Map(),art=kind=>{if(!artMaps.has(kind))artMaps.set(kind,own(illustration(kind)));return artMaps.get(kind);};
 const mat=(color,surface,roughness=.85)=>{const m=material(color,{roughness,metalness:0});m.userData.roomSurface=surface;m.userData.roomFinishLocked=true;return m;};
 const plaster=mat('#eee9dc','plaster',.96),sage=mat('#9db6a2','plaster',.95),oak=mat('#d0b38c','wood',.57),cream=mat('#eee5cf','powder',.64),coral=mat('#bc816b','powder',.7),blue=mat('#7f9fae','powder',.7),mustard=mat('#cfac61','powder',.72),linen=mat('#e8dfcb','fabric',.97),green=mat('#91a693','fabric',.98),ink=mat('#415a56','powder',.78),paper=mat('#f3ead6','powder',.98);
 const group=(id,name,at=[0,0,0],parent=root)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;markSceneAsset(g,{key:`childroom:${l.id}:fixture:${id}`});return g;};
 const bounds=[];const footprint=(g,hw,hd)=>bounds.push({id:g.userData.propId,x:g.position.x,z:g.position.z,halfWidth:hw,halfDepth:hd});
 // Oak floorboards have staggered seams and subdued variation, rather than a
 // uniformly shiny slab. The little room keeps an unobstructed central route.
 const floor=group('floor','Pale oak floor');floor.userData.presentationOnly=true;
 const boards=[];for(let x=-w/2,col=0;x<w/2;x+=180,col++)for(let start=back-(col%3)*300;start<front;start+=900){const z=Math.max(back,start),len=Math.min(start+900,front)-z,bw=Math.min(180,w/2-x);if(len>0)boards.push({at:[x+bw/2,-9,z+len/2],size:[bw-1.5,18,len-1.5]});}
 const planks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),oak.clone(),boards.length),matrix=new THREE.Matrix4();boards.forEach((b,i)=>{matrix.compose(new THREE.Vector3(...b.at),new THREE.Quaternion(),new THREE.Vector3(...b.size));planks.setMatrixAt(i,matrix);planks.setColorAt(i,new THREE.Color().setScalar(.94+jitter(i)*.1));});planks.receiveShadow=true;floor.add(planks);
 const rear=new THREE.Group();root.add(rear);box(rear,[w, height,80],[0,height/2,back-40],plaster);box(rear,[w,880,12],[0,440,back+6],sage);box(rear,[w,22,28],[0,891,back+14],oak);box(rear,[w,100,20],[0,50,back+10],cream);room.walls.push({obj:rear,axis:'x',limit:back*root.scale.x});
 const left=new THREE.Group();root.add(left);box(left,[80,height,d],[-w/2-40,height/2,back+d/2],plaster);box(left,[20,100,d],[-w/2+10,50,back+d/2],cream);room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});
 const right=new THREE.Group();root.add(right);const windowZ=back+1500,ww=1500,low=850,wh=1450;
 box(right,[80,low,d],[w/2+40,low/2,back+d/2],plaster);box(right,[80,height-low-wh,d],[w/2+40,low+wh+(height-low-wh)/2,back+d/2],plaster);
 for(const [z,len] of [[back+(windowZ-ww/2-back)/2,windowZ-ww/2-back],[(windowZ+ww/2+front)/2,front-windowZ-ww/2]])box(right,[80,wh,len],[w/2+40,low+wh/2,z],plaster);
 const sky=own(canvasTexture(()=>{})),skyMat=material('#ffffff',{map:sky,roughness:1,emissive:'#c4d7cf',emissiveIntensity:.18});
 const paintSky=id=>{const m=CHILD_MODES[id],canvas=sky.image,c=canvas.getContext('2d'),tw=canvas.width,th=canvas.height;c.clearRect(0,0,tw,th);const grad=c.createLinearGradient(0,0,0,th);grad.addColorStop(0,m.sky[0]);grad.addColorStop(1,m.sky[1]);c.fillStyle=grad;c.fillRect(0,0,tw,th);
  const sun=id==='morning'?[.75,.26]:id==='evening'?[.12,.68]:[.35,.22];c.fillStyle=id==='night'?'#ead8af':'#f9dfaa';c.beginPath();c.arc(tw*sun[0],th*sun[1],id==='night'?22:34,0,7);c.fill();
  if(id==='night'){c.fillStyle=m.sky[0];c.beginPath();c.arc(tw*sun[0]+11,th*sun[1]-5,21,0,7);c.fill();c.fillStyle='#ddd9c7';for(let i=0;i<25;i++){c.beginPath();c.arc(jitter(i+40)*tw,jitter(i+90)*th*.65,1+i%2,0,7);c.fill();}}
  for(let row=0;row<2;row++){c.fillStyle=id==='night'?['#2d4350','#223943'][row]:id==='evening'?['#879c90','#657f75'][row]:['#a0b8a2','#789a81'][row];for(let i=0;i<8;i++){c.beginPath();c.arc(i*90,th+45+row*45-jitter(i)*65,100,0,7);c.fill();}}sky.needsUpdate=true;};
 const view=mesh(right,new THREE.PlaneGeometry(ww,wh),skyMat,[w/2+65,low+wh/2,windowZ]);view.rotation.y=-Math.PI/2;view.castShadow=false;
 const blind=box(right,[30,1,ww-35],[w/2-38,low+wh,windowZ],linen,2);blind.userData.presentationOnly=true;
 for(const z of [windowZ-ww/2,windowZ,windowZ+ww/2])box(right,[95,wh+80,38],[w/2-10,low+wh/2,z],cream,3);
 for(const y of [low,low+wh])box(right,[130,45,ww+90],[w/2-15,y,windowZ],cream,3);
 // Linen curtains sit outside the glazing and leave the working bay clear.
 for(const z of [windowZ-ww/2-140,windowZ+ww/2+140]){const geo=new THREE.PlaneGeometry(260,wh+170,24,16),pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const u=pos.getX(i)/260;pos.setZ(i,Math.sin(u*Math.PI*10)*18+Math.cos(pos.getY(i)/400)*3);}geo.computeVertexNormals();const curtain=mesh(right,geo,linen.clone(),[w/2-100,low+wh/2-30,z]);curtain.rotation.y=-Math.PI/2;curtain.material.side=THREE.DoubleSide;curtain.material.userData.roomSurface='fabric';}
 room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
 // A personal growth chart and a little cloth wall pocket add everyday life
 // at a child's reach, with their backs mounted directly to the wall.
 const chart=own(canvasTexture((c,tw,th)=>{c.fillStyle='#efe4cc';c.fillRect(0,0,tw,th);c.fillStyle='#587c70';c.font='26px serif';c.textAlign='center';c.fillText('little by little',tw/2,45);for(let i=0;i<=18;i++){const y=th-55-i*44;c.strokeStyle=i%2?'#b2b6a0':'#66877c';c.lineWidth=2;c.beginPath();c.moveTo(25,y);c.lineTo(i%2?65:100,y);c.stroke();if(i%2===0){c.fillStyle='#587c70';c.font='21px sans-serif';c.fillText(String(50+i*5),135,y+7);}}},256,1024));
 const growth=group('growth-chart','Little by little · linen growth chart',[w/2-15,940,back+2800],right);growth.rotation.y=-Math.PI/2;box(growth,[210,980,8],[0,0,0],linen,3);const growthPrint=mesh(growth,new THREE.PlaneGeometry(200,960),material('#ffffff',{map:chart,roughness:.98}),[0,0,4.2]);growthPrint.castShadow=false;rod(growth,[-120,500,0],[120,500,0],8,oak);
 const pocket=group('wall-pocket','Canvas picture-book pocket',[w/2-25,1150,front-650],right);pocket.rotation.y=-Math.PI/2;box(pocket,[440,360,25],[0,0,0],linen,8);box(pocket,[430,225,75],[0,-65,35],green,8);for(let i=0;i<2;i++)box(pocket,[145,210,15],[-100+i*190,40,35],[blue,coral][i],3);

 const frame=(parent,id,x,y,z,kind,width=470,hh=540)=>{const g=group(id,'Original storybook print',[x,y,z],parent);box(g,[width+32,hh+32,22],[0,0,0],oak,3);const map=art(kind);box(g,[width,hh,3],[0,0,13],material('#ffffff',{map,roughness:.96}));};
 frame(rear,'rainbow-print',-80,1740,back+22,'rainbow',460,510);frame(rear,'forest-print',560,1740,back+22,'forest',420,510);
 // Low house bed: rounded timber, tucked quilt and pillows with seam detail.
 const b=group('house-bed','Low oak storybook bed',[bed[0],0,bed[1]]);footprint(b,590,1060);
 for(const x of [-480,480])for(const z of [-910,910])box(b,[95,30,95],[x,15,z],oak,8);box(b,[1180,160,2120],[0,110,0],oak,14);box(b,[1100,155,2040],[0,267.5,0],linen,25);
 for(const x of [-560,560]){for(const z of [-1000,1000])box(b,[45,1350,45],[x,715,z],oak,7);rod(b,[x,1390,-1000],[x,1800,0],24,oak);rod(b,[x,1800,0],[x,1390,1000],24,oak);}
 rod(b,[-560,1800,0],[560,1800,0],24,oak);
 box(b,[1110,32,1320],[0,361,300],green,12);for(const z of [-310,-240,900])box(b,[1060,2,5],[0,378,z],linen,1);
 for(const x of [-265,265]){const p=box(b,[440,90,300],[x,390,-760],linen,25);p.rotation.y=x<0?.08:-.06;}
 box(b,[40,240,900],[-565,300,-500],oak,7);box(b,[40,240,900],[565,300,-500],oak,7);
 // Story rack faces into the play area; large book covers are separate from
 // real wood and paper materials and each rests on its own shelf ledge.
 const rack=group('story-rack','Low front-facing picture-book library',[storage[0],0,storage[1]]);footprint(rack,660,200);
 for(const x of [-630,630])box(rack,[30,670,360],[x,335,0],oak,7);
 box(rack,[1290,660,18],[0,340,-170],cream,5);
 for(let row=0;row<2;row++){const y=95+row*290;box(rack,[1260,24,340],[0,y-12,0],oak,4);box(rack,[1260,80,25],[0,y+40,155],oak,4);
  for(let i=0;i<4;i++){const bw=220+(i%2)*20,bh=220+(i%3)*15,x=-465+i*305;box(rack,[bw,bh,24],[x,y+bh/2,25],paper,3);const cover=art(['forest','animal','boat','moon'][(i+row*2)%4]);box(rack,[bw-8,bh-8,1],[x,y+bh/2,38],material('#ffffff',{map:cover,roughness:.94}));}}
 // Open weave storage baskets and large wood toys, rather than arbitrary
 // glossy cubes. Contents stay within their cubbies.
 const cubby=group('toy-cubby','Oak cubbies & woven toy baskets',[w/2-310,0,front-700]);cubby.rotation.y=-Math.PI/2;footprint(cubby,310,700);
 box(cubby,[1400,28,560],[0,14,0],oak,5);box(cubby,[1400,28,560],[0,602,0],oak,5);box(cubby,[1400,28,560],[0,308,0],oak,5);
 for(const x of [-686,0,686])box(cubby,[28,588,560],[x,308,0],oak,5);box(cubby,[1370,588,16],[0,308,-272],cream,4);
 for(const [i,x] of [-344,344].entries()){const basket=group('basket-'+i,'Woven toy basket',[x,28,20],cubby);const slats=[];for(let j=0;j<13;j++)slats.push([[540,10,12],[0,18+j*16,220]],[[12,10,440],[-270,18+j*16,0]],[[12,10,440],[270,18+j*16,0]]);const weave=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),linen,slats.length),matrix=new THREE.Matrix4();slats.forEach(([size,at],i)=>{matrix.compose(new THREE.Vector3(...at),new THREE.Quaternion(),new THREE.Vector3(...size));weave.setMatrixAt(i,matrix);});weave.castShadow=weave.receiveShadow=true;basket.add(weave);box(basket,[540,12,440],[0,6,0],linen);box(basket,[86,20,3],[0,118,228],oak,2);}
 for(let i=0;i<7;i++){const m=[coral,blue,mustard,cream][i%4];box(cubby,[55,55,55],[-520+i*80,349.5,0],m,4);}
 // Larger rooms add genuinely different play zones rather than expanding
 // the same empty floor around the furniture.
 let craft=null,market=null;const marketGoods=[];
 if(tier>=1){
  const shop=group('pretend-market','Low wooden pretend market',[-w/2+260,0,back+2780]);market=shop;shop.rotation.y=Math.PI/2;footprint(shop,260,420);
  box(shop,[840,35,480],[0,542.5,0],oak,8);for(const x of [-395,395])box(shop,[35,525,460],[x,262.5,0],cream,5);box(shop,[800,28,440],[0,120,0],oak,5);box(shop,[800,430,18],[0,310,-210],sage,4);
  for(let i=0;i<3;i++){box(shop,[205,20,260],[-260+i*260,570,0],oak,3);for(let j=0;j<3;j++)marketGoods.push(sphere(shop,[29,32,29],[-310+i*260+j*50,612,0],[coral,mustard,green][i]));}
 }
 if(tier>=2){
  craft=group('little-craft-table','Low shared drawing table',[0,0,back+3000]);footprint(craft,550,850);
  box(craft,[1000,35,700],[0,432.5,0],oak,12);for(const x of [-430,430])for(const z of [-280,280])box(craft,[48,415,48],[x,207.5,z],oak,6);
  for(const z of [-650,650]){box(craft,[360,40,350],[0,280,z],coral,12);for(const x of [-140,140])for(const dz of [-130,130])box(craft,[32,260,32],[x,130,z+dz],oak,5);}

 }
 if(tier>=3){
  const tunnel=group('play-tunnel','Soft canvas discovery tunnel',[w/2-1000,0,front-2250]);footprint(tunnel,430,640);
  // Open curved canvas with exposed timber end hoops, resting on a soft base.
  box(tunnel,[860,40,1280],[0,20,0],green,18);
  const canvas=mesh(tunnel,new THREE.CylinderGeometry(410,410,1220,32,1,true,Math.PI/2,Math.PI),linen.clone(),[0,40,0]);canvas.rotation.x=Math.PI/2;canvas.material.side=THREE.DoubleSide;
  for(const z of [-620,620]){const hoop=mesh(tunnel,new THREE.TorusGeometry(410,12,8,40,Math.PI),oak,[0,40,z]);}
 }
 // Soft play rug with woven edge bands and generous clear circulation.
 const rug=group('play-rug','Wool play mat',[play[0],0,play[1]]);rug.userData.presentationOnly=true;
 const rw=tier?2200:1750,rd=tier?1700:1300;box(rug,[rw,8,rd],[0,4,0],linen,10);
 for(const x of [-rw/2+65,rw/2-65])box(rug,[28,1,rd-70],[x,8.5,0],green,2);
 for(const z of [-rd/2+65,rd/2-65])box(rug,[rw-70,1,28],[0,8.5,z],green,2);
 const nook=group('reading-nook','Linen floor cushion & story basket',[reading[0],0,reading[1]]);footprint(nook,490,380);box(nook,[850,150,650],[0,75,0],green,50);box(nook,[750,15,3],[0,80,326],linen,1);const bolster=box(nook,[650,180,140],[0,190,-220],linen,35);bolster.rotation.z=.04;
 // A sculpted cloth rabbit makes the nook personal without a catalog toy.
 const bunny=group('cloth-rabbit','Soft linen story rabbit',[230,150,40],nook);sphere(bunny,[78,105,63],[0,100,0],linen);sphere(bunny,[65,62,57],[0,235,0],linen);for(const x of [-28,28]){sphere(bunny,[20,90,20],[x,352,0],linen);sphere(bunny,[11,67,9],[x,352,18],coral);}for(const x of [-22,22])sphere(bunny,[4,4,3],[x,245,53],ink);
 // Adjustable family workstation stool with a foot rail. The ErgoFlex itself
 // remains the real 48-inch product and retains its physical height limits.
 const seat=group('desk-stool','Oak workstation stool',[l.desk[0],0,l.desk[1]+800]);footprint(seat,225,225);box(seat,[420,50,400],[0,435,0],oak,18);box(seat,[395,35,375],[0,477.5,0],green,14);for(const x of [-170,170])for(const z of [-160,160])rod(seat,[x,20,z],[x*.85,415,z*.85],23,oak);for(const x of [-170,170])for(const z of [-160,160])mesh(seat,new THREE.CylinderGeometry(27,27,20,16),oak,[x,10,z]);for(const z of [-150,150])rod(seat,[-165,220,z],[165,220,z],16,oak);
 const lights=[],moonGlow=material('#fff0d1',{emissive:'#ffd1a0',emissiveIntensity:0,roughness:.9}),readingGlow=moonGlow.clone();
 const night=group('moon-light','Amber crescent nightlight',[bed[0],1040,back+40],rear);const moon=mesh(night,new THREE.TorusGeometry(105,20,10,40,Math.PI*1.55),moonGlow,[0,0,50]);moon.rotation.z=.35;moon.castShadow=false;
 const addLight=(parent,at,power,channel)=>{const light=new THREE.PointLight('#ffd6a0',0,2200*root.scale.x,2);light.name='Child room · '+channel;light.position.set(...at);parent.add(light);lights.push({light,power,channel});};addLight(night,[0,-50,170],18,'moon');
 const sconce=group('story-lamp','Oak & linen reading lamp',[-w/2+10,1150,reading[1]],left);sconce.rotation.y=-Math.PI/2;box(sconce,[90,160,20],[0,0,0],oak,5);rod(sconce,[0,0,0],[0,120,-170],10,oak);mesh(sconce,new THREE.CylinderGeometry(90,125,180,24,1,true),linen,[0,100,-170]);mesh(sconce,new THREE.SphereGeometry(28,16,12),readingGlow,[0,55,-170]);addLight(sconce,[0,15,-170],55,'reading');
 if(tier>=2){const rail=group('drawing-gallery','Little artist drying gallery',[0,2500,back+40],rear);rod(rail,[-500,0,0],[500,0,0],4,oak);for(let i=0;i<3;i++){box(rail,[230,300,2],[-330+i*330,-175,12],paper);const map=art(i===1?'drawing':'forest');box(rail,[220,290,1],[-330+i*330,-175,14],material('#ffffff',{map,roughness:.96}));box(rail,[20,52,14],[-330+i*330,-20,17],oak,2);}}
 const materials={oak,cream,coral,blue,mustard,linen,green,ink,paper,plaster,sage},groups={bed:b,nook,rack,cubby,rug,rear,left,right,floor,craft,market,marketGoods};
 const activity=buildChildActivities({root,layout:l,helpers:h,materials,groups,art});
 interiorCraftFinishes(room,{linen:[linen,green],wood:[oak,planks.material]});
 const interiors=enhanceChildInteriors({room,root,layout:l,helpers:h,materials,groups});let lastSky=null;
 room.roomAtmosphere=(id,accent=1)=>{const phase=CHILD_MODES[id]?id:'morning',m=CHILD_MODES[phase],cue=CHILD_LIGHT_CUES[phase];activity.update(phase);interiors.update(phase);
  if(lastSky!==phase){paintSky(phase);lastSky=phase;}skyMat.color.set('#ffffff');skyMat.emissiveIntensity=cue.window;skyMat.emissive.set(m.sky[1]);
  blind.scale.y=wh*cue.blind;blind.position.y=low+wh-blind.scale.y/2;
  moonGlow.emissiveIntensity=cue.moon*.9;readingGlow.emissiveIntensity=cue.reading*.8;
  lights.forEach(({light,power,channel})=>{light.intensity=power*cue[channel]*accent;light.color.set(channel==='moon'?'#ffca85':phase==='afternoon'?'#f3e4cb':'#ffd6a0');});
  root.userData.childLighting={phase,reading:cue.reading,moon:cue.moon,blind:cue.blind,sky:m.sky};root.userData.atmosphere=phase;
 };
 root.userData.childRoom={ageRange:'2–6',deskSize:'48x30',furnitureBounds:bounds};root.userData.dimensionsMm={width:w,depth:d,height};room.roomAtmosphere('morning');
}
