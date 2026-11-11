import * as THREE from 'three';
import {earlyYearsProfile} from './early-years-profiles.mjs';
const phases=['morning','afternoon','evening','night','party'];

// Daily materials stay inside their own furniture group. Repositioning a nook
// or table in the editor therefore carries its active story with it.
export function buildChildActivities({root,layout:l,helpers:h,materials:m,groups,art}){
 if(l.ageStage&&l.ageStage!=='early')return buildGrowingActivities({root,layout:l,helpers:h,materials:m,groups,art});
 const profile=earlyYearsProfile(l),{box,mesh,sphere,markSceneAsset}=h,{oak,coral,blue,mustard,green,ink,paper}=m,variants=[],crayonMats=[profile.palette.accent,profile.palette.feature,profile.palette.second,profile.palette.dado].map(color=>h.material(color,{roughness:.88,metalness:0}));
 const variant=(parent,phase,name,at=[0,0,0])=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.userData.childActivity=phase;parent.add(g);variants.push({g,phase});return g;};
 const surface=(parent,size,at,kind)=>{const page=mesh(parent,new THREE.PlaneGeometry(...size),h.material('#ffffff',{map:art(kind),roughness:.97}),at);page.rotation.x=-Math.PI/2;page.castShadow=false;return page;};
 const crayons=(g,x,y,z)=>{for(let i=0;i<4;i++){const o=mesh(g,new THREE.CylinderGeometry(7,7,95,10),crayonMats[i],[x+i*24,y+7,z]);o.rotation.x=Math.PI/2;}};
 const openBook=(g,at,kind='forest')=>{const b=new THREE.Group();b.position.set(...at);g.add(b);box(b,[280,4,210],[0,2,0],blue,2);for(const x of [-68,68]){box(b,[132,10,200],[x,9,0],paper,2);surface(b,[128,196],[x,14.1,0],x<0?kind:'animal');}box(b,[4,10,202],[0,9,0],oak,1);return b;};
 const blocks=(g,points)=>points.forEach(([x,z,n=1],i)=>{for(let y=0;y<n;y++)box(g,[80,80,80],[x,40+y*80,z],[oak,coral,blue,mustard][i%4],5);if(i%3===0){const roof=mesh(g,new THREE.CylinderGeometry(0,60,70,4),coral,[x,80*n+35,z]);roof.rotation.y=Math.PI/4;}});
 const floor=[];
 for(const [i,phase] of phases.entries()){
  const g=variant(root,phase,['A little block invitation','Low drawing station','Room ready for a story','Toys tucked away','Railway & block village'][i],[l.play[0],9,l.play[1]]);g.userData.propId='play-'+i;markSceneAsset(g,{key:`childroom:${l.id}:fixture:play-${i}`});floor.push(g);
  if(phase==='morning'){
   if(profile.motif==='pretend'){
    box(g,[380,18,280],[0,9,0],oak,5);for(const x of [-180,180])box(g,[20,110,280],[x,73,0],oak,4);for(const z of [-130,130])box(g,[360,110,20],[0,73,z],oak,4);
    for(const [i,x] of [-100,0,100].entries())sphere(g,[35,40,35],[x,58,0],[coral,mustard,green][i]);
   }else if(profile.motif==='stories'){
    box(g,[580,16,240],[0,8,-70],oak,6);for(let i=0;i<3;i++){const x=-180+i*180;mesh(g,new THREE.CylinderGeometry(22,32,80,16),[coral,blue,mustard][i],[x,56,-70]);sphere(g,[25,25,25],[x,121,-70],oak);}
   }else if(profile.motif==='nature'||profile.motif==='music'){
    box(g,[550,16,250],[-80,8,-130],oak,6);for(let i=0;i<3;i++)sphere(g,[55,12,35],[-250+i*170,28,-130],[green,mustard,coral][i]);
   }else blocks(g,[[-310,-190,1],[-150,-180,2],[20,-155,1],[210,-160,1],[-240,80,1]]);
  }
  if(phase==='afternoon'&&!groups.craft){
   // Small rooms get a floor-height tray rather than another full table.
   const tray=variant(g,phase,'Portable floor drawing tray');box(tray,[620,16,440],[0,152,0],oak,9);for(const x of [-260,260])for(const z of [-170,170])box(tray,[30,144,30],[x,72,z],oak,4);
   box(tray,[360,2,280],[-55,161,0],paper,1);surface(tray,[354,274],[-55,162.1,0],'drawing');crayons(tray,170,160,-30);
  }
  if(phase==='afternoon'&&groups.craft&&profile.motif==='building'){
   // The drawing table is active, while a bridge still in progress tells the
   // story of floor play earlier in the day. All pieces remain on the mat.
   for(const x of [-420,-200])for(let row=0;row<2;row++)box(g,[80,80,80],[x,40+row*80,-130],oak,5);
   blocks(g,[[35,-100,1],[-310,130,1]]);
   box(g,[300,30,100],[-310,175,-130],oak,4);
   const truck=new THREE.Group();truck.name='Wooden delivery truck beside the build';truck.position.set(340,0,120);g.add(truck);
   box(truck,[160,28,90],[0,46,0],blue,8);box(truck,[90,50,80],[-25,85,0],oak,6);box(truck,[50,70,80],[55,95,0],mustard,7);
   for(const x of [-48,48])for(const z of [-48,48]){const wheel=mesh(truck,new THREE.CylinderGeometry(16,16,10,16),ink,[x,16,z]);wheel.rotation.x=Math.PI/2;}
  }
  if(phase==='party'){
   // A complete oval railway: straight sections carry all wheel contacts.
   for(const z of [-260,440])box(g,[660,12,130],[0,6,z],oak,3);
   for(const [x,start] of [[330,-Math.PI/2],[-330,Math.PI/2]]){const curve=mesh(g,new THREE.RingGeometry(285,415,40,1,start,Math.PI),oak,[x,12,90]);curve.rotation.x=-Math.PI/2;curve.castShadow=false;}
   for(const z of [-260,440])for(let i=0;i<12;i++)box(g,[9,1,122],[-302+i*55,12.5,z],ink,1);
   blocks(g,[[-150,-80,1],[15,-60,2],[175,100,1],[-130,180,1]]);
   for(let i=0;i<3;i++){
    box(g,[150,70,90],[-260+i*185,66,440],[blue,coral,mustard][i],6);
    if(i===0){box(g,[65,55,80],[-285,128.5,440],blue,4);mesh(g,new THREE.CylinderGeometry(15,15,32,12),mustard,[-220,117,440]);}
    for(const x of [-45,45])for(const z of [-52,52]){const wheel=mesh(g,new THREE.CylinderGeometry(24,24,12,16),ink,[-260+i*185+x,36,440+z]);wheel.rotation.x=Math.PI/2;}
   }
   for(const z of [310,570])box(g,[60,150,40],[240,75,z],blue,4);box(g,[70,40,300],[240,170,440],mustard,4);
  }
 }
 for(const phase of ['evening','party']){
  const story=variant(groups.nook,phase,'An open picture book for shared reading');openBook(story,[-185,150,30],phase==='evening'?'moon':'boat');
 }
 if(groups.craft){
  for(const phase of ['morning','afternoon','party']){
   const g=variant(groups.craft,phase,'Little maker materials · '+phase);
   if(phase==='morning'){box(g,[235,18,190],[-170,459,0],coral,3);box(g,[225,2,180],[-170,469,0],paper,1);}
   else if(phase==='party'){
    const places=profile.partyParticipants===4?[[-240,-165],[240,-165],[-240,165],[240,165]]:profile.partyParticipants===3?[[-260,-150],[260,-150],[0,175]]:[[-230,0],[230,0]];
    for(const [i,[x,z]] of places.entries()){
     box(g,[220,3,200],[x,451.5,z],paper,2);surface(g,[214,194],[x,453.1,z],'drawing');
     const col=[coral,blue,mustard,green][i];mesh(g,new THREE.CylinderGeometry(12,12,8,16),col,[x-83,457.2,z-72]);
     if(profile.motif==='building'){
      for(const dx of [-35,35])box(g,[30,40,45],[x+dx,473,z],col,4);box(g,[100,18,48],[x,502,z],oak,4);
     }else if(profile.motif==='stories'){
      mesh(g,new THREE.CylinderGeometry(16,23,55,16),col,[x,480.5,z]);sphere(g,[16,16,16],[x,524,z],oak);
     }else if(i%2===0)sphere(g,[50,8,28],[x,461,z],col);
     else{mesh(g,new THREE.CylinderGeometry(12,12,70,16),oak,[x,488,z]);sphere(g,[25,25,25],[x,548,z],col);}
    }
    g.userData.sharedPlaces=profile.partyParticipants;
   }
   else{box(g,[300,3,250],[-200,451.5,0],paper,2);surface(g,[294,244],[-200,453.1,0],'drawing');crayons(g,150,450,-30);
    // A second child's drawing and a shallow colour-sorting tray make this
    // a shared making spot. Every piece rests within the 1000 × 700 top.
    box(g,[175,10,95],[245,455,-185],oak,4);for(let n=0;n<3;n++)box(g,[35,12,52],[190+n*53,466,-185],[coral,blue,mustard][n],3);
   }
  }
 }
 return {floor,update(phase){for(const {g,phase:p} of variants)g.visible=p===phase;groups.marketGoods?.forEach(o=>o.visible=(profile.motif==='pretend'?['morning','afternoon','party']:['party']).includes(phase));root.userData.childActivity={phase,profile:profile.id,participants:phase==='party'?profile.partyParticipants:1,lowDrawingSurface:phase==='afternoon'||phase==='party',readingBook:phase==='evening'||phase==='party',playMatClear:phase==='night'||phase==='evening',focus:profile.design.focus};}};
}

function buildGrowingActivities({root,layout:l,helpers:h,materials:m,groups,art}){
 const {box,mesh,rod,material,markSceneAsset}=h,{oak,paper,ink,blue,coral,mustard}=m,variants=[],floor=[],age=l.ageStage,y=age==='primary'?450:720;
 const finish=(color,extra={})=>{const mat=material(color,{roughness:.82,metalness:0,...extra});mat.userData.roomFinishLocked=true;return mat;};
 const graphite=finish('#344047',{roughness:.55}),felt=finish('#637e85',{roughness:.97}),white=finish('#eee9dc',{roughness:.93}),glass=finish('#294956',{roughness:.18}),metal=finish('#a8b0b1',{roughness:.3,metalness:.85});
 const variant=(parent,phase,name,at=[0,0,0])=>{const g=new THREE.Group();g.position.set(...at);g.name=name;g.userData.childActivity=phase;parent.add(g);variants.push({g,phase});return g;};
 const pageMaps=new Map();
 const projectMap=kind=>{
  if(pageMaps.has(kind))return pageMaps.get(kind);
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const c=canvas.getContext('2d');
  c.fillStyle='#f0eadb';c.fillRect(0,0,640,480);c.fillStyle='#36555e';c.font='bold 27px sans-serif';
  c.fillText({craft:'BUILD / DISCOVER',comic:'MY COMIC / ISSUE 01',photo:'LIGHT / COLOUR',portfolio:'SOUND / IMAGE',research:'READ / QUESTION / CONNECT',game:'OUR NEXT ADVENTURE'}[kind]||'IDEAS / NOTES',28,43);
  if(kind==='comic'){
   for(let n=0;n<4;n++){const x=28+n%2*300,z=76+Math.floor(n/2)*190;c.fillStyle=['#bdcbb8','#d4ad87','#a7bbc6','#cab99d'][n];c.fillRect(x,z,276,170);c.strokeStyle='#465b5a';c.lineWidth=4;c.strokeRect(x,z,276,170);c.beginPath();c.arc(x+95,z+67,27,0,7);c.moveTo(x+95,z+94);c.lineTo(x+95,z+145);c.moveTo(x+55,z+115);c.lineTo(x+135,z+115);c.stroke();c.fillStyle='#f5eedf';c.fillRect(x+150,z+25,98,42);}
  }else if(kind==='photo'||kind==='portfolio'){
   for(let n=0;n<3;n++){const x=28+n*200;c.fillStyle=['#8ba6a6','#c7aa87','#7e929d'][n];c.fillRect(x,80,180,255);c.fillStyle='#e4d4ad';c.beginPath();c.arc(x+125,137,27,0,7);c.fill();c.fillStyle='#546e72';c.beginPath();c.moveTo(x,335);c.lineTo(x+65,200+n*20);c.lineTo(x+180,335);c.fill();}c.strokeStyle='#7b8c86';c.lineWidth=3;for(let n=0;n<3;n++){c.beginPath();c.moveTo(30,370+n*27);c.lineTo(570-(n%2)*80,370+n*27);c.stroke();}
  }else if(kind==='game'){
   c.strokeStyle='#b8b498';c.lineWidth=7;c.beginPath();c.moveTo(60,365);c.bezierCurveTo(80,80,380,440,570,120);c.stroke();for(let n=0;n<10;n++){c.fillStyle=['#7d9e9e','#c4a568','#bc8976'][n%3];c.beginPath();c.arc(65+n*55,285+Math.sin(n*.9)*93,15,0,7);c.fill();}
  }else{
   c.strokeStyle='#829995';c.lineWidth=3;for(let n=0;n<9;n++){c.beginPath();c.moveTo(30,88+n*37);c.lineTo(n%3===0?520:595,88+n*37);c.stroke();}c.fillStyle=kind==='craft'?'#b6c9b2':'#d4c396';c.fillRect(360,265,215,135);c.strokeStyle='#476a70';c.strokeRect(380,285,175,95);c.beginPath();c.moveTo(380,380);c.lineTo(440,310);c.lineTo(490,350);c.lineTo(555,292);c.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;(root.ownedTextures||=[]).push(map);pageMaps.set(kind,map);return map;
 };
 const page=(parent,at,size=[250,180],kind=null)=>{const p=mesh(parent,new THREE.PlaneGeometry(...size),finish('#ffffff',{map:kind?projectMap(kind):art('notes'),roughness:.96}),at);p.rotation.x=-Math.PI/2;p.castShadow=false;return p;};
 const book=(parent,at,open=false,kind=null)=>{const g=new THREE.Group();g.position.set(...at);parent.add(g);box(g,[open?280:150,4,210],[0,2,0],blue,2);box(g,[open?270:142,12,200],[0,10,0],paper,2);if(open)page(g,[0,16.1,0],[264,194],kind);else box(g,[150,3,210],[0,17.5,0],blue,2);return g;};
 const pencil=(g,x,base,z,col=ink)=>{rod(g,[x,base+3,z-42],[x,base+3,z+42],3,col);};
 const caseRoll=(g,x,base,z)=>{box(g,[190,28,85],[x,base+14,z],felt,12);box(g,[160,2,8],[x,base+28,z],metal,1);};
 const tumbler=(g,x,base,z)=>{mesh(g,new THREE.CylinderGeometry(28,24,105,24),felt,[x,base+52.5,z]);mesh(g,new THREE.CylinderGeometry(29,29,8,24),graphite,[x,base+109,z]);box(g,[24,2,7],[x,base+114,z-5],metal,2);};
 const musicKeys=(g,x,base,z)=>{box(g,[330,28,175],[x,base+14,z],graphite,7);for(let n=0;n<12;n++)box(g,[23,5,115],[x-138+n*25,base+30.5,z+18],white,1);for(const n of [0,1,3,4,5,7,8,10])box(g,[12,9,66],[x-125+n*25,base+37.5,z-7],graphite,1);for(let n=0;n<3;n++)mesh(g,new THREE.CylinderGeometry(8,8,7,16),metal,[x-90+n*90,base+31.5,z-64]);};
 const photoCamera=(g,x,base,z)=>{box(g,[135,72,65],[x,base+36,z],graphite,7);box(g,[53,15,35],[x-25,base+79.5,z],graphite,4);const lens=mesh(g,new THREE.CylinderGeometry(27,27,26,24),metal,[x+12,base+38,z+43]);lens.rotation.x=Math.PI/2;const face=mesh(g,new THREE.CylinderGeometry(22,22,2,24),glass,[x+12,base+38,z+57]);face.rotation.x=Math.PI/2;};
 for(const [i,phase] of phases.entries()){
  const g=variant(root,phase,'Open floor · '+phase,[l.play[0],9,l.play[1]]);g.userData.propId='play-'+i;markSceneAsset(g,{key:`childroom:${l.id}:fixture:play-${i}`});floor.push(g);
  if(groups.craft&&['morning','afternoon','night','party'].includes(phase)){
   const work=variant(groups.craft,phase,'Study / project materials · '+phase);
   if(phase==='night'){
    // Closed materials are ready for tomorrow; loose tools have gone away.
    book(work,[-190,y,0]);book(work,[-181,y+19,5]);caseRoll(work,210,y,0);
   }else if(phase==='morning'){
    book(work,[-190,y,0]);caseRoll(work,200,y,0);if(age==='college')tumbler(work,365,y,-175);
    box(work,[190,2,110],[-190,y+20,0],paper,1);page(work,[-190,y+21.1,0],[184,104],age==='primary'?'craft':age==='preteen'?'comic':age==='teen'?'portfolio':'research');
   }
   else if(phase==='party'){
    box(work,[460,5,330],[-100,y+2.5,0],oak,4);page(work,[-100,y+5.1,0],[448,318],age==='primary'?'game':age==='preteen'?'comic':age==='teen'?'portfolio':'research');
    for(let n=0;n<4;n++)mesh(work,new THREE.CylinderGeometry(12,12,10,16),[blue,coral,mustard,ink][n],[-180+n*52,y+10,-50+n*28]);
    book(work,[300,y,20]);caseRoll(work,240,y,-180);pencil(work,420,y,150,coral);
   }else{
    if(age==='primary'){
     box(work,[330,12,240],[-210,y+6,0],oak,4);
     for(let n=0;n<4;n++)box(work,[45,45+n%2*25,55],[-310+n*65,y+12+(45+n%2*25)/2,0],[blue,coral,mustard,oak][n],4);
     box(work,[240,2,230],[210,y+1,0],paper,1);page(work,[210,y+2.1,0],[234,224],'craft');
     for(let n=0;n<3;n++)pencil(work,360+n*18,y,-35,[coral,blue,mustard][n]);
     mesh(work,new THREE.CylinderGeometry(17,17,60,18),white,[335,y+30,-190]);mesh(work,new THREE.CylinderGeometry(18,18,15,18),blue,[335,y+67.5,-190]);
    }else if(age==='preteen'){
     box(work,[330,6,250],[-200,y+3,0],coral,3);page(work,[-200,y+6.1,0],[320,240],'comic');photoCamera(work,235,y,-145);
     for(let n=0;n<2;n++){box(work,[112,2,135],[170+n*140,y+1,110],paper,1);page(work,[170+n*140,y+2.1,110],[100,116],'photo');}pencil(work,-395,y,0,blue);
    }else if(age==='teen'){
     musicKeys(work,-210,y,0);box(work,[245,7,255],[210,y+3.5,0],ink,3);page(work,[210,y+7.1,0],[235,245],'portfolio');pencil(work,375,y,0,coral);
    }else{
     book(work,[-210,y,0],true,'research');
     box(work,[235,5,240],[185,y+2.5,80],paper,2);page(work,[185,y+5.1,80],[229,234],'research');
     for(let n=0;n<3;n++)box(work,[35,2,18],[317,y+2+n*.3,15+n*38],[coral,mustard,blue][n],1);
     tumbler(work,345,y,-160);pencil(work,375,y,120,ink);
    }
   }
  }
  if(['evening','party'].includes(phase)){
   const reading=variant(groups.nook,phase,'Reading / reference book');book(reading,[-185,150,30],true,age==='primary'?'craft':age==='preteen'?'comic':age==='teen'?'portfolio':'research');
   // A little reading pile is clear of the open book and rear bolster.
   book(reading,[175,150,95]);
   if(age!=='primary'){
    for(const x of [-24,24]){const lens=mesh(reading,new THREE.TorusGeometry(18,2,6,24),graphite,[175+x,171,95]);lens.rotation.x=Math.PI/2;}
    rod(reading,[169,171,95],[181,171,95],2,graphite);rod(reading,[133,171,95],[133,171,135],2,graphite);rod(reading,[217,171,95],[217,171,135],2,graphite);
   }
  }
 }
 return {floor,update(phase){for(const v of variants)v.g.visible=v.phase===phase;root.userData.childActivity={phase,ageStage:age,project:{primary:'craft and building',preteen:'comics and photography',teen:'music and portfolio',college:'annotated research'}[age],lowDrawingSurface:age==='primary'&&['afternoon','party'].includes(phase),readingBook:['evening','party'].includes(phase),playMatClear:true};}};
}
