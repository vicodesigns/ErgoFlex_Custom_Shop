import * as THREE from 'three';
const phases=['morning','afternoon','evening','night','party'];

// Daily materials stay inside their own furniture group. Repositioning a nook
// or table in the editor therefore carries its active story with it.
export function buildChildActivities({root,layout:l,helpers:h,materials:m,groups,art}){
 const {box,mesh,sphere,markSceneAsset}=h,{oak,coral,blue,mustard,green,ink,paper}=m,variants=[];
 const variant=(parent,phase,name,at=[0,0,0])=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.userData.childActivity=phase;parent.add(g);variants.push({g,phase});return g;};
 const surface=(parent,size,at,kind)=>{const page=mesh(parent,new THREE.PlaneGeometry(...size),h.material('#ffffff',{map:art(kind),roughness:.97}),at);page.rotation.x=-Math.PI/2;page.castShadow=false;return page;};
 const crayons=(g,x,y,z)=>{for(let i=0;i<4;i++){const o=mesh(g,new THREE.CylinderGeometry(7,7,95,10),[coral,mustard,blue,green][i],[x+i*24,y+7,z]);o.rotation.x=Math.PI/2;}};
 const openBook=(g,at,kind='forest')=>{const b=new THREE.Group();b.position.set(...at);g.add(b);box(b,[280,4,210],[0,2,0],blue,2);for(const x of [-68,68]){box(b,[132,10,200],[x,9,0],paper,2);surface(b,[128,196],[x,14.1,0],x<0?kind:'animal');}box(b,[4,10,202],[0,9,0],oak,1);return b;};
 const blocks=(g,points)=>points.forEach(([x,z,n=1],i)=>{for(let y=0;y<n;y++)box(g,[80,80,80],[x,40+y*80,z],[oak,coral,blue,mustard][i%4],5);if(i%3===0){const roof=mesh(g,new THREE.CylinderGeometry(0,60,70,4),coral,[x,80*n+35,z]);roof.rotation.y=Math.PI/4;}});
 const floor=[];
 for(const [i,phase] of phases.entries()){
  const g=variant(root,phase,['A little block invitation','Low drawing station','Room ready for a story','Toys tucked away','Railway & block village'][i],[l.play[0],9,l.play[1]]);g.userData.propId='play-'+i;markSceneAsset(g,{key:`childroom:${l.id}:fixture:play-${i}`});floor.push(g);
  if(phase==='morning'){
   blocks(g,[[-310,-190,1],[-150,-180,2],[20,-155,1],[210,-160,1],[-240,80,1]]);
   // A compact sorting invitation with large coloured discs, away from blocks.
   box(g,[320,14,150],[245,7,150],oak,5);for(let j=0;j<3;j++)mesh(g,new THREE.CylinderGeometry(35,35,16,20),[coral,mustard,blue][j],[145+j*100,22,150]);
  }
  if(phase==='afternoon'&&!groups.craft){
   // Small rooms get a floor-height tray rather than another full table.
   const tray=variant(g,phase,'Portable floor drawing tray');box(tray,[620,16,440],[0,152,0],oak,9);for(const x of [-260,260])for(const z of [-170,170])box(tray,[30,144,30],[x,72,z],oak,4);
   box(tray,[360,2,280],[-55,161,0],paper,1);surface(tray,[354,274],[-55,162.1,0],'drawing');crayons(tray,170,160,-30);
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
   else{box(g,[300,3,250],[-200,451.5,0],paper,2);surface(g,[294,244],[-200,453.1,0],phase==='party'?'boat':'drawing');crayons(g,150,450,-30);}
  }
 }
 return {floor,update(phase){for(const {g,phase:p} of variants)g.visible=p===phase;groups.marketGoods?.forEach(o=>o.visible=['morning','afternoon','party'].includes(phase));root.userData.childActivity={phase,lowDrawingSurface:phase==='afternoon'||phase==='party',readingBook:phase==='evening'||phase==='party',playMatClear:phase==='night'||phase==='evening'};}};
}
