import * as THREE from 'three';
import { attachVista } from './window-vista.mjs?v=window-vista-20261110b';
import {loungeDesign} from './lounge-design.mjs';
import {buildLoungeChess} from './lounge-table-games.mjs';
import {dressContemporaryLounge} from './lounge-contemporary-detail.mjs';
import {interiorCraftFinishes} from './interior-craft-detail.mjs';

// A separate architectural/furniture composition, not a recolor of the vinyl
// lounge. Dimensions are millimetres; imported prop roots remain in metres.
export function buildContemporaryLounge(room,root,l,h,modes){
 const {box,mesh,rod,sphere,material,markSceneAsset}=h,p=loungeDesign(l),w=l.width,d=l.depth,b=l.back,front=b+d,height=l.height;
 const own=t=>{(root.ownedTextures||=[]).push(t);return t;};
 const tex=(draw,ww=512,hh=512)=>{const c=document.createElement('canvas');c.width=ww;c.height=hh;draw(c.getContext('2d'),ww,hh);const t=own(new THREE.CanvasTexture(c));t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;};
 const mat=(color,extra={})=>{const m=material(color,{roughness:.8,metalness:0,...extra});m.userData.roomFinishLocked=true;return m;};
 const plaster=mat(p.wall,{roughness:.98}),charcoal=mat(p.dark,{roughness:.64}),steel=mat(p.metal,{roughness:.3,metalness:.9}),cloth=mat(p.rug,{roughness:.98});
 const stoneMap=tex((c,ww,hh)=>{
  c.fillStyle='#e0d8c7';c.fillRect(0,0,ww,hh);
  for(let i=0;i<2200;i++){c.fillStyle=i%2?'#ffffff20':'#71808018';c.fillRect((Math.sin(i*13.12)*.5+.5)*ww,(Math.sin(i*41.8)*.5+.5)*hh,1+i%2,1+i%3);}
  c.strokeStyle='#8d867650';c.lineWidth=1.5;
  for(let i=0;i<5;i++){c.beginPath();c.moveTo(-20,50+i*120);c.bezierCurveTo(ww*.3,30+i*120,ww*.6,180+i*120,ww+20,95+i*120);c.stroke();}
 });
 const plasterGrain=tex((c,ww,hh)=>{c.fillStyle='#808080';c.fillRect(0,0,ww,hh);for(let i=0;i<6000;i++){c.fillStyle=i%2?'#898989':'#777777';c.fillRect((Math.sin(i*19.17)*.5+.5)*ww,(Math.sin(i*31.71)*.5+.5)*hh,1,1);}},256,256);
 plaster.bumpMap=plasterGrain;plaster.bumpScale=.18*root.scale.x;

 const stone=mat(p.stone,{map:stoneMap,roughness:.54}),oak=mat(p.wood,{roughness:.62});
 const fixture=(parent,id,name,at=[0,0,0],turn=0,floor=false)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;g.userData={propId:id,sceneAssetName:name,wallDecoration:!floor,dropSurface:false};parent.add(g);markSceneAsset(g,{key:`lounge:${l.id}:fixture:${id}`});return g;};
 const glow=mat('#e8f0ef',{emissive:'#d3e4e8',emissiveIntensity:.3}),warm=mat('#eee8dc',{emissive:'#ead9bf',emissiveIntensity:.2});
 const line=(parent,size,at,soft=false)=>{const o=box(parent,size,at,soft?warm:glow,2);o.castShadow=false;return o;};
 // Long walnut boards add warmth beneath the leather and mineral furniture.
 const walnutGrain=tex((c,ww,hh)=>{
  c.fillStyle='#dfcdb4';c.fillRect(0,0,ww,hh);
  for(let i=0;i<100;i++){const x=i*ww/100;c.strokeStyle=i%4?'rgba(65,38,22,.22)':'rgba(255,238,208,.35)';c.lineWidth=.7+i%3*.5;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+14*Math.sin(i),hh*.3,x-12,hh*.72,x+3,hh);c.stroke();}
  for(let i=0;i<4;i++){c.strokeStyle='rgba(66,37,20,.2)';c.lineWidth=1;c.beginPath();c.ellipse(ww*.69,hh*.37,8+i*5,26+i*18,.08,0,Math.PI*2);c.stroke();}
 },512,1024);
 const floorWood=mat(p.wood,{map:walnutGrain,roughness:.52,bumpMap:walnutGrain,bumpScale:.08*root.scale.x});
 const tiles=[];for(let row=0,x=-w/2;x<w/2;row++,x+=180)for(let z=b-(row%3)*400;z<front;z+=1200){const start=Math.max(b,z),end=Math.min(front,z+1200);if(end>start)tiles.push({x,z:start,ww:Math.min(180,w/2-x),dd:end-start});}
 const tileGeo=new THREE.BoxGeometry(1,1,1),tile=new THREE.InstancedMesh(tileGeo,floorWood,tiles.length),matrix=new THREE.Matrix4();tiles.forEach((t,i)=>{matrix.compose(new THREE.Vector3(t.x+t.ww/2,-12,t.z+t.dd/2),new THREE.Quaternion(),new THREE.Vector3(t.ww-.6,24,t.dd-.6));tile.setMatrixAt(i,matrix);tile.setColorAt(i,new THREE.Color().setScalar(.88+(i%7)*.028));});tile.receiveShadow=true;root.add(tile);
 const rear=new THREE.Group();root.add(rear);box(rear,[w,height,80],[0,height/2,b-40],plaster);box(rear,[w,65,18],[0,32.5,b+9],charcoal);room.walls.push({obj:rear,axis:'x',limit:b*root.scale.x});
 const hero=fixture(rear,'modern-desk-feature','Centered mineral desk feature',[0,0,b+32]);const heroW=Math.min(2300,w-700);
 box(hero,[heroW,height-190,12],[0,height/2,0],mat(p.feature,{roughness:.87}),10);
 for(const x of [-heroW/2-18,heroW/2+18])line(hero,[9,height-400,8],[x,height/2,12]);
 box(hero,[heroW+130,12,120],[0,height-120,35],charcoal,3);line(hero,[heroW+80,5,30],[0,height-130,74],true);
 const artwork=tex((c,ww,hh)=>{c.fillStyle='#bd9c74';c.fillRect(0,0,ww,hh);c.fillStyle=p.dark;c.fillRect(ww*.08,hh*.18,ww*.35,hh*.65);c.fillStyle=p.accent;c.beginPath();c.ellipse(ww*.66,hh*.49,ww*.24,hh*.38,-.15,0,Math.PI*2);c.fill();c.strokeStyle='#f5f3e8';c.lineWidth=7;c.beginPath();c.moveTo(ww*.13,hh*.67);c.bezierCurveTo(ww*.55,hh*.1,ww*.59,hh*.95,ww*.9,hh*.3);c.stroke();},1024,320);
 const art=fixture(rear,'modern-wide-art','Oversized abstract pigment study',[0,height-530,b+45]);const face=mesh(art,new THREE.PlaneGeometry(heroW-220,440),mat('#ffffff',{map:artwork,roughness:.96}));face.castShadow=false;
 // Flat textile inlay, never a raised hero platform under a moving desk.
 const deskRug=fixture(root,'modern-work-inlay','Flat work-bay textile',[0,0,l.desk[1]+330]);deskRug.userData.presentationOnly=true;box(deskRug,[Math.min(2200,w-350),4,1450],[0,2,0],cloth,12);
 const right=new THREE.Group();root.add(right);box(right,[80,height,d],[w/2+40,height/2,b+d/2],plaster);box(right,[18,65,d],[w/2-9,32.5,b+d/2],charcoal);line(right,[8,7,d-160],[w/2-12,height-140,b+d/2]);room.walls.push({obj:right,axis:'z',limit:-w/2*root.scale.x});
 const left=new THREE.Group();root.add(left);const wz=b+2300,ww=l.tier?1850:1350,low=800,wh=1450,a=wz-ww/2,end=wz+ww/2;
 for(const [z,len] of [[(b+a)/2,a-b],[(end+front)/2,front-end]])box(left,[80,height,len],[-w/2-40,height/2,z],plaster);
 box(left,[80,low,ww],[-w/2-40,low/2,wz],plaster);box(left,[80,height-low-wh,ww],[-w/2-40,(height+low+wh)/2,wz],plaster);
 for(const z of [a,wz,end])box(left,[75,wh+50,25],[-w/2+4,low+wh/2,z],charcoal,3);for(const y of [low,low+wh])box(left,[80,28,ww+50],[-w/2+4,y,wz],charcoal,3);
 room.walls.push({obj:left,axis:'z',limit:w/2*root.scale.x,sign:-1});
 const skyCanvas=document.createElement('canvas');skyCanvas.width=skyCanvas.height=512;const sky=own(new THREE.CanvasTexture(skyCanvas));sky.colorSpace=THREE.SRGBColorSpace;
 const view=mesh(left,new THREE.PlaneGeometry(ww,wh),new THREE.MeshBasicMaterial({map:sky}),[-w/2-50,low+wh/2,wz]);view.rotation.y=Math.PI/2;view.castShadow=false;
 const windowVista=attachVista(view,'city');room.windowViewReady=Promise.all([room.windowViewReady,windowVista.ready]);
 // The glazing and 200 mm curtain margins remain completely unoccupied.
 const media=fixture(right,'modern-media-wall','Timber-framed cinema and acoustic wall',[w/2-12,0,l.loungeZ],-Math.PI/2);
 const cinema=l.tier>=3,mediaW=cinema?2800:2020;
 box(media,[mediaW,cinema?1950:1550,12],[0,cinema?1430:1220,0],mat(p.feature,{roughness:.97}),15);
 const consoleW=cinema?2400:1700;
 box(media,[consoleW,330,350],[0,455,185],charcoal,14);box(media,[consoleW+40,30,390],[0,635,195],stone,8);line(media,[consoleW-130,7,12],[0,282,338],true);
 for(const x of [-(consoleW/2-180),consoleW/2-180])box(media,[145,240,120],[x,785,140],charcoal,10);
 for(const side of [-1,1])for(let i=0;i<4;i++)box(media,[18,cinema?1810:1400,32],[side*(mediaW/2-38-i*30),cinema?1430:1220,14],oak,2);
 for(const x of [-mediaW/2+165,mediaW/2-165])line(media,[7,cinema?1750:1080,9],[x,cinema?1430:1250,14]);
 const sofaRug=fixture(root,'modern-conversation-rug','Large woven conversation rug',[l.sofaX+850,0,l.loungeZ]);sofaRug.userData.presentationOnly=true;box(sofaRug,[l.tier?2700:2250,5,l.tier?2700:2250],[0,2.5,0],cloth,16);
 // A sculptural object and mineral pedestal replace nostalgic mantel objects.
 const sculpture=fixture(root,'modern-sculpture','Brushed-metal loop on mineral pedestal',[-w/2+400,0,b+460],0,true);box(sculpture,[280,650,280],[0,325,0],stone,12);const loop=mesh(sculpture,new THREE.TorusGeometry(115,20,12,48),steel,[0,820,0]);loop.rotation.y=.35;box(sculpture,[150,12,90],[0,656,0],charcoal,5);
 let relief=null;if(l.tier>=2){relief=fixture(right,'modern-wall-relief','Floating mineral relief',[w/2-32,1680,b+2850],-Math.PI/2);for(let i=0;i<3;i++)box(relief,[430,700-i*100,25+i*12],[-520+i*520,0,0],i===1?steel:stone,10);}
 if(l.tier>=3){
  const bar=fixture(root,'modern-refreshments','Flush refreshments cabinet and seats',[-w/2+350,0,l.barZ],Math.PI/2,true);
  box(bar,[1640,880,550],[0,440,0],charcoal,12);box(bar,[1740,40,650],[0,910,0],stone,10);for(const x of [-500,0,500])box(bar,[2,790,2],[x,440,276],steel);
  const shelf=fixture(bar,'modern-bar-shelf','A single refreshments shelf',[0,1740,-100]);box(shelf,[1500,36,260],[0,0,0],charcoal,7);line(shelf,[1420,6,15],[0,-20,115],true);
  for(let i=0;i<3;i++){const cup=mesh(shelf,new THREE.CylinderGeometry(30,25,85,24),i===1?stone:mat(p.accent),[-340+i*110,60,15]);}
  // A small drinks service gives the social bar a purpose beyond coffee.
  const glass=new THREE.MeshPhysicalMaterial({color:'#dce7e6',roughness:.1,metalness:0,transparent:true,opacity:.4,depthWrite:false,clearcoat:1});glass.userData.roomFinishLocked=true;room.ownedMaterials.add(glass);
  const amber=mat('#a65c20',{roughness:.24});box(bar,[400,8,220],[430,934,25],steel,12);
  for(const x of [350,500]){mesh(bar,new THREE.CylinderGeometry(35,32,90,32,1,true),glass,[x,983,25]);mesh(bar,new THREE.CylinderGeometry(29,27,42,32),amber,[x,961,25]);const rim=mesh(bar,new THREE.TorusGeometry(35,2,6,32),steel,[x,1028,25]);rim.rotation.x=Math.PI/2;}
  box(bar,[110,190,100],[-470,1025,30],glass,14);box(bar,[94,90,84],[-470,979,30],amber,10);mesh(bar,new THREE.CylinderGeometry(22,22,75,24),glass,[-470,1157.5,30]);box(bar,[48,28,48],[-470,1209,30],steel,6);
  for(const x of [-350,350]){for(const dx of [-145,145])for(const z of [560,840])rod(bar,[x+dx,0,z],[x+dx,725,z],13,steel);box(bar,[350,35,350],[x,742.5,700],cloth,20);rod(bar,[x-145,300,840],[x+145,300,840],10,steel);}
 }
 if(l.tier>=3){
  const social=fixture(root,'modern-social-table','Upholstered games and conversation setting',[l.tier===4?1700:1400,0,b+4100],0,true);
  mesh(social,new THREE.CylinderGeometry(280,400,690,40),charcoal,[0,345,0]);
  mesh(social,new THREE.CylinderGeometry(720,720,42,64),stone,[0,731,0]);
  const seatCloth=mat(p.seat,{roughness:.98});interiorCraftFinishes(room,{linen:[seatCloth]});
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2,chair=new THREE.Group();chair.position.set(Math.sin(a)*1060,0,Math.cos(a)*1060);chair.rotation.y=a;social.add(chair);
   mesh(chair,new THREE.CylinderGeometry(38,48,400,24),steel,[0,200,0]);
   for(let j=0;j<4;j++){const f=j*Math.PI/2;rod(chair,[0,70,0],[Math.sin(f)*280,16,Math.cos(f)*280],16,steel);}
   mesh(chair,new THREE.CylinderGeometry(242,228,85,48),seatCloth,[0,465,0]);
   const shell=new THREE.LatheGeometry([[222,500],[265,500],[276,550],[276,785],[261,825],[241,835],[224,815],[218,550],[222,500]].map(([x,y])=>new THREE.Vector2(x,y)),48,-Math.PI/2,Math.PI);
   mesh(chair,shell,seatCloth);
  }
  const play=mat('#263e3e',{roughness:.98}),ivory=mat('#dacbb1',{roughness:.4}),chessDark=mat('#293235',{roughness:.38});
  buildLoungeChess(social,{box,mesh,sphere},{wood:oak,ivory,dark:chessDark,felt:play});
  for(const x of [-460,460]){mesh(social,new THREE.CylinderGeometry(50,50,4,32),steel,[x,760,100]);mesh(social,new THREE.CylinderGeometry(38,33,75,24),stone,[x,799.5,100]);mesh(social,new THREE.CylinderGeometry(30,30,2,24),charcoal,[x,835.5,100]);}
 }

 const ceiling=new THREE.Group();ceiling.name='Contemporary opal pendant cluster';root.add(ceiling);room.ceilingFixture=ceiling;const cx=l.tableX,cz=l.loungeZ,pendantY=Math.max(1950,height-1000);
 const opal=mat('#e8e3d5',{roughness:.3,emissive:'#e6cfaa',emissiveIntensity:.32});
 for(let i=0;i<3;i++){const x=cx-280+i*280,y=pendantY+[60,-100,0][i],radius=[90,112,82][i];rod(ceiling,[x,height,cz],[x,y+radius,cz],4,steel);mesh(ceiling,new THREE.CylinderGeometry(20,20,40,20),steel,[x,y+radius+12,cz]);sphere(ceiling,[radius,radius,radius],[x,y,cz],opal).castShadow=false;}
 const dressing=dressContemporaryLounge({room,root,layout:l,helpers:h,p,materials:{oak,steel,stone},groups:{rear,right,left,rug:sofaRug,relief,heroArt:art},fixture,line,artwork});
 const lightSpecs=[{at:[0,2100,l.desk[1]],power:4,role:'desk wash'},{at:[w/2-450,1550,l.loungeZ],power:4,bias:true,role:'media bias'},{at:[l.tableX,pendantY,l.loungeZ],power:4.5,partyColor:2,role:'pendant'},{at:[-w/2+850,1900,l.tier>=3?l.barZ:wz],power:6,role:'refreshments'},...dressing.lamps];
 const lights=lightSpecs.map(s=>{const light=new THREE.PointLight('#f4e8d5',0,5200*root.scale.x,2);light.position.set(...s.at);root.add(light);return {...s,light};});
 const screenMap=tex((c,ww,hh)=>{const g=c.createLinearGradient(0,0,ww,hh);g.addColorStop(0,'#243b51');g.addColorStop(1,'#6e9b9f');c.fillStyle=g;c.fillRect(0,0,ww,hh);for(let i=0;i<3;i++){c.fillStyle=['#bfd0c7','#6d9390','#365a66'][i];c.beginPath();c.moveTo(0,hh);for(let x=0;x<=ww;x+=12)c.lineTo(x,hh*(.4+i*.18)+Math.sin(x*.008+i)*hh*.08);c.lineTo(ww,hh);c.fill();}},1024,576);
 room.migrateSavedTransform=(object,transform)=>{
  const id=object.userData.propId,old=id==='armchair-poppi'?[w/2-900,0,front-690]:id==='decor-plant2'?[0,0,front-240]:null;
  if(!old||!transform?.p||!old.every((value,i)=>Math.abs(transform.p[['x','y','z'][i]]-value)<.1))return transform;
  if(!transform.s||!['x','y','z'].every(a=>Math.abs(transform.s[a]-object.scale[a])<.00001))return transform;
  if(!transform.q||Math.abs(object.quaternion.dot(new THREE.Quaternion(transform.q.x,transform.q.y,transform.q.z,transform.q.w)))<.99999)return transform;
  return {...transform,p:{x:object.position.x,y:object.position.y,z:object.position.z}};
 };
 room.decorateProp=(object,placement)=>{
  if(placement.id==='armchair-poppi')object.traverse(o=>{if(!o.isMesh)return;const finish=m=>{if(!m.color||m.metalness>.3||m.roughness<.5||Math.max(m.color.r,m.color.g,m.color.b)<.5)return m;const c=m.clone();c.color.set(p.seat);c.userData.sharedTextures=true;room.ownedMaterials.add(c);return c;};o.material=Array.isArray(o.material)?o.material.map(finish):finish(o.material);});
  if(placement.id==='samsung-neo-tv'){
   if(cinema){
    for(const child of [...object.children])object.remove(child);
    const sw=l.tier===4?2.435:2.17,sh=sw*9/16,cy=.88;
    object.name='Lounge cinema · '+(l.tier===4?'110':'98')+' inch wall display';object.userData.sceneAssetName=object.name;object.userData.cinemaDiagonalInches=l.tier===4?110:98;
    box(object,[sw+.045,sh+.045,.065],[0,cy,0],charcoal,.018);box(object,[.3,.2,.12],[0,cy,-.1],steel,.01);
    const display=mesh(object,new THREE.PlaneGeometry(sw,sh),new THREE.MeshBasicMaterial({map:screenMap,toneMapped:false}),[0,cy,.034]);display.name='Lounge cinema display';display.castShadow=display.receiveShadow=false;
   }else{const display=mesh(object,new THREE.PlaneGeometry(1.094,.615),new THREE.MeshBasicMaterial({map:screenMap,toneMapped:false}),[0,.3521,.0108]);display.name='Lounge cinema display';display.castShadow=display.receiveShadow=false;}
   return;
  }
  if(placement.id!=='coffee-table')return;for(const child of [...object.children])object.remove(child);object.name='Sculpted mineral coffee table';object.userData.loungeTable='contemporary-stone-v2';object.userData.roomSupportHeights=[.3912];box(object,[1.2,.04,.7061],[0,.3712,0],stone,.07);box(object,[.75,.315,.40],[0,.1575,0],charcoal,.055);box(object,[.9,.0362,.48],[0,.3331,0],steel,.025);
 };
 root.userData.dimensionsMm={width:w,depth:d,height};root.userData.loungeDesign={revision:2,style:'contemporary',palette:p.name,desk:{...p.desk},window:{start:a,end,clearance:200},deskFeature:{x:0,z:l.desk[1],width:heroW},barZ:l.tier>=3?l.barZ:null,zones:['centered workspace','media','conversation',...(l.tier>=3?['refreshments']:[])],tableTopMm:391.2};
 let last=null;room.roomAtmosphere=(phase,accent=1)=>{windowVista.setPhase(phase);const mode=modes[phase]||modes.afternoon;if(last!==phase){const c=skyCanvas.getContext('2d'),g=c.createLinearGradient(0,0,0,512);g.addColorStop(0,mode.sky[0]);g.addColorStop(1,mode.sky[1]);c.fillStyle=g;c.fillRect(0,0,512,512);c.fillStyle=phase==='night'?'#1b2d40':'#8baca6';c.beginPath();c.moveTo(0,512);for(let x=0;x<=512;x+=8)c.lineTo(x,380+Math.sin(x*.012)*32);c.lineTo(512,512);c.fill();sky.needsUpdate=true;last=phase;}glow.emissive.set(mode.colors[1]);warm.emissive.set(mode.colors[0]);glow.emissiveIntensity=(phase==='night'?.24:.18+mode.wash*.7)*accent;warm.emissiveIntensity=(.08+mode.practical*.7)*accent;lights.forEach(s=>{s.light.color.set(s.bias?mode.colors[1]:mode.colors[phase==='party'&&s.partyColor?2:0]);s.light.intensity=s.power*(s.bias?mode.wash:mode.practical)*(root.scale.x*1000)**2*accent;});root.userData.atmosphere=phase;root.userData.loungeDesign.phase=phase;dressing.update(phase);};
 interiorCraftFinishes(room,{linen:[cloth],wood:[oak],metal:[steel]});room.roomAtmosphere('afternoon');
}
