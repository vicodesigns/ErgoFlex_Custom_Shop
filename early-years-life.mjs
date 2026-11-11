import * as THREE from 'three';
import {earlyYearsProfile} from './early-years-profiles.mjs';

// Early-years bedrooms gain more complete play zones as their floor area
// grows. Belongings live on their furniture; the evening route stays clear.
export function buildEarlyYearsLife({root,layout:l,helpers:h,materials:m,groups,footprint}){
 if(l.ageStage!=='early')return {update(){}};
 const {box,mesh,rod,sphere,material,markSceneAsset}=h,{bed,cubby,market,right,craft}=groups;
 const profile=earlyYearsProfile(l),p=profile.palette,front=l.back+l.depth,variants=[],zones=['sleep','reading','building','drawing'],floorIds=[];
 const finish=(color,roughness=.85,extra={})=>{const mat=material(color,{roughness,metalness:0,...extra});mat.userData.roomFinishLocked=true;return mat;};
 const clay=finish(p.accent),teal=finish(p.second),ochre=finish(p.feature),cream=finish('#f1e5ce'),charcoal=finish(p.ink),steel=finish('#b9c6c6',.34,{metalness:.8});
 const cloth=finish(p.cloth,.98,{map:m.linen.map});cloth.userData.roomSurface='fabric';
 const maps=new Map(),texture=(key,draw,w=512,hh=512)=>{if(maps.has(key))return maps.get(key);const c=document.createElement('canvas');c.width=w;c.height=hh;draw(c.getContext('2d'),w,hh);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;(root.ownedTextures||=[]).push(t);maps.set(key,t);return t;};
 const art=kind=>texture(kind,(c,w,hh)=>{
  c.fillStyle='#f4e7cc';c.fillRect(0,0,w,hh);c.fillStyle='#416b6d';c.textAlign='center';c.font='bold 34px sans-serif';c.fillText({market:'OUR LITTLE MARKET',kitchen:'TODAY WE ARE COOKS',music:'LISTEN / TRY / PLAY',gallery:'LOOK WHAT I MADE',blocks:'BLOCKS',friends:'SOFT FRIENDS'}[kind]||'LITTLE WORLDS',w/2,hh*(['friends','blocks'].includes(kind)?.65:.15),w*.9);
  if(['friends','blocks'].includes(kind))return;
  for(let i=0;i<3;i++){
   const x=w*(.2+i*.3),y=hh*.53;c.fillStyle=['#ce886a','#76aaa6','#d8b45e'][i];
   if(kind==='kitchen'||kind==='market'){c.beginPath();c.ellipse(x,y,w*.09,hh*.16,i%2?.2:-.2,0,Math.PI*2);c.fill();c.strokeStyle='#668d71';c.lineWidth=8;c.beginPath();c.moveTo(x,y-hh*.12);c.lineTo(x+w*.03,y-hh*.23);c.stroke();}
   else{c.lineWidth=9;c.strokeStyle=c.fillStyle;c.beginPath();c.arc(x,y,w*.065,0,Math.PI*2);c.moveTo(x,y+hh*.04);c.lineTo(x,y+hh*.22);c.moveTo(x-w*.07,y+hh*.1);c.lineTo(x+w*.07,y+hh*.1);c.stroke();}
  }
  c.font='25px sans-serif';c.fillStyle='#577474';c.fillText(kind==='gallery'?'a new story, every day':'choose / make / share',w/2,hh*.92,w*.9);
 },512,['friends','blocks'].includes(kind)?128:512);
 const fixture=(parent,id,name,at=[0,0,0],turn=0)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;g.userData.earlyYears=true;markSceneAsset(g,{key:`childroom:${l.id}:fixture:${id}`});return g;};
 const floor=(id,name,at,hw,hd,turn=0)=>{const g=fixture(root,id,name,at,turn);footprint(g,hw,hd);floorIds.push(id);return g;};
 const phase=(parent,id,name,phases)=>{const g=new THREE.Group();g.name=name;g.userData.earlyPhase=id;parent.add(g);variants.push({g,phases});return g;};
 const print=(parent,kind,width,height,at,turn=0)=>{const p=mesh(parent,new THREE.PlaneGeometry(width,height),finish('#ffffff',.97,{map:art(kind)}),at);p.rotation.y=turn;p.castShadow=false;p.userData.presentationOnly=true;return p;};
 const closedBook=(p,x,base,z,width=170,depth=135)=>{box(p,[width,3,depth],[x,base+1.5,z],teal,2);box(p,[width-5,12,depth-5],[x,base+9,z],cream,2);box(p,[width,3,depth],[x,base+16.5,z],teal,2);};
 const bowl=(p,x,base,z,r=45)=>mesh(p,new THREE.LatheGeometry([[0,0],[r*.6,0],[r,34],[r*.86,34],[r*.48,8],[0,8]].map(([a,b])=>new THREE.Vector2(a,b)),24),teal,[x,base,z]);

 // Small everyday care details stay beside the bed, not in the play route.
 const bedside=floor('early-bedside','Bedside book & water cabinet',[l.bed[0]+800,0,l.back+300],135,170);
 box(bedside,[260,25,280],[0,12.5,0],m.oak,7);box(bedside,[260,340,280],[0,195,0],cream,10);box(bedside,[270,24,290],[0,377,0],m.oak,7);
 box(bedside,[220,220,18],[0,201,146],teal,6);box(bedside,[28,28,14],[0,250,162],m.oak,9);closedBook(bedside,-25,389,-10,150,125);
 const cup=mesh(bedside,new THREE.CylinderGeometry(24,21,85,20),clay,[80,431.5,45]);mesh(bedside,new THREE.CylinderGeometry(25,25,9,20),cream,[80,478.5,45]);
 // A short fabric canopy covers the pillow end while keeping the bed visible.
 const canopy=fixture(bed,'early-bed-canopy','Striped linen over the sleeping corner');
 const geo=new THREE.PlaneGeometry(1080,490,24,12),pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=-745-pos.getY(i);pos.setXYZ(i,x,1390+(z+1000)*.41-13*Math.sin((x+540)/1080*Math.PI),z);}geo.computeVertexNormals();
 const canopyMat=cloth.clone();canopyMat.side=THREE.DoubleSide;const canvas=mesh(canopy,geo,canopyMat);canvas.receiveShadow=true;
 // Fill the existing baskets rather than sprinkling toys over circulation.
 const belongings=fixture(cubby,'early-basket-contents','Labelled baskets of blocks and soft friends');
 for(let i=0;i<4;i++)box(belongings,[90,60,90],[270+(i%2)*120,70+Math.floor(i/2)*60,-25],[clay,teal,ochre,m.oak][i],8);
 sphere(belongings,[65,75,48],[-344,115,5],cloth);sphere(belongings,[48,44,39],[-344,206,10],cloth);for(const x of [-379,-309])sphere(belongings,[20,22,14],[x,238,10],cloth);for(const x of [-360,-328])sphere(belongings,[3,3,3],[x,213,47],charcoal);
 print(belongings,'friends',180,45,[-344,154,250]);print(belongings,'blocks',180,45,[344,154,250]);
 // One curated interest shelf replaces the identical coloured cubes. Every
 // set has the same measured tray, so a new identity keeps its storage fit.
 const interest=fixture(cubby,'early-interest-shelf',profile.title+' · favourite things');
 box(interest,[520,12,260],[-350,328,0],m.oak,6);
 if(profile.motif==='nature'){
  for(const [i,x] of [-500,-350,-200].entries()){const leaf=sphere(interest,[48,10,32],[x,344,0],[teal,ochre,clay][i]);leaf.rotation.y=(i-1)*.3;}
 }else if(profile.motif==='pretend'){
  for(const x of [-490,-210])mesh(interest,new THREE.CylinderGeometry(32,29,60,24),teal,[x,364,0]);
  mesh(interest,new THREE.CylinderGeometry(70,70,7,24),clay,[-350,337.5,0]);
 }else if(profile.motif==='building'){
  for(const x of [-490,-230])box(interest,[70,75,100],[x,371.5,0],teal,5);
  box(interest,[330,22,110],[-360,420,0],ochre,5);box(interest,[60,50,70],[-350,456,0],clay,4);
 }else if(profile.motif==='stories'){
  for(let i=0;i<3;i++){const x=-490+i*140;mesh(interest,new THREE.CylinderGeometry(22,32,95,20),[clay,teal,ochre][i],[x,381.5,0]);sphere(interest,[28,28,28],[x,457,0],m.oak);}
 }else{
  for(const x of [-490,-220]){mesh(interest,new THREE.CylinderGeometry(14,14,95,20),m.oak,[x,381.5,0]);sphere(interest,[35,35,35],[x,464,0],teal);}
  sphere(interest,[50,10,30],[-350,344,0],ochre);
 }
 if(l.tier>=1){
  const shared=floor('early-story-pouf','An extra seat for a shared bedtime story',[l.reading[0]+930,0,front-370],270,260);
  box(shared,[520,260,480],[0,130,0],cloth,45);box(shared,[520,50,480],[0,285,0],teal,22);box(shared,[470,3,5],[0,311,0],cream,1);
 }
 if(market){
  zones.push('pretend market');const awning=fixture(market,'early-market-awning','Striped market canopy & picture menu');
  for(const x of [-380,380])rod(awning,[x,560,-210],[x,1120,-210],14,m.oak);
  box(awning,[840,25,440],[0,1110,0],m.oak,6);
  for(let i=0;i<7;i++)box(awning,[118,9,440],[-354+i*118,1127,0],i%2?cream:clay,2);
  box(awning,[840,95,12],[0,1075,226],cream,4);print(awning,'market',620,80,[0,1080,233]);
  if(profile.motif==='pretend'){
   for(const id of ['morning','afternoon','party']){const set=phase(market,id,'Places for the shopper and helper',[id]);const count=id==='party'?profile.partyParticipants:1;for(let i=0;i<count;i++)mesh(set,new THREE.CylinderGeometry(28,25,55,20),i%2?clay:teal,[-110+i*220,587.5,185]);}
  }
 }
 if(craft&&profile.partyParticipants>=3){
  for(let i=0;i<profile.partyParticipants-2;i++){
   const x=craft.position.x+(i===0?-770:770),seat=floor('early-guest-stool-'+i,'A visiting friend’s making stool',[x,0,craft.position.z],190,190);
   for(const dx of [-140,140])for(const dz of [-130,130])box(seat,[32,260,32],[dx,130,dz],m.oak,5);
   box(seat,[360,40,350],[0,280,0],i%2?clay:teal,12);
  }
 }

 let kitchen=null,dolls=null,music=null,pendant=null,diffuser=null;
 if(l.tier>=2){
  zones.push('pretend kitchen');kitchen=floor('early-play-kitchen','Pretend kitchen · wash, cook & share',[l.width/2-330,0,l.back+3500],330,660,-Math.PI/2);
  box(kitchen,[1240,30,500],[0,15,0],m.oak,7);
  box(kitchen,[800,480,500],[220,270,0],cream,12);box(kitchen,[820,30,520],[210,525,0],m.oak,6);
  box(kitchen,[400,1020,500],[-420,540,0],teal,14);box(kitchen,[355,920,20],[-420,545,261],cream,9);box(kitchen,[22,170,25],[-290,615,280],m.oak,6);
  box(kitchen,[310,360,22],[360,275,262],clay,8);box(kitchen,[235,205,5],[360,265,276],charcoal,7);box(kitchen,[240,16,22],[360,438,280],steel,4);
  box(kitchen,[385,350,22],[-10,270,262],teal,9);box(kitchen,[120,16,22],[-10,415,282],m.oak,4);
  for(const x of [280,440])mesh(kitchen,new THREE.CylinderGeometry(55,55,5,28),charcoal,[x,542.5,30]);
  mesh(kitchen,new THREE.CylinderGeometry(66,66,3,28),steel,[-20,541.5,0]);const tap=mesh(kitchen,new THREE.TorusGeometry(60,9,8,24,Math.PI),steel,[-20,589,-83]);tap.rotation.y=Math.PI/2;
  rod(kitchen,[-20,540,-143],[-20,589,-143],9,steel);rod(kitchen,[-20,565,-23],[-20,589,-23],9,steel);
  const menu=fixture(right,'early-kitchen-menu','Picture recipe above the pretend kitchen',[l.width/2-15,1580,l.back+3500],-Math.PI/2);menu.userData.wallDecoration=true;box(menu,[620,410,18],[0,0,0],m.oak,5);print(menu,'kitchen',590,380,[0,0,9.2]);
  const cookingPhases=profile.motif==='pretend'?['morning','afternoon','party']:['party'];
  for(const id of cookingPhases){
   const g=phase(kitchen,id,'Pretend cooking · '+id,[id]);
   if(id==='morning'){bowl(g,100,540,110);for(let i=0;i<3;i++)sphere(g,[17,15,17],[80+i*19,559,105],ochre);}
   else{mesh(g,new THREE.CylinderGeometry(53,48,60,24),clay,[280,575,30]);box(g,[28,10,26],[280,611,30],m.oak,4);bowl(g,100,540,110);for(let i=0;i<3;i++)sphere(g,[14,11,14],[80+i*20,558,110],[teal,clay,ochre][i]);}
  }
  const tidy=phase(kitchen,'put-away','Kitchen wiped and ready for tomorrow',['morning','afternoon','evening','night','party'].filter(id=>!cookingPhases.includes(id)));bowl(tidy,100,540,110);box(tidy,[180,12,160],[-55,546,65],cloth,5);
  // Warm, shaded light anchors the making zone in the larger floor plans.
  const shade=fixture(root,'early-making-pendant','Linen shade above the making table',[0,l.height-250,l.back+3000]);shade.userData.presentationOnly=true;
  rod(shade,[0,80,0],[0,250,0],4,m.oak);mesh(shade,new THREE.CylinderGeometry(160,220,150,32,1,true),cloth,[0,0,0]);
  diffuser=finish('#ffe9bd',.9,{emissive:'#ffd7a0',emissiveIntensity:0});const face=mesh(shade,new THREE.CircleGeometry(215,32),diffuser,[0,-70,0]);face.rotation.x=-Math.PI/2;
  pendant=new THREE.PointLight('#ffe1b3',0,4300*root.scale.x,2);pendant.name='Early years · making pendant';pendant.position.set(0,-95,0);shade.add(pendant);
 }
 if(l.tier>=3){
  zones.push('small world');dolls=floor('early-small-world','Small-world house & wooden family',[-l.width*.25,0,front-3000],570,340);
  box(dolls,[1120,80,640],[0,40,0],m.oak,12);
  for(const x of [-530,530])box(dolls,[35,840,580],[x,500,0],cream,7);box(dolls,[1080,820,20],[0,490,-280],teal,5);
  box(dolls,[1090,28,580],[0,480,0],m.oak,5);box(dolls,[1090,28,580],[0,905,0],m.oak,5);
  for(const x of [-265,265]){box(dolls,[25,390,560],[x,278,0],cream,4);}
  for(const x of [-265,265]){box(dolls,[160,200,6],[x,690,-264],ochre,3);box(dolls,[10,200,8],[x,690,-259],cream,2);box(dolls,[160,10,8],[x,690,-259],cream,2);}
  const roof=new THREE.Shape();roof.moveTo(-560,920);roof.lineTo(0,1230);roof.lineTo(560,920);roof.closePath();const roofFace=mesh(dolls,new THREE.ShapeGeometry(roof),clay,[0,0,-270]);roofFace.material.side=THREE.DoubleSide;
  for(const x of [-540,540])rod(dolls,[x,920,-270],[0,1230,-270],16,m.oak);
  const storyPhases=profile.motif==='stories'?['morning','afternoon','party']:['party'];
  const stored=phase(dolls,'resting','Wooden family put to bed',['morning','afternoon','evening','night','party'].filter(id=>!storyPhases.includes(id)));box(stored,[230,50,170],[-120,105,-25],cloth,10);
  for(const id of storyPhases){const g=phase(dolls,id,'Wooden family story · '+id,[id]);for(let i=0;i<(id==='party'?profile.partyParticipants:2);i++){const x=-380+i*230;mesh(g,new THREE.CylinderGeometry(22,32,80,16),[clay,teal,ochre,cream][i],[x,120,45]);sphere(g,[25,25,25],[x,185,45],m.oak);}box(g,[160,65,110],[260,112.5,-130],teal,8);}
  const mat=fixture(root,'early-small-world-mat','Kneeling mat at the little house',[-l.width*.25-60,0,front-2330]);mat.userData.presentationOnly=true;box(mat,[1120,8,560],[0,4,0],cloth,14);
 }
 if(l.tier>=4){
  zones.push('music & nature');music=floor('early-music-nature','Listening & nature discovery bench',[l.width*.17,0,front-3450],600,400);
  box(music,[1160,30,760],[0,15,0],m.oak,8);for(const x of [-530,530])box(music,[35,350,700],[x,205,0],cream,6);box(music,[1160,30,760],[0,395,0],m.oak,8);
  const sign=fixture(music,'early-music-sign','Sound and nature picture card',[0,870,-330]);box(sign,[700,360,18],[0,0,0],cream,6);print(sign,'music',675,335,[0,0,9.2]);for(const x of [-320,320])rod(music,[x,410,-330],[x,1050,-330],10,m.oak);
  const percussion=phase(music,'play','Wooden sounds & specimen tray',['morning','afternoon','party']);
  box(percussion,[410,24,250],[-270,422,0],cream,6);for(let i=0;i<7;i++)box(percussion,[37,20,200-i*14],[-410+i*47,444,0],[clay,ochre,teal][i%3],5);
  mesh(music,new THREE.CylinderGeometry(95,85,170,32),teal,[300,495,0]);mesh(music,new THREE.CylinderGeometry(96,96,8,32),cloth,[300,584,0]);
  box(percussion,[680,12,150],[0,416,-230],m.oak,5);for(const x of [-200,0,200]){const leaf=sphere(percussion,[55,8,30],[x,430,-230],x===0?ochre:teal);leaf.rotation.y=x*.001;rod(percussion,[x-38,438,-230],[x+38,438,-230],1.5,cream);}
  const tidy=phase(music,'quiet','Wooden sounds packed; drum ready for tomorrow',['evening','night']);box(tidy,[440,100,270],[-270,80,0],cloth,12);box(tidy,[680,30,150],[0,425,-230],cloth,7);
 }
 // Personal drawings live in the single wall-life collection. Avoid adding
 // another gallery above it just because a floor plan is larger.
 root.userData.earlyYearsLife={zones,floorIds,profile:profile.id,interest:profile.interest,participation:profile.participation,partyParticipants:profile.partyParticipants,residentChildren:1,phase:'morning',tidy:false};
 return {update(id){for(const v of variants)v.g.visible=v.phases.includes(id);const power=({morning:0,afternoon:3,evening:8,night:0,party:12})[id]||0;if(pendant){pendant.intensity=power;diffuser.emissiveIntensity=power/20;}root.userData.earlyYearsLife.phase=id;root.userData.earlyYearsLife.activeChildren=id==='party'?profile.partyParticipants:1;root.userData.earlyYearsLife.tidy=['evening','night'].includes(id);}};
}
