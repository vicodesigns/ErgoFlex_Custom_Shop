import * as THREE from 'three';
import {earlyYearsProfile} from './early-years-profiles.mjs';

// Painted architecture and personal art belong to the early-years room only.
// Murals sit against solid wall faces; the window and floor plan stay clear.
export function enhanceEarlyYearsWalls({root,layout:l,helpers:h,materials:m,groups}){
 const profile=earlyYearsProfile(l);if(!profile)return {update(){}};
 const p=profile.palette,design=profile.design,{box,mesh,material,markSceneAsset}=h,{rear,right}=groups,front=l.back+l.depth,maps=new Map();
 const own=t=>{(root.ownedTextures||=[]).push(t);return t;};
 const texture=(key,draw,w=1024,hh=768)=>{if(maps.has(key))return maps.get(key);const c=document.createElement('canvas');c.width=w;c.height=hh;draw(c.getContext('2d'),w,hh);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;maps.set(key,t);return own(t);};
 const mat=(color,extra={})=>{const a=material(color,{roughness:.97,metalness:0,...extra});a.userData.roomFinishLocked=true;return a;};
 const fixture=(parent,id,name,at=[0,0,0],turn=0)=>{const g=new THREE.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);g.userData.propId=id;g.userData.sceneAssetName=name;g.userData.wallDecoration=true;g.userData.dropSurface=false;g.userData.earlyWallLife=true;markSceneAsset(g,{key:`childroom:${l.id}:fixture:${id}`});return g;};
 const flat=(parent,width,height,map,at=[0,0,0])=>{const o=mesh(parent,new THREE.PlaneGeometry(width,height),mat('#ffffff',{map}),at);o.castShadow=false;o.receiveShadow=true;o.userData.presentationOnly=true;return o;};
 const circle=(c,x,y,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
 const leaf=(c,x,y,rx,ry,a,col)=>{c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,a,0,Math.PI*2);c.fill();};
 const stroke=(c,pts,col,width=5)=>{c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
 const star=(radius=30)=>{const s=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?radius*.46:radius,x=Math.cos(a)*r,y=Math.sin(a)*r;i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();return s;};
 // The sleeping wall: a big hand-painted tree with a swing over the bed, a
 // moon and stars where the projector stars land at night, drawn in true mm
 // so nothing is stretched. Profile motifs sit small on the far hills.
 const rearBottom0=930,rearTop0=l.height-40,muralW=l.width-40,muralH=rearTop0-rearBottom0;
 function paintSleepWall(c,w,hh){
  c.save();c.scale(w/muralW,hh/muralH);const W=muralW,H=muralH,bx=l.bed[0]+W/2,ground=H;
  let sd=71;const r=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};
  const blob=(x,y,rx,ry,col,a=1)=>{c.globalAlpha=a;c.fillStyle=col;c.beginPath();for(let t=0;t<=6.3;t+=.3){const k=1+.12*Math.sin(t*3+x*.01)+.06*Math.sin(t*7);c.lineTo(x+Math.cos(t)*rx*k,y+Math.sin(t)*ry*k);}c.closePath();c.fill();c.globalAlpha=1;};
  const brush=(pts,col,width)=>{c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
  // Clouds and a moon with painted stars.
  const mx=Math.min(W-260,bx+1350),my=H*.24;c.globalAlpha=.35;circle(c,mx,my,250,'#fff5d6');c.globalAlpha=1;circle(c,mx,my,165,'#f6dd96');circle(c,mx+70,my-40,150,'#e9efe9');
  for(let i=0;i<14;i++){const x=bx-500+r()*1900,y=60+r()*H*.42,s=10+r()*16;c.fillStyle=i%3?'#f6dd96':'#ffffff';c.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,q=k%2?s*.42:s;c.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q);}c.fill();}
  for(const [x,y,s] of [[bx+600,H*.12,1],[Math.min(W-500,bx+2100),H*.36,.8]]){for(let i=0;i<4;i++)blob(x+i*90*s,y+(i%2)*20,110*s,55*s,'#ffffff',.75);}
  // The tree: trunk rises beside the bed, the crown spreads over it.
  const tx=bx+760,crownX=bx+120,crownY=H*.34;
  c.fillStyle='#8a6a4f';c.beginPath();c.moveTo(tx-70,ground);c.bezierCurveTo(tx-40,ground-380,tx-120,ground-760,crownX+260,crownY+140);c.lineTo(crownX+330,crownY+190);c.bezierCurveTo(tx+20,ground-760,tx+90,ground-380,tx+90,ground);c.closePath();c.fill();
  brush([[tx-20,ground-560],[tx+220,ground-860],[tx+330,ground-900]],'#8a6a4f',38);
  const branch=[[crownX+260,crownY+150],[crownX-200,crownY+210],[crownX-640,crownY+180]];brush(branch,'#7a5c43',44);
  const greens=[p.second,'#7fa889',p.feature,'#9cbf8f','#5f8c74'];
  for(let i=0;i<34;i++){const a=r()*Math.PI*2,d=Math.sqrt(r());blob(crownX+Math.cos(a)*d*760,crownY+Math.sin(a)*d*330,160+r()*120,110+r()*70,greens[i%greens.length],.92);}
  for(let i=0;i<12;i++)circle(c,crownX-600+r()*1300,crownY-250+r()*520,16,i%2?p.accent:'#f2b84b');
  // A rope swing hangs from the long branch, over the pillows.
  const sx=crownX-420,sy=crownY+200,seatY=Math.min(H-120,sy+820);brush([[sx-110,sy],[sx-110,seatY]],'#7a5c43',12);brush([[sx+110,sy],[sx+110,seatY]],'#7a5c43',12);
  c.fillStyle='#a8744f';c.fillRect(sx-150,seatY-8,300,34);
  // A little bird and a kite caught in the leaves.
  brush([[crownX+420,crownY-210],[crownX+450,crownY-235],[crownX+480,crownY-210]],p.ink,6);
  c.restore();
 }
 const mural=(variant,aspect)=>texture('mural-'+variant,(c,w,hh)=>{
  const figureAspect=Math.max(.4,aspect/2);
  c.save();c.scale(w/1600,hh/800);
  const wash=c.createLinearGradient(0,0,0,800);wash.addColorStop(0,'#e5eeea');wash.addColorStop(.55,p.wall);wash.addColorStop(1,p.feature);c.fillStyle=wash;c.fillRect(0,0,1600,800);
  // Uneven, broad painted hills create a room-scale landscape rather than
  // rows of identical framed graphics. The profile supplies its visual story.
  for(let layer=0;layer<3;layer++){
   c.globalAlpha=variant?[.22,.2,.28][layer]:[.3,.34,.5][layer];c.fillStyle=[p.feature,p.cloth,p.second][layer];c.beginPath();c.moveTo(0,800);
   for(let x=0;x<=1600;x+=16)c.lineTo(x,530+layer*85+Math.sin(x/240+layer+variant)*65);c.lineTo(1600,800);c.closePath();c.fill();
  }c.globalAlpha=1;
  // The sleeping wall is a quiet wash, with the detailed story confined to
  // the play wall. Art collections no longer compete with full-wall figures.
  if(variant){
  circle(c,1250,145,70,'#f5d789');
  for(const [x,y] of [[180,130],[730,95]]){c.globalAlpha=.6;for(let i=0;i<3;i++)leaf(c,x+i*40,y+Math.sin(i)*12,55,27,0,'#fff8e6');}c.globalAlpha=1;
  const tree=(x,y,s)=>{
   c.save();c.translate(x,y);c.scale(1/figureAspect,1);c.translate(-x,-y);
   stroke(c,[[x,y],[x-12*s,y-230*s],[x+10*s,y-420*s]],p.ink,12*s);
   for(let i=0;i<6;i++){const yy=y-(100+i*50)*s,side=i%2?1:-1;leaf(c,x+side*54*s,yy,74*s,34*s,side*.6,i%3?p.second:p.feature);}
   c.restore();
  };
  const friend=(x,y,s,type=0)=>{
   c.save();c.translate(x,y);c.scale(1/figureAspect,1);c.translate(-x,-y);
   leaf(c,x,y-52*s,48*s,65*s,0,p.accent);circle(c,x,y-140*s,40*s,p.accent);
   if(type===1){leaf(c,x-21*s,y-188*s,12*s,42*s,-.12,p.accent);leaf(c,x+21*s,y-188*s,12*s,42*s,.12,p.accent);}
   else{circle(c,x-31*s,y-169*s,17*s,p.accent);circle(c,x+31*s,y-169*s,17*s,p.accent);}
   for(const dx of [-12,12])circle(c,x+dx*s,y-144*s,3*s,p.ink);leaf(c,x,y-124*s,17*s,11*s,0,p.wall);circle(c,x,y-130*s,4*s,p.ink);
   c.restore();
  };
  if(profile.motif==='nature'||profile.motif==='music'){
   for(const [x,y,s] of [[220,690,1.05],[1070,705,.9]])tree(x,y,s);
   friend(570,690,.88,1);
   if(profile.motif==='music')for(let i=0;i<7;i++){const x=560+i*72;const yy=370+Math.sin(i*.8)*26;stroke(c,[[x,yy],[x,yy+95+i*8]],[p.second,p.feature,p.accent][i%3],35);circle(c,x,yy-10,7,p.wall);}
   else for(let i=0;i<4;i++){const x=860+i*125;leaf(c,x,330+Math.sin(i)*28,35,15,-.4,p.second);stroke(c,[[x-12,330+Math.sin(i)*28],[x+12,330+Math.sin(i)*28]],p.wall,2);}
  }else if(profile.motif==='pretend'){
   for(let i=0;i<design.muralScenes;i++){const x=160+i*370,y=560+Math.sin(i*1.2)*50,ww=160+(i%2)*30,hh=140+i%3*25;c.fillStyle=[p.feature,p.cloth,p.second][i%3];c.fillRect(x,y-hh,ww,hh);c.fillStyle=p.accent;c.beginPath();c.moveTo(x-18,y-hh);c.lineTo(x+ww*.5,y-hh-100);c.lineTo(x+ww+18,y-hh);c.fill();c.fillStyle=p.wall;c.fillRect(x+ww*.38,y-75,ww*.24,75);for(const dx of [25,ww-55])c.fillRect(x+dx,y-hh+28,30,36);}
   tree(1330,715,.7);
  }else if(profile.motif==='building'){
   c.fillStyle=p.second;c.fillRect(130,470,1340,65);for(const x of [200,650,1150])c.fillRect(x,535,125,170);
   stroke(c,[[140,440],[1470,440]],p.ink,7);for(let x=180;x<1470;x+=130)stroke(c,[[x,440],[x,470]],p.ink,5);
   for(const [x,col] of [[410,p.accent],[940,p.feature]]){c.fillStyle=col;c.fillRect(x,365,150,70);c.fillRect(x+150,335,80,100);c.fillStyle=p.wall;c.fillRect(x+165,345,48,40);for(const dx of [35,180]){circle(c,x+dx,438,24,p.ink);circle(c,x+dx,438,11,p.wall);}}
   for(let i=0;i<3;i++){c.fillStyle=[p.feature,p.accent,p.second][i%3];c.fillRect(330+i*240,710-i%2*50,78,78);}
  }else{
   for(let i=0;i<design.muralScenes;i++){const x=280+i*660,y=560+(i%2)*60;for(let tower=0;tower<2;tower++){const xx=x+tower*130;c.fillStyle=i%2?p.second:p.cloth;c.fillRect(xx,y-200,100,200);c.fillStyle=p.accent;c.beginPath();c.moveTo(xx-15,y-200);c.lineTo(xx+50,y-300);c.lineTo(xx+115,y-200);c.fill();c.fillStyle=p.wall;c.fillRect(xx+33,y-150,34,55);}friend(x+65,y+90,.55,i%2);}
   for(const [x,y] of [[640,200],[1040,110]]){leaf(c,x,y,45,60,0,p.feature);stroke(c,[[x-25,y+48],[x-18,y+100],[x+18,y+100],[x+25,y+48]],p.ink,3);}
  }}
  // A dry-brush speckle layer softens the clean vector edges into painted
  // plaster. This is generated once per room, never during animation.
  // (The old sin(i*k) positions formed a regular lattice that minified into a
  // screen-door grid at the wide camera; a hashed sequence has no lattice.)
  let seed=variant*977+13;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  c.globalAlpha=.06;for(let i=0;i<700;i++){const x=rnd()*1600,y=rnd()*800;c.fillStyle=i%2?'#ffffff':p.ink;c.fillRect(x,y,1.5+rnd()*2.5,1.5+rnd()*2);}c.restore();
  if(!variant)paintSleepWall(c,w,hh);
 },2048,1024);
 const rearBottom=930,rearTop=l.height-40;
 // 5 mm proud: at 0.7 mm the painted plane z-fought a coplanar wall layer and
 // showed a woven grid at the wide camera (an 8 mm test removed it outright).
 const rearMural=fixture(rear,'early-rear-mural','Hand-painted '+profile.motif+' landscape',[0,(rearBottom+rearTop)/2,l.back+5]);
 flat(rearMural,l.width-40,rearTop-rearBottom,mural(0,(l.width-40)/(rearTop-rearBottom)));
 const rightStart=l.back+2700,rightEnd=front-45,rightBottom=740,rightTop=l.height-45;
 const sideMural=fixture(right,'early-right-mural','Wraparound painted play landscape',[l.width/2-3,(rightBottom+rightTop)/2,(rightStart+rightEnd)/2],-Math.PI/2);
 flat(sideMural,rightEnd-rightStart,rightTop-rightBottom,mural(1,(rightEnd-rightStart)/(rightTop-rightBottom)));

 // Bunting is high on the rear wall, separate from the existing framed and
 // clipped work. It stays a soft textile feature in the evening and at night.
 const bunting=fixture(rear,'early-fabric-bunting','A short strand of handmade fabric flags',[l.width*.22,l.height-70,l.back+35]);
 const half=Math.min(l.width*.23,1400),points=[];for(let i=0;i<=24;i++){const x=-half+i*half*2/24;points.push(new THREE.Vector3(x,-30*Math.sin(i/24*Math.PI),0));}
 mesh(bunting,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),70,2.5,4,false),mat('#a68e6c'));
 const flagMats=[p.accent,p.second,p.feature,p.cloth].map(col=>mat(col,{map:m.linen.map,side:THREE.DoubleSide})),flagCount=design.flags;
 for(let i=0;i<flagCount;i++){const u=(i+.5)/flagCount,x=-half+u*half*2,shape=new THREE.Shape();shape.moveTo(-60,0);shape.lineTo(60,0);shape.lineTo(0,-120);shape.closePath();const o=mesh(bunting,new THREE.ShapeGeometry(shape),flagMats[i%4],[x,-30*Math.sin(u*Math.PI),1]);o.rotation.z=Math.sin(i*4)*.045;o.castShadow=false;}

 const childPainting=(index)=>texture('child-painting-'+index,(c,w,hh)=>{
  c.fillStyle=['#fff0d3','#f2e6dd','#ecedd9'][index%3];c.fillRect(0,0,w,hh);
  c.save();c.scale(w/600,hh/750);c.lineCap='round';c.lineJoin='round';
  const crayon=(pts,col,width=9)=>{for(let k=0;k<3;k++){c.globalAlpha=.38;stroke(c,pts.map(([x,y])=>[x+Math.sin(k+index)*3,y+Math.cos(k*2)*3]),col,width-k*2);}c.globalAlpha=1;};
  if(index===0){
   circle(c,425,145,66,p.feature);for(let i=0;i<9;i++){const a=i*Math.PI*2/9;crayon([[425+Math.cos(a)*86,145+Math.sin(a)*86],[425+Math.cos(a)*115,145+Math.sin(a)*115]],p.accent,8);}
   crayon([[65,640],[110,480],[155,640],[190,460],[225,640]],p.second,12);for(let i=0;i<3;i++){const x=100+i*160;crayon([[x,520],[x,350]],p.second,10);for(let j=0;j<5;j++)leaf(c,x+Math.sin(j*1.26)*37,330+Math.cos(j*1.26)*37,25,36,j*1.26,p.accent);circle(c,x,330,20,p.feature);}
  }else if(index===1){
   for(let i=0;i<3;i++){const x=115+i*175,col=[p.accent,p.second,p.feature][i];crayon([[x,360],[x,560],[x-55,650],[x,560],[x+55,640]],col,12);crayon([[x-65,460],[x+70,435]],col,11);c.strokeStyle=col;c.lineWidth=12;c.beginPath();c.ellipse(x,285,48,65,Math.sin(i)*.1,0,Math.PI*2);c.stroke();circle(c,x-15,275,4,p.ink);circle(c,x+15,275,4,p.ink);crayon([[x-18,310],[x,320],[x+20,305]],p.ink,4);}
   crayon([[55,690],[530,680]],p.second,8);
  }else{
   crayon([[90,500],[90,285],[440,300],[445,525],[90,500]],p.second,13);crayon([[65,300],[270,130],[470,305]],p.accent,15);crayon([[245,510],[250,370],[340,375],[340,515]],p.feature,12);for(const x of [150,385])crayon([[x,340],[x,405],[x+40,405],[x+40,340],[x,340]],p.ink,7);crayon([[310,530],[375,630],[420,690]],p.accent,9);
  }
  // Finger-paint blobs, imperfect crayon edges and a crooked name line make
  // these feel child-made, rather than three copies of a design poster.
  for(let i=0;i<6;i++){c.globalAlpha=.3;leaf(c,45+i*92,60+(i%2)*25,12,19,.2,[p.accent,p.second,p.feature][i%3]);}c.globalAlpha=1;c.strokeStyle=p.ink;c.lineWidth=3;c.beginPath();c.moveTo(365,715);c.bezierCurveTo(395,690,420,740,450,710);c.bezierCurveTo(470,735,490,700,530,720);c.stroke();c.restore();
 },600,750);
 const gallery=fixture(right,'early-collected-paintings','A small collection of my own paintings',[l.width/2-26,1320,front-450],-Math.PI/2);
 const paintPaper=(parent,index,x,y,width,height,angle=0)=>{
  const g=new THREE.Group();g.position.set(x,y,0);g.rotation.z=angle;parent.add(g);
  box(g,[width+5,height+5,2],[0,0,0],mat('#e3ceb1'),1);flat(g,width,height,childPainting(index),[0,0,1.2]);
  for(const xx of [-width*.28,width*.28]){const tape=box(g,[50,24,1],[xx,height/2-3,2],mat('#d9bc86',{transparent:true,opacity:.85}),1);tape.rotation.z=xx<0?-.13:.12;}
  return g;
 };
 // The low family picture sits beside the wall pocket, while the taller
 // flower painting clears its books by 70 mm. No paper covers the pocket.
 paintPaper(gallery,0,-170,240,240,300,-.035);paintPaper(gallery,1,140,-210,210,260,.035);if(design.paintings===3)paintPaper(gallery,2,145,170,220,260,-.025);
 let wardrobe;root.traverse(o=>{if(o.userData.propId==='personal-wardrobe')wardrobe=o;});
 if(wardrobe){const doorArt=fixture(wardrobe,'early-wardrobe-art','A favourite drawing taped to the wardrobe',[0,0,296]);paintPaper(doorArt,2,-220,1160,210,260,-.035);}
 // Quiet phosphorescent-style stickers, without extra lights or animation.
 const stars=fixture(rear,'early-bedtime-stars','Small bedtime star stickers',[l.bed[0],0,l.back+38]);
 const glow=mat('#edcf87',{emissive:'#e0bc73',emissiveIntensity:0});
 for(const [x,y,r] of [[-420,2340,23],[-100,2510,18],[330,2380,26],[520,2610,15]]){const s=mesh(stars,new THREE.ShapeGeometry(star(r)),glow,[x,y,0]);s.castShadow=false;}
 root.userData.earlyYearsWalls={profile:profile.id,murals:2,detailedMurals:1,displayClusters:1,paintings:design.paintings+(wardrobe?1:0),bunting:flagCount,calmSleepingWall:true,childArtCenterMm:1320,focus:design.focus,phase:'morning',windowClearFromZ:rightStart};
 return {update(phase){glow.emissiveIntensity=phase==='night'?.045:phase==='evening'?.015:0;root.userData.earlyYearsWalls.phase=phase;}};
}
