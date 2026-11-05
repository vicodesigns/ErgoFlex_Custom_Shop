import * as THREE from 'three';
import {earlyYearsProfile} from './early-years-profiles.mjs';
import {drawEarlyMotif} from './early-years-art.mjs';

// Original wall graphics and supported belongings. The room keeps its authored
// furniture transforms and all additions fit on walls, bedding or the cabinet.
export const CHILD_PERSONALITY_PALETTES={
 early:{wall:'#fff1dc',dado:'#a7c9d4',feature:'#edbd9c',accent:'#d47c5d',second:'#6eaaa5',cloth:'#e8ad89',ink:'#3f6870',curtain:'#e8c9ab',title:'LITTLE WONDERS',sub:'make a little magic',poster:'SUN / SKY / SEA'},
 primary:{wall:'#f3e6c6',dado:'#4e9b9a',feature:'#dfb24f',accent:'#e28d5c',second:'#4a8d9c',cloth:'#e4bd5c',ink:'#245965',curtain:'#b2ceca',title:'CURIOUS ABOUT EVERYTHING',sub:'observe / imagine / make',poster:'SPACE EXPLORER'},
 preteen:{wall:'#ecdbd0',dado:'#738faa',feature:'#c88770',accent:'#c47b62',second:'#466a87',cloth:'#ca947c',ink:'#304c65',curtain:'#a9bdc9',title:'FIND YOUR OWN VIEW',sub:'photo / sketch / discover',poster:'GO SOMEWHERE NEW'},
 teen:{wall:'#d8d7d1',dado:'#384a71',feature:'#c77960',accent:'#da9a68',second:'#7389ac',cloth:'#bd705c',ink:'#293e5b',curtain:'#a4a9b9',title:'SOUND / FORM',sub:'after hours / original sessions',poster:'MAKE SOME NOISE'},
 college:{wall:'#e2d2ba',dado:'#346971',feature:'#b49a79',accent:'#ce9b6a',second:'#688e8f',cloth:'#b49b7c',ink:'#294f56',curtain:'#c9bb9f',title:'LOCAL TO GLOBAL',sub:'field notes / studio studies',poster:'TAKE THE LONG WAY'}
};

export function enhanceChildPersonality({room,root,layout,helpers,materials,groups}){
 const age=CHILD_PERSONALITY_PALETTES[layout.ageStage]?layout.ageStage:'early',early=earlyYearsProfile(layout),p=early?.palette||CHILD_PERSONALITY_PALETTES[age],young=age==='early'||age==='primary';
 const {box,mesh,rod,sphere,material,markSceneAsset}=helpers,{rear,left,right,bed,cubby,nook,rug}=groups;
 const front=layout.back+layout.depth,cache=new Map(),own=t=>{(root.ownedTextures||=[]).push(t);return t;};
 const mat=(color,roughness=.85,extra={})=>{const m=material(color,{roughness,metalness:0,...extra});m.userData.roomFinishLocked=true;return m;};
 const paint=mat(p.feature,.97),accent=mat(p.accent,.72),secondary=mat(p.second,.77),paper=mat('#fff4de',.98),ink=mat(p.ink,.75),timber=materials.oak;
 const cloth=mat(p.cloth,.97),metal=mat('#c8d0d2',.26,{metalness:.93});cloth.userData.roomSurface='fabric';
 materials.plaster.color.set(p.wall);materials.sage.color.set(p.dado);
 if(early){
  materials.coral.color.set(p.accent);materials.blue.color.set(p.second);materials.mustard.color.set(p.feature);
  for(const o of bed.children)if(o.isMesh&&Math.abs(o.position.y-361)<.1){o.replacedMaterials||=[];o.replacedMaterials.push(o.material);o.material=o.material.clone();o.material.color.set(p.second);}
  nook?.traverse(o=>{if(o.isMesh&&(o.material?.userData.roomCraftFinish==='woven linen'||o.material?.userData.roomSurface==='fabric')){o.replacedMaterials||=[];o.replacedMaterials.push(o.material);o.material=o.material.clone();o.material.color.set(p.cloth);}});
 }
 // Curtains have separate clones; tint those deliberately rather than changing
 // the shared bedding linen. Their folded plane geometry is already authored.
 right?.traverse(o=>{if(o.isMesh&&o.geometry?.type==='PlaneGeometry'&&o.geometry.parameters.width===260&&o.material?.userData.roomSurface==='fabric'){o.material.color.set(p.curtain);o.material.roughness=.97;}});
 const fixture=(parent,id,name,at=[0,0,0],turn=0,wall=false)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;g.userData.childPersonality=age;if(wall){g.userData.wallDecoration=true;g.userData.dropSurface=false;}markSceneAsset(g,{key:`childroom:${layout.id}:fixture:${id}`});return g;};
 const texture=(key,draw,w=768,h=1024)=>{if(cache.has(key))return cache.get(key);const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.needsUpdate=true;own(t);cache.set(key,t);return t;};
 const faceMat=map=>mat('#ffffff',.97,{map});
 const art=(kind)=>texture(kind,(c,w,h)=>{
  c.fillStyle=kind==='hero'?p.ink:'#fff2da';c.fillRect(0,0,w,h);
  if(kind==='hero'){
   c.fillStyle=p.feature;c.fillRect(w*.08,h*.08,w*.84,h*.66);
   if(early){
    c.save();c.translate(w*.08,h*.08);drawEarlyMotif(c,w*.84,h*.66,early,{caption:false});c.restore();
   }else if(age==='primary'){
    c.fillStyle='#f7d67b';c.beginPath();c.arc(w*.56,h*.34,w*.18,0,Math.PI*2);c.fill();c.strokeStyle='#fff4df';c.lineWidth=10;for(let i=0;i<3;i++){c.beginPath();c.ellipse(w*.5,h*.38,w*(.25+i*.06),h*(.07+i*.035),-.6,0,Math.PI*2);c.stroke();}
    for(let i=0;i<15;i++){c.fillStyle=i%2?'#fff1cc':p.ink;c.fillRect(w*(.12+(i*.173)% .78),h*(.13+(i*.127)% .46),5+i%3*3,5+i%3*3);}
   }else if(age==='preteen'){
    for(let i=0;i<4;i++){c.fillStyle=['#d7b393','#9eb5ba',p.second,p.ink][i];c.beginPath();c.moveTo(w*.08,h*.73);c.lineTo(w*(.2+i*.08),h*(.35+i*.07));c.lineTo(w*(.53+i*.045),h*(.18+i*.12));c.lineTo(w*.92,h*(.5+i*.06));c.lineTo(w*.92,h*.75);c.fill();}
    c.strokeStyle='#fff3d9';c.lineWidth=4;c.strokeRect(w*.19,h*.18,w*.61,h*.49);
   }else if(age==='teen'){
    c.fillStyle=p.ink;c.beginPath();c.arc(w*.5,h*.39,w*.31,0,Math.PI*2);c.fill();for(let i=0;i<9;i++){c.strokeStyle=i%2?p.second:'#ecb483';c.lineWidth=4;c.beginPath();c.arc(w*.5,h*.39,w*(.08+i*.025),0,Math.PI*2);c.stroke();}c.fillStyle='#ffe6b9';c.beginPath();c.arc(w*.5,h*.39,w*.05,0,Math.PI*2);c.fill();
   }else{
    for(let i=0;i<5;i++){c.strokeStyle=i%2?'#fff0d3':p.ink;c.lineWidth=5;c.beginPath();for(let x=0;x<=w;x+=10){const y=h*(.24+i*.09)+Math.sin(x/w*7+i*.7)*h*.07;if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}c.fillStyle='#f0d1a3';c.beginPath();c.arc(w*.71,h*.2,w*.1,0,Math.PI*2);c.fill();
   }
   if(!early){c.fillStyle='#fff2db';c.textAlign='left';c.font='bold 48px sans-serif';const words=p.title.split(' ');let row='',line=0;for(const word of words){const next=row?row+' '+word:word;if(c.measureText(next).width>w*.84){c.fillText(row,w*.08,h*.83+line*54);line++;row=word;}else row=next;}c.fillText(row,w*.08,h*.83+line*54);c.font='22px sans-serif';c.fillText(p.sub,w*.08,h*.96,w*.84);}
  }else if(kind==='poster'){
   if(early){drawEarlyMotif(c,w,h,early,{variant:1});return;}
   c.fillStyle=p.second;c.fillRect(0,0,w,h*.72);c.fillStyle=p.feature;for(let i=0;i<5;i++){c.beginPath();c.arc(w*(.16+i*.17),h*(.27+(i%2)*.15),w*.13,0,Math.PI*2);c.fill();}
   c.fillStyle=p.ink;c.font='bold 42px sans-serif';c.textAlign='left';const words=p.poster.split(' ');words.forEach((s,i)=>c.fillText(s,w*.09,h*.8+i*48));
  }else{
   if(early){drawEarlyMotif(c,w,h,early,{variant:kind==='photo'?2:1,caption:false});return;}
   c.fillStyle=kind==='photo'?p.second:p.feature;c.fillRect(w*.07,h*.07,w*.86,h*.74);c.fillStyle=kind==='photo'?p.feature:p.second;c.beginPath();c.moveTo(w*.07,h*.81);c.lineTo(w*.39,h*.33);c.lineTo(w*.64,h*.66);c.lineTo(w*.79,h*.4);c.lineTo(w*.93,h*.81);c.fill();c.fillStyle='#ffedc7';c.beginPath();c.arc(w*.7,h*.22,w*.095,0,Math.PI*2);c.fill();c.fillStyle=p.ink;c.font='24px sans-serif';c.fillText(age==='early'?'MY LITTLE WORLD':age==='primary'?'I MADE THIS':kind==='photo'?'a good day, outside':'notes from the week',w*.09,h*.92);
  }
 });
 if(early&&rug){
  rug.traverse(o=>{if(o.name==='Woven story river · flat rug print')o.visible=false;});
  // The motif is dyed into the woven field (child-material-detail paints the
  // rug's border, pile and wear underneath), so it is a translucent layer.
  const map=texture('interest-rug',(c,w,h)=>drawEarlyMotif(c,w,h,early,{caption:false}),768,576);
  const rw=layout.tier?2200:1750,rd=layout.tier?1700:1300,print=mesh(rug,new THREE.PlaneGeometry(rw-560,rd-560),mat('#ffffff',.99,{map,transparent:true,opacity:.3,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),[0,9.15,0]);print.rotation.x=-Math.PI/2;print.name='Woven interest mat · '+early.motif;print.castShadow=false;print.userData.presentationOnly=true;print.userData.dropSurface=false;
  if(root.userData.childInterior)root.userData.childInterior.rug=early.motif+' woven mat';
 }
 const poster=(parent,id,name,at,width,height,kind,rotation=0,frame=false)=>{const g=fixture(parent,id,name,at);g.rotation.z=rotation;
  if(frame)box(g,[width+30,height+30,18],[0,0,0],timber,4);else box(g,[width,height,2],[0,0,0],paper,2);
  const face=mesh(g,new THREE.PlaneGeometry(width,height),faceMat(art(kind)),[0,0,frame?9.3:1.2]);face.castShadow=false;face.userData.presentationOnly=true;
  if(!frame)for(const x of [-width*.29,width*.29]){const tape=box(g,[width*.19,27,1],[x,height/2-3,2],mat('#e6ca9f',.99),1);tape.rotation.z=x<0?-.16:.15;}
  return g;};
 // Paint a tall sleeping-bay panel above the dado. This gives the large room
 // an age-specific architectural colour even in a distant camera view.
 const colour=fixture(rear,'personality-bed-paint','Sleeping bay · '+p.feature,[layout.bed[0],0,layout.back+8],0,true),panelH=layout.height-1050;
 box(colour,[1300,panelH,2],[0,1010+panelH/2,0],paint,18);
 const heroY=Math.min(2040,layout.height-500);
 const hero=fixture(rear,'personality-rear-gallery','Personal poster wall · '+age,[layout.bed[0],heroY,layout.back+24],0,true);
 poster(hero,'personality-hero',early?'A familiar bedtime picture':'Original '+p.title+' poster',[0,0,0],early?400:660,early?500:820,early?'photo':'hero',-.018,early||age==='college');
 // Right-wall composition stays beyond the complete window/glazing opening.
 if(!early){const rightZ=Math.max(layout.back+2920,front-1500),rightGallery=fixture(right,'personality-right-gallery','Posters, postcards & personal photographs',[layout.width/2-16,1900,rightZ],-Math.PI/2,true);
 poster(rightGallery,'personality-interest-poster','Original interests poster',[-190,0,0],390,610,'poster',.025);
 poster(rightGallery,'personality-photo-one','A remembered day out',[210,170,1],210,260,'photo',-.07);
 poster(rightGallery,'personality-photo-two','Pinned personal postcard',[200,-170,1],235,250,'note',.055);}
 // The young mirror is a stylised metallic reflective face, not a realtime
 // renderer. It faces +X into the room and leaves the nearby board its bay.
 const mirror=fixture(left,'personality-mirror',young?'Little explorer · rounded wall mirror':'Personal wall mirror',[-layout.width/2+16,young?1060:1610,young?1300:front-440],Math.PI/2,true);
 const rim=mesh(mirror,new THREE.TorusGeometry(young?220:180,young?18:13,10,48),young?secondary:timber,[0,0,4]);
 const reflective=mesh(mirror,new THREE.CircleGeometry(young?204:167,48),mat('#c4d5db',.16,{metalness:.86}),[0,0,4.4]);reflective.name='Stylised reflective face · no realtime reflection';reflective.castShadow=false;
 const glint=mesh(mirror,new THREE.PlaneGeometry(young?110:100,young?240:210),mat('#edf4ee',.4,{transparent:true,opacity:.14,depthWrite:false}),[-55,20,5.4]);glint.rotation.z=-.3;glint.castShadow=false;
 // Everyday clothing is wall-supported, rather than scattered in travel paths.
 const hookY=young?1000:1370,hooks=fixture(right,'personality-hooks','Bag and clothes hooks',[layout.width/2-18,hookY,front-1100],-Math.PI/2,true);
 const hook=(x)=>{box(hooks,[72,95,14],[x,0,0],timber,8);rod(hooks,[x,-8,8],[x,-8,68],9,metal);sphere(hooks,[13,13,13],[x,-8,70],metal);};
 hook(0);const bag=fixture(hooks,'personality-bag',young?'Small canvas day bag':'Everyday study backpack',[0,-180,93]);
 box(bag,[young?210:260,young?270:340,100],[0,-35,0],secondary,28);box(bag,[young?160:200,110,16],[0,-95,58],accent,18);rod(bag,[-56,98,-5],[-56,137,-5],9,cloth);rod(bag,[-56,137,-5],[56,137,-5],9,cloth);rod(bag,[56,137,-5],[56,98,-5],9,cloth);box(bag,[100,5,3],[0,-66,67],metal,2);
 if(!young){hook(-400);const jumper=fixture(hooks,'personality-jumper','Jumper returned to its wall hook',[-400,-185,75]);box(jumper,[245,270,48],[0,-70,0],cloth,19);for(const side of [-1,1]){const sleeve=box(jumper,[84,220,42],[side*140,-35,0],cloth,18);sleeve.rotation.z=side*.24;}box(jumper,[86,25,52],[0,61,0],paper,10);}
 // An unfussy throw follows the existing quilt crown, and an extra cushion
 // rests on that quilt. Neither changes the bed's floor footprint.
 const bedding=fixture(bed,'personality-bedding','Personal throw and extra cushion');
 const quiltY=(x,z)=>377+4*Math.sin(x*.009)*Math.sin((z+230)*.009)-5*Math.pow(Math.abs(x)/555,10)-3*Math.pow(Math.abs(z-300)/660,10);
 const throwGeo=new THREE.PlaneGeometry(1000,450,28,16),positions=throwGeo.attributes.position;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=650-positions.getY(i);positions.setXYZ(i,x,quiltY(x,z)+2.3+1.8*Math.sin(x*.016),z);}throwGeo.computeVertexNormals();cloth.side=THREE.DoubleSide;const throwMesh=mesh(bedding,throwGeo,cloth);throwMesh.name='Woven throw following quilt crown';throwMesh.receiveShadow=true;
 const stitch=mat('#efe0bd',.98);for(const z of [445,855]){const points=[];for(let i=0;i<=32;i++){const x=-485+i*970/32;points.push(new THREE.Vector3(x,quiltY(x,z)+3.2+1.8*Math.sin(x*.016),z));}mesh(bedding,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),50,.9,4,false),stitch);}
 const pillow=box(bedding,[280,88,245],[285,423,-70],cloth,35);pillow.rotation.y=.15;
 // The cabinet centre is deliberately free between the old left book stack
 // and right hobby/plant. All bottoms contact the 616 mm top surface.
 const personal=fixture(cubby,'personality-cabinet','Supported everyday belongings');
 let lampLight=null,lampGlow=null;
 if(young){
  box(personal,[230,18,180],[0,625,0],timber,6);for(const x of [-106,0,106])box(personal,[12,105,170],[x,677.5,0],secondary,4);box(personal,[220,105,10],[0,677.5,-80],secondary,4);
  for(let i=0;i<4;i++){const pencil=mesh(personal,new THREE.CylinderGeometry(4,4,125+i%2*20,8),[accent,secondary,ink,paper][i],[35+i*15,696+i%2*10,-15]);pencil.rotation.z=.06*(i-1);}
  box(personal,[75,105,12],[-53,686,12],paper,3);box(personal,[65,70,1],[-53,693,18.5],accent,2);
 }else{
  const base=mesh(personal,new THREE.CylinderGeometry(65,70,14,28),metal,[0,623,0]);rod(personal,[0,630,0],[0,780,0],8,metal);
  const shade=mesh(personal,new THREE.CylinderGeometry(82,110,140,32,1,true),cloth,[0,837,0]);shade.material.side=THREE.DoubleSide;
  lampGlow=mat('#ffe1aa',.8,{emissive:'#ffd19a',emissiveIntensity:0});mesh(personal,new THREE.SphereGeometry(22,16,12),lampGlow,[0,792,0]);
  lampLight=new THREE.PointLight('#ffd6a4',0,2000*root.scale.x,2);lampLight.name='Child room · personal cabinet lamp';lampLight.position.set(0,785,30);personal.add(lampLight);
 }
 root.userData.childPersonality={age,...(early?{profile:early.id,interest:early.interest}:{}),palette:{wall:p.wall,dado:p.dado,feature:p.feature},posters:early?1:5,mirror:true,bag:true,cloth:true};
 return {update(phase){const on=phase==='evening'?1:phase==='night'?.05:phase==='party'?.35:0;if(lampLight){lampLight.intensity=18*on;lampGlow.emissiveIntensity=.75*on;}root.userData.childPersonality.phase=phase;}};
}
