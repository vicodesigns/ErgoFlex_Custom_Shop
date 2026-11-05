import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CHILD_PERSONALITY_PALETTES} from './child-personality-detail.mjs';
import {earlyYearsProfile} from './early-years-profiles.mjs';
import {drawChildCrayon} from './early-years-art.mjs';

// Lived-in walls for every life stage: pinned, taped and hung things that a
// real owner put up over a year, plus the room-shell trim the rooms lacked
// (curtain pole, right-wall skirting, window sill objects, glass stickers).
//
// Cost: every paper item of a stage is drawn once into ONE canvas atlas and
// merged per cluster: a cluster is at most four draw calls (paper, solid
// vertex-coloured parts, glow, translucent marks). No lights, no shadows from
// paper, no realtime reflections. Runs last in the decor chain and places
// clusters only where existing wall decor and wall-side furniture leave room.

const SANS='"Liberation Sans","DejaVu Sans",Arial,sans-serif',SERIF='"Liberation Serif","DejaVu Serif",Georgia,serif',MONO='"DejaVu Sans Mono","Liberation Mono",monospace',HAND='"Comic Sans MS","Comic Neue","Patrick Hand",cursive';
const rng=seed=>{let s=(seed*2654435761)>>>0||1;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
const AGE_HEIGHT={2:870,3:950,4:1020,5:1090,6:1150,7:1210,8:1270,9:1320,10:1380,11:1430,12:1490,13:1560,14:1630,15:1690,16:1730,17:1750,18:1760};

// ---------- canvas drawing kit (all coordinates in millimetres) ----------
const fill=(c,col,x,y,w,h)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
const dot=(c,x,y,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
const ring=(c,x,y,r,col,lw)=>{c.strokeStyle=col;c.lineWidth=lw;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();};
const path=(c,pts,col,lw,close=false)=>{c.strokeStyle=col;c.lineWidth=lw;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(close)c.closePath();c.stroke();};
const poly=(c,pts,col)=>{c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
const vgrad=(c,x,y,w,h,a,b)=>{const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(x,y,w,h);};
function text(c,s,x,y,size,col,{weight='bold',family=SANS,align='left',sx=1,rot=0,max}={}){c.save();c.translate(x,y);c.rotate(rot);c.scale(sx,1);c.fillStyle=col;c.font=`${weight} ${size}px ${family}`;c.textAlign=align;c.textBaseline='alphabetic';max?c.fillText(s,0,0,max/sx):c.fillText(s,0,0);c.restore();}
// Hand lettering: every glyph wobbles a little, so notes read as written.
function hand(c,s,x,y,size,col,{seed=1,rot=0,jit=.07,weight='',family=HAND,align='left'}={}){
 const r=rng(seed+s.length*13);c.save();c.translate(x,y);c.rotate(rot);c.fillStyle=col;c.font=`${weight} ${size}px ${family}`;c.textBaseline='alphabetic';
 const chars=[...s],widths=chars.map(ch=>c.measureText(ch).width),total=widths.reduce((a,b)=>a+b,0);let cx=align==='center'?-total/2:align==='right'?-total:0;
 chars.forEach((ch,i)=>{c.save();c.translate(cx,(r()-.5)*size*jit*2);c.rotate((r()-.5)*jit*2.4);c.fillText(ch,0,0);c.restore();cx+=widths[i]*(.95+r()*.08);});c.restore();
}
function scribble(c,x,y,w,col,seed,lw=1.4){const r=rng(seed);c.strokeStyle=col;c.lineWidth=lw;c.lineCap='round';c.beginPath();c.moveTo(x,y);for(let t=0;t<w;t+=3)c.lineTo(x+t,y+Math.sin(t*.4+r()*2)*2.2*(.5+r()));c.stroke();}
function speckle(c,w,h,n,cols,seed,size=1.6,alpha=.18){const r=rng(seed);c.save();c.globalAlpha=alpha;for(let i=0;i<n;i++){c.fillStyle=cols[i%cols.length];const s=size*(.4+r());c.fillRect(r()*w,r()*h,s,s);}c.restore();}
function sheetBg(c,w,h,col,{rule=0,margin=false,grid=0,age=.06,seed=3}={}){
 fill(c,col,0,0,w,h);
 if(grid){c.strokeStyle='rgba(80,120,150,.22)';c.lineWidth=.5;for(let x=grid;x<w;x+=grid){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=grid;y<h;y+=grid){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}}
 if(rule){c.strokeStyle='rgba(90,130,170,.35)';c.lineWidth=.6;for(let y=rule*2;y<h-4;y+=rule){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}}
 if(margin){c.strokeStyle='rgba(200,90,90,.45)';c.lineWidth=.8;c.beginPath();c.moveTo(w*.13,0);c.lineTo(w*.13,h);c.stroke();}
 // Light handling marks and a warmer edge make paper look a year old.
 const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,`rgba(150,120,70,${age})`);g.addColorStop(.5,'rgba(150,120,70,0)');g.addColorStop(1,`rgba(120,95,60,${age*1.4})`);c.fillStyle=g;c.fillRect(0,0,w,h);
 speckle(c,w,h,Math.round(w*h/900),['#7a6a50','#ffffff'],seed,1.2,.08);
}
// Invented photographs: simple, bold scenes that survive a wide camera.
function scene(c,x,y,w,h,kind,seed){
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.translate(x,y);const r=rng(seed);
 const skyTo=(a,b,f=.6)=>vgrad(c,0,0,w,h*f,a,b);
 if(kind==='beach'){skyTo('#7fb4d6','#cfe4ea');fill(c,'#3f86a8',0,h*.55,w,h*.14);fill(c,'#e3cf9f',0,h*.69,w,h*.31);dot(c,w*.78,h*.2,w*.08,'#fff1c4');for(const [px,col] of [[.32,'#c45a4a'],[.5,'#2e4f6b']]){dot(c,w*px,h*.6,w*.05,'#6b4a3a');fill(c,col,w*px-w*.06,h*.65,w*.12,h*.2);}}
 else if(kind==='friends'){vgrad(c,0,0,w,h,'#e8b36b','#b06a4c');for(let i=0;i<3;i++){const px=w*(.25+i*.25),col=['#2f4858','#7a3b3b','#3d6b5a'][i];dot(c,px,h*.42,w*.09,['#e7c3a0','#9c6b4e','#d9a97f'][i]);poly(c,[[px-w*.13,h],[px-w*.1,h*.55],[px+w*.1,h*.55],[px+w*.13,h]],col);dot(c,px,h*.36,w*.095,['#3a2a20','#151515','#a5683a'][i]);dot(c,px,h*.44,w*.075,['#e7c3a0','#9c6b4e','#d9a97f'][i]);}}
 else if(kind==='dog'){vgrad(c,0,0,w,h,'#9cc27c','#5f8a4f');c.fillStyle='#c98b4a';c.beginPath();c.ellipse(w*.5,h*.62,w*.3,h*.18,0,0,7);c.fill();dot(c,w*.74,h*.45,w*.14,'#c98b4a');c.fillStyle='#8a5a2c';c.beginPath();c.ellipse(w*.83,h*.4,w*.05,h*.1,.4,0,7);c.fill();dot(c,w*.78,h*.42,w*.018,'#1a1a1a');dot(c,w*.87,h*.5,w*.025,'#1a1a1a');}
 else if(kind==='mountain'){skyTo('#9db7cf','#e6d7c4',.7);poly(c,[[0,h*.8],[w*.3,h*.3],[w*.55,h*.62],[w*.72,h*.4],[w,h*.75],[w,h],[0,h]],'#5d6f7f');poly(c,[[w*.22,h*.42],[w*.3,h*.3],[w*.38,h*.42]],'#f2f2f0');fill(c,'#3e5a46',0,h*.82,w,h*.18);}
 else if(kind==='city'){fill(c,'#1d2840',0,0,w,h);for(let i=0;i<7;i++){const bw=w*(.1+r()*.08),bh=h*(.3+r()*.45),bx=i*w*.15-5;fill(c,'#0f1626',bx,h-bh,bw,bh);for(let k=0;k<12;k++)if(r()>.45)fill(c,'#f3c96b',bx+3+r()*(bw-6),h-bh+4+r()*(bh-8),2.2,2.2);}dot(c,w*.82,h*.18,w*.05,'#efe7cf');}
 else if(kind==='concert'){fill(c,'#140f1c',0,0,w,h);for(const [px,col] of [[.2,'rgba(255,90,140,.55)'],[.5,'rgba(90,170,255,.5)'],[.8,'rgba(255,200,90,.55)']])poly(c,[[w*px,0],[w*px-w*.2,h*.75],[w*px+w*.2,h*.75]],col);for(let i=0;i<9;i++)dot(c,w*(i/8),h*(.86+r()*.06),w*.07,'#05040a');fill(c,'#05040a',0,h*.9,w,h*.1);}
 else if(kind==='forest'){vgrad(c,0,0,w,h,'#c7d6b0','#4f6d4b');for(let i=0;i<6;i++){const px=w*(i/5);poly(c,[[px,h*.15+r()*h*.2],[px-w*.13,h*.85],[px+w*.13,h*.85]],['#2f4a35','#3d5c40','#26402e'][i%3]);}fill(c,'#5a4632',0,h*.85,w,h*.15);}
 else if(kind==='cake'){vgrad(c,0,0,w,h,'#f4d6c2','#d9a99a');fill(c,'#f7efe2',w*.22,h*.5,w*.56,h*.3);fill(c,'#e58aa1',w*.22,h*.5,w*.56,h*.07);for(let i=0;i<5;i++){fill(c,'#7fb0d8',w*(.3+i*.1),h*.36,w*.025,h*.14);dot(c,w*(.312+i*.1),h*.33,w*.022,'#ffcf5a');}}
 else if(kind==='lake'){skyTo('#f0b88a','#f6dfc0',.5);fill(c,'#6c8fa6',0,h*.5,w,h*.5);dot(c,w*.5,h*.48,w*.12,'#ffd39a');fill(c,'#6c8fa6',0,h*.5,w,h*.04);for(let i=0;i<6;i++)fill(c,'rgba(255,220,170,.5)',w*(.4+r()*.2),h*(.55+i*.06),w*.2*(1-i*.12),1.5);poly(c,[[0,h*.5],[w*.2,h*.38],[w*.38,h*.5]],'#3b4b45');}
 else{vgrad(c,0,0,w,h,'#d8c2a0','#8c7258');dot(c,w*.5,h*.45,w*.2,'#f1e0c2');}
 // Film warmth and soft vignette.
 const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,200,140,.08)');g.addColorStop(1,'rgba(40,20,10,.18)');c.fillStyle=g;c.fillRect(0,0,w,h);
 c.restore();
}
function polaroid(c,w,h,kind,seed,caption){fill(c,'#f6f3ea',0,0,w,h);const m=w*.07;scene(c,m,m,w-m*2,w-m*2,kind,seed);if(caption)hand(c,caption,w/2,h-m*.9,Math.min(h-w,w*.16)*.6,'#2c3440',{seed,align:'center'});speckle(c,w,h,40,['#9a8a70'],seed,1,.12);}
// Gig and event posters: invented bands, invented venues, original art.
function poster(c,w,h,spec){
 const {bg,ink,hot,title,lines=[],style,seed=1}=spec,r=rng(seed);fill(c,bg,0,0,w,h);
 if(style==='sun'){for(let y=0;y<h*.62;y+=9)for(let x=0;x<w;x+=9){const d=Math.hypot(x-w*.5,y-h*.32)/(w*.36);if(d<1)dot(c,x+4,y+4,4.2*(1-d*.55),hot);}for(let i=0;i<5;i++)path(c,Array.from({length:30},(_,k)=>[k*w/29,h*(.6+i*.035)+Math.sin(k*.7+i)*5]),ink,3);}
 else if(style==='moth'){const cx=w/2,cy=h*.36;for(const s of [-1,1]){poly(c,[[cx,cy-10],[cx+s*w*.42,cy-h*.16],[cx+s*w*.38,cy+h*.04],[cx,cy+12]],hot);poly(c,[[cx,cy+8],[cx+s*w*.28,cy+h*.08],[cx+s*w*.16,cy+h*.2],[cx,cy+22]],ink);ring(c,cx+s*w*.22,cy-h*.06,w*.05,bg,4);}fill(c,bg,cx-5,cy-h*.12,10,h*.3);}
 else if(style==='stack'){for(let i=0;i<4;i++)text(c,title.split(' ')[i%title.split(' ').length]||'',w*.06,h*(.22+i*.14),h*.15,i%2?hot:ink,{sx:.62,family:SANS});ring(c,w*.72,h*.3,w*.22,ink,3);ring(c,w*.72,h*.3,w*.3,ink,1.5);dot(c,w*.72+w*.3,h*.3,6,hot);}
 else if(style==='xerox'){for(let i=0;i<28;i++){c.fillStyle=r()>.5?ink:'#3a3a3a';c.beginPath();c.ellipse(w*(.15+r()*.7),h*(.12+r()*.5),w*(.02+r()*.1),h*(.01+r()*.05),r()*3,0,7);c.fill();}dot(c,w*.5,h*.32,w*.18,hot);
  const letters=title.toUpperCase();let x=w*.06;for(const [i,ch] of [...letters].entries()){if(ch===' '){x+=w*.04;continue;}const s=h*(.06+r()*.03),dark=i%3===0;fill(c,dark?ink:'#f2efe6',x,h*.66-s,s*.9,s*1.15);text(c,ch,x+s*.45,h*.66-s*.1,s,dark?'#f2efe6':ink,{align:'center',family:i%2?SERIF:SANS});x+=s*.95;if(x>w*.9){x=w*.06;}}}
 else if(style==='woodcut'){for(let i=0;i<14;i++)path(c,Array.from({length:24},(_,k)=>[k*w/23,h*(.18+i*.03)+Math.abs(Math.sin(k*.5+i*.2))*-h*.08*(1-i/14)]),ink,2.2);poly(c,[[0,h*.62],[w*.35,h*.3],[w*.55,h*.48],[w*.75,h*.34],[w,h*.6],[w,h*.66],[0,h*.66]],ink);dot(c,w*.78,h*.16,w*.07,hot);}
 else if(style==='grid'){const n=4,cw=w*.84/n;for(let i=0;i<n*3;i++){const gx=w*.08+(i%n)*cw,gy=h*.1+Math.floor(i/n)*cw;if(r()>.45)fill(c,[ink,hot,'#d8d2c4'][i%3],gx+2,gy+2,cw-4,cw-4);else dot(c,gx+cw/2,gy+cw/2,cw*.4,i%2?hot:ink);}}
 else if(style==='film'){fill(c,'#141414',w*.08,h*.08,w*.84,h*.46);vgrad(c,w*.1,h*.1,w*.8,h*.42,'#4a6d82','#e2b07a');poly(c,[[w*.1,h*.52],[w*.4,h*.32],[w*.6,h*.45],[w*.9,h*.3],[w*.9,h*.52]],'#22303a');for(let i=0;i<8;i++){fill(c,'#f0eadc',w*(.1+i*.1),h*.085,w*.05,h*.012);fill(c,'#f0eadc',w*(.1+i*.1),h*.535,w*.05,h*.012);}}
 else if(style==='botanic'){for(let i=0;i<7;i++){const a=-1.2+i*.4;c.save();c.translate(w/2,h*.62);c.rotate(a);c.fillStyle=i%2?ink:hot;c.beginPath();c.ellipse(0,-h*.22,w*.07,h*.18,0,0,7);c.fill();c.restore();}path(c,[[w/2,h*.62],[w/2,h*.7]],ink,4);}
 else if(style==='lecture'){for(let i=0;i<6;i++)path(c,Array.from({length:40},(_,k)=>[w*.08+k*w*.84/39,h*(.2+i*.06)+Math.sin(k*.35+i*.9)*h*.03]),i%2?hot:ink,2.5);dot(c,w*.75,h*.16,w*.06,hot);}
 else if(style==='handmade'){fill(c,hot,w*.08,h*.08,w*.84,h*.38);for(let i=0;i<5;i++)path(c,[[w*(.15+i*.15),h*.42],[w*(.15+i*.15),h*(.18+r()*.12)]],ink,8);ring(c,w*.5,h*.27,w*.25,'#f4efe2',3);}
 const ty=style==='xerox'?h*.76:h*.74;
 if(style!=='stack'&&style!=='xerox')text(c,title,w*.07,ty,Math.min(h*.075,w*1.5/Math.max(6,title.length)),ink===bg?hot:style==='moth'||style==='film'?'#f2ead8':ink,{sx:.8,max:w*.86});
 lines.forEach((s,i)=>text(c,s,w*.07,ty+h*(.065+i*.05),h*.034,style==='moth'||style==='film'||style==='xerox'&&false?'#f2ead8':ink,{weight:i?'':'bold',max:w*.86}));
 speckle(c,w,h,Math.round(w*h/500),['#ffffff','#000000'],seed,1.4,.07);
}
function sticky(c,w,h,col,lines,seed){fill(c,col,0,0,w,h);vgrad(c,0,0,w,h*.18,'rgba(0,0,0,.06)','rgba(0,0,0,0)');lines.forEach((s,i)=>hand(c,s,w*.1,h*(.3+i*.24),h*.17,'#24303c',{seed:seed+i}));}

// ---------- stage designs ----------
const NAMES={primary:'Noa',preteen:'Noa',teen:'Noa',college:'Noa'};
export const CHILD_WALL_STAGES=['early','primary','preteen','teen','college'];

export function enhanceChildWalls({root,layout:l,helpers:h,materials:m,groups}){
 const stage=CHILD_WALL_STAGES.includes(l.ageStage)?l.ageStage:'early',early=earlyYearsProfile(l);
 const P=early?.palette||CHILD_PERSONALITY_PALETTES[stage],{material,mesh,markSceneAsset}=h,{rear,right,left}=groups;
 const W=l.width/2,back=l.back,front=back+l.depth,H=l.height,windowZ=back+1500,ww=1500,low=850,wh=1450;
 const own=t=>{(root.ownedTextures||=[]).push(t);return t;};
 const lock=a=>{a.userData.roomFinishLocked=true;return a;};

 // ---- retire the shared wall template (ids stay; objects hidden) ----
 // Round-1 review: every stage had the same accent rectangle, centred poster,
 // two framed prints and right-wall poster trio. Each stage now gets its own.
 const findId=id=>{let f=null;root.traverse(o=>{if(o.userData.propId===id)f=o;});return f;};
 const retired=[],hide=id=>{const o=findId(id);if(o&&o.visible!==false){o.visible=false;retired.push(id);}};
 for(const id of ['personality-bed-paint','personality-rear-gallery'])hide(id);
 if(stage==='early')hide('sleeping-arch');
 else for(const id of ['rainbow-print','forest-print','personality-right-gallery'])hide(id);
 if(stage==='teen'||stage==='college'){hide('personality-hooks');hide('growth-project-board-'+stage);}
 const bedPanelShown=findId('personality-bed-paint')?.visible!==false;

 // ---- where the walls are already busy (root-local millimetres) ----
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert();
 // The teen neon sign stands 20-40 mm off the wall on studs, so posters may
 // hang behind it (a sign over a poster wall); everything else is avoided.
 const SURFACE_IDS=new Set(['floor','play-rug','early-rear-mural','early-right-mural','personality-bed-paint','sleeping-arch']),SURFACES={has:id=>SURFACE_IDS.has(id)||/^light-neon-sign/.test(id)};
 const busy={rear:[],right:[],left:[]};
 const shown=o=>{for(let a=o;a&&a!==root;a=a.parent)if(a.visible===false)return false;return true;};
 root.traverse(o=>{
  const id=o.userData.propId;if(!id||SURFACES.has(id)||!shown(o))return;
  const b=new THREE.Box3().setFromObject(o);if(b.isEmpty())return;b.applyMatrix4(inv);const near=420;
  if(b.min.z<back+near)busy.rear.push({u0:b.min.x,u1:b.max.x,v0:b.min.y,v1:b.max.y,id});
  if(b.max.x>W-near)busy.right.push({u0:b.min.z,u1:b.max.z,v0:b.min.y,v1:b.max.y,id});
  if(b.min.x<-W+near)busy.left.push({u0:-b.max.z,u1:-b.min.z,v0:b.min.y,v1:b.max.y,id});
 });
 // Glazing and curtains (to their outer folds), then the pole band above.
 const curtainHalf=ww/2+270;busy.right.push({u0:windowZ-curtainHalf-15,u1:windowZ+curtainHalf+15,v0:0,v1:2340,id:'window'},{u0:windowZ-curtainHalf-90,u1:windowZ+curtainHalf+90,v0:2340,v1:H,id:'curtain-pole'},{u0:front-185,u1:front-75,v0:1020,v1:1140,id:'switch-plate'});
 const span={rear:[-W,W],right:[back,front],left:[-front,-back]};
 const free=(wall,r,pad=35)=>r.u0>=span[wall][0]+pad&&r.u1<=span[wall][1]-pad&&r.v0>=0&&r.v1<=H-25&&busy[wall].every(o=>r.u1+pad<=o.u0||r.u0-pad>=o.u1||r.v1+pad<=o.v0||r.v0-pad>=o.v1);
 // Slide a cluster along its wall from a preferred centre until it is clear.
 const fit=(wall,halfW,v0,v1,prefer,lo=span[wall][0],hi=span[wall][1])=>{
  for(let d=0;d<4000;d+=40)for(const s of d?[1,-1]:[1]){const u=prefer+s*d;if(u-halfW<lo||u+halfW>hi)continue;if(free(wall,{u0:u-halfW,u1:u+halfW,v0,v1}))return u;}
  return null;
 };
 const claim=(wall,u0,u1,v0,v1,id)=>busy[wall].push({u0,u1,v0,v1,id});
 // Try a cluster at decreasing widths; returns {u,w} for the widest that fits.
 const fitW=(wall,widths,v0,v1,prefer,lo,hi)=>{for(const w of widths){const u=fit(wall,w/2,v0,v1,typeof prefer==='function'?prefer(w):prefer,lo,hi);if(u!==null)return {u,w};}return null;};
 const lightLine=(xs,tries)=>{for(const [y0,sag,loops] of tries){const pts=[];for(let i=0;i<=60;i++){const t=i/60,x=xs[0]+t*(xs[1]-xs[0]),tt=(t*loops)%1;pts.push(new THREE.Vector3(x,y0-sag*4*tt*(1-tt),30));}
  if(pts.every(p=>free('rear',{u0:p.x-8,u1:p.x+8,v0:p.y-22,v1:p.y+12},4)))return pts;}return null;};
 // Paint/trim depth in front of the plaster, so papers sit on the top layer.
 const bedPanel=[l.bed[0]-650,l.bed[0]+650];
 const depthAt=(wall,u0,u1,v0,v1)=>{
  if(wall!=='rear')return v0<100?21:wall==='right'?2.4:1.6;
  let d=stage==='early'?6.6:1.6;if(v0<880)d=13.5;if(v0<902&&v1>878)d=29.5;if(v0<100)d=Math.max(d,21);if(v1>1010&&u1>bedPanel[0]&&u0<bedPanel[1]&&stage!=='early'&&bedPanelShown)d=Math.max(d,10.5);return d;
 };

 // ---- one atlas per room build ----
 const regions=[];const atlasReq=(wmm,hmm,draw,dens=1)=>{const r={wmm,hmm,draw,pw:Math.max(8,Math.round(wmm*dens)),ph:Math.max(8,Math.round(hmm*dens)),uv:[0,0,1,1]};regions.push(r);return r;};
 let atlasTexture=null;
 const packAtlas=()=>{
  if(!regions.length)return null;const S=2048,pad=6;let scale=1;
  for(let attempt=0;attempt<6;attempt++){
   let x=0,y=0,row=0,ok=true;const order=[...regions].sort((a,b)=>b.ph-a.ph);
   for(const r of order){const pw=Math.round(r.pw*scale),ph=Math.round(r.ph*scale);if(x+pw>S){x=0;y+=row+pad;row=0;}if(y+ph>S){ok=false;break;}r.px=[x,y,pw,ph];x+=pw+pad;row=Math.max(row,ph);}
   if(ok)break;scale*=.86;
  }
  const canvas=document.createElement('canvas');canvas.width=S;canvas.height=S;const c=canvas.getContext('2d');
  for(const r of regions){const [x,y,pw,ph]=r.px||[0,0,8,8];c.save();c.translate(x,y);c.beginPath();c.rect(0,0,pw,ph);c.clip();c.scale(pw/r.wmm,ph/r.hmm);r.draw(c,r.wmm,r.hmm);c.restore();r.uv=[x/S,1-(y+ph)/S,(x+pw)/S,1-y/S];}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.needsUpdate=true;return own(t);
 };

 // ---- merged geometry kit per cluster ----
 const clusters=[],tmpColor=new THREE.Color();
 const tint=(g,col)=>{tmpColor.set(col);const n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=tmpColor.r;a[i*3+1]=tmpColor.g;a[i*3+2]=tmpColor.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;};
 const xf=(g,x,y,z,rz=0,ry=0,rx=0)=>{g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz,'ZYX')),new THREE.Vector3(1,1,1)));return g;};
 const clean=g=>{let out=g;if(g.index){out=g.toNonIndexed();out.userData=g.userData;g.dispose();}for(const k of Object.keys(out.attributes))if(!['position','normal','uv','color'].includes(k))out.deleteAttribute(k);if(!out.attributes.uv)out.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(out.attributes.position.count*2),2));out.morphAttributes={};return out;};
 const ell=(a,b,c,ws=8,hs=6)=>new THREE.SphereGeometry(1,ws,hs).scale(a,b,c);
 function cluster(wall,id,name,u,v,{under=null}={}){
  const k={wall,id,name,u,v,paper:[],glows:[],marks:[],z:wall==='right'?.8:0};
  // A sheet may curl at one corner, bow slightly and be torn at a corner.
  k.sheet=(w,hh,region,{x=0,y=0,z=null,rot=0,curl=0,corner=1,bow=1.2,tear=0,shape=null}={})=>{
   const g=shape?new THREE.ShapeGeometry(shape,6):new THREE.PlaneGeometry(w,hh,6,6),p=g.attributes.position,t=g.attributes.uv;
   const cx=corner&1?w/2:-w/2,cy=corner&2?hh/2:-hh/2;
   for(let i=0;i<p.count;i++){let px=p.getX(i),py=p.getY(i);
    if(tear&&Math.abs(px+cx)<1e-3&&Math.abs(py+cy)<1e-3){px-=Math.sign(px)*tear*w*.5;py-=Math.sign(py)*tear*hh*.25;p.setX(i,px);p.setY(i,py);}
    let dz=bow*Math.max(0,1-(2*px/w)**2)*Math.max(0,1-(2*py/hh)**2);
    if(curl){const d=Math.hypot(px-cx,py-cy)/Math.min(w,hh),q=Math.max(0,1-d/.5);dz+=curl*q*q;}
    p.setZ(i,dz);t.setXY(i,px/w+.5,py/hh+.5);}
   g.computeVertexNormals();k.z+=1.6;g.userData.region=region;k.paper.push(xf(g,x,y,z??k.z,rot));return g;
  };
  k.solid=(g,col,x,y,z,rz=0,ry=0,rx=0)=>{k.solid.list.push(xf(tint(clean(g),col),x,y,z,rz,ry,rx));return g;};k.solid.list=[];
  k.glow=(channel,g,col,x,y,z,rz=0)=>{k.glows.push({channel,g:xf(tint(clean(g),col),x,y,z,rz)});return g;};
  k.mark=(w,hh,region,x,y,rot=0)=>{const g=new THREE.PlaneGeometry(w,hh);g.userData.region=region;k.marks.push(xf(g,x,y,k.z+.4,rot));};
  // Common hardware.
  k.tape=(x,y,z,w=48,hh=18,rot=0,col='#e4d3a6')=>k.solid(new THREE.BoxGeometry(w,hh,.8),col,x,y,z,rot);
  k.pin=(x,y,z,col='#c84a3c')=>{k.solid(new THREE.SphereGeometry(5.5,10,8),col,x,y,z+5);k.solid(new THREE.CylinderGeometry(.8,.8,6,5),'#b9bec2',x,y,z+3,0,0,Math.PI/2);};
  k.clip=(x,y,z,col='#c9a46b')=>k.solid(new THREE.BoxGeometry(11,34,7),col,x,y,z+3.5);
  clusters.push(k);return k;
 }
 const glowMats={};
 const glowMat=channel=>glowMats[channel]||=lock(material('#ffffff',{vertexColors:true,roughness:.6,metalness:0,emissive:channel==='phosphor'?'#bfe7a6':'#ffc77a',emissiveIntensity:0}));
 const fixtures=[];
 const finish=(atlas)=>{
  const paperMat=lock(material('#ffffff',{map:atlas,roughness:.93,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));
  const markMat=lock(material('#ffffff',{map:atlas,transparent:true,depthWrite:false,roughness:1,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  const solidMat=lock(material('#ffffff',{vertexColors:true,roughness:.72,metalness:0}));
  for(const k of clusters){
   if(!k.paper.length&&!k.solid.list.length&&!k.glows.length&&!k.marks.length&&!k.extra?.length)continue;
   const g=new THREE.Group();g.name=k.name;g.userData.propId=k.id;g.userData.sceneAssetName=k.name;g.userData.wallDecoration=true;g.userData.dropSurface=false;g.userData.childWallLife=stage;if(k.paint)g.userData.wallPaint=true;if(k.composite)g.userData.wallComposite=true;
   if(k.wall==='rear'){g.position.set(k.u,k.v,back);rear.add(g);}
   else if(k.wall==='right'){g.position.set(W,k.v,k.u);g.rotation.y=-Math.PI/2;right.add(g);}
   else{g.position.set(-W,k.v,-k.u);g.rotation.y=Math.PI/2;left.add(g);}
   if(k.depth)g.translateZ(k.depth);
   markSceneAsset(g,{key:`childroom:${l.id}:fixture:${k.id}`});
   const remapUV=geo=>{const r=geo.userData.region;if(!r)return geo;const t=geo.attributes.uv;for(let i=0;i<t.count;i++)t.setXY(i,r.uv[0]+t.getX(i)*(r.uv[2]-r.uv[0]),r.uv[1]+t.getY(i)*(r.uv[3]-r.uv[1]));return geo;};
   const add=(list,mat,shadow,name)=>{if(!list.length)return null;const parts=list.map(clean),geo=mergeGeometries(parts,false);parts.forEach(x=>x.dispose());const o=mesh(g,geo,mat);o.name=name;o.castShadow=shadow;o.receiveShadow=true;if(!shadow)o.userData.presentationOnly=true;return o;};
   add(k.paper.map(remapUV),paperMat,false,'Paper, prints and photographs');
   add(k.solid.list,solidMat,true,'Pins, tape, frames and hardware');
   add(k.marks.map(remapUV),markMat,false,'Wall marks');
   const byChannel={};for(const {channel,g:geo} of k.glows)(byChannel[channel]||=[]).push(geo);
   for(const e of k.extra||[]){const o=mesh(g,e.geo,e.mat,e.at||[0,0,0]);o.name=e.name;o.castShadow=false;o.receiveShadow=true;o.userData.presentationOnly=true;}
   for(const [ch,list] of Object.entries(byChannel)){const o=add(list,glowMat(ch),false,ch==='phosphor'?'Glow-in-the-dark stickers':'Warm fairy lights · emissive only');}
   fixtures.push(k.id);
  }
 };

 // ======== shared room-shell trim (all stages) ========
 // A real curtain pole with rings and finials: the curtains no longer hang
 // from nothing. Kept on the curtain plane, above the glazing.
 {
  const rodY=low+wh/2-30+(wh+170)/2+22,k=cluster('right','wall-'+stage+'-curtain-pole','Curtain pole, rings and finials',windowZ,rodY);
  const metal=['teen','college'].includes(stage)?'#2b2d2f':stage==='preteen'?'#9a8f84':'#b58f62';const len=ww+2*290+40;
  k.solid(new THREE.CylinderGeometry(12,12,len,14),metal,0,0,100,Math.PI/2);
  for(const s of [-1,1]){k.solid(new THREE.SphereGeometry(22,14,10),metal,s*(len/2+14),0,100);k.solid(new THREE.BoxGeometry(24,40,100),metal,s*(len/2-70),0,50);}
  for(const c of [-1,1])for(let i=0;i<6;i++)k.solid(new THREE.TorusGeometry(17,3.5,6,14),metal,c*(ww/2+140)+(i-2.5)*46,0,100,0,Math.PI/2);
 }
 // Matching skirting on the window wall (the rear and left walls have it).

 // ======== stage designs ========
 const name=NAMES[stage]||'';
 // Pencil height marks: ticks, ages and the odd note, drawn for a strip whose
 // bottom edge sits v0 mm above the floor.
 const marksArt=(maxAge,notes,v0)=>(c,w,hh)=>{fill(c,'#f3efe5',0,0,w,hh);vgrad(c,0,0,w,hh,'rgba(255,255,255,0)','rgba(120,100,70,.1)');
  for(let a=2;a<=maxAge;a++){const y=hh-(AGE_HEIGHT[a]-v0);c.strokeStyle=a===maxAge?'#2f4f8f':'#4d4a45';c.lineWidth=1.8;c.beginPath();c.moveTo(3,y);c.lineTo(w*.55+(a%2)*6,y);c.stroke();hand(c,(notes[a]||String(a)),w*.58,y-3,a>=13?10:11,a===maxAge?'#2f4f8f':'#3c3a37',{seed:a,family:HAND});}};
 const growthStrip=(maxAge,notes)=>{
  // Fallback when the room has no door: a pencil-marked door-frame offcut.
  const u=W-110,v0=110,v1=2000;if(!free('rear',{u0:u-40,u1:u+40,v0,v1}))return;
  const k=cluster('rear','wall-'+stage+'-height-marks','Pencil height marks on a saved door-frame offcut',u,(v0+v1)/2);claim('rear',u-40,u+40,v0,v1,k.id);
  const len=v1-v0,region=atlasReq(64,len,marksArt(maxAge,notes,v0),1.2);
  k.solid(new THREE.BoxGeometry(70,len,16),'#e9e3d5',0,0,depthAt('rear',u-35,u+35,v0,v1)+8);k.z=depthAt('rear',u-35,u+35,v0,v1)+16;k.sheet(64,len,region,{bow:0});
 };
 const sill=(items)=>{const k=cluster('right','wall-'+stage+'-window-sill','Things kept on the window sill',windowZ,low+23);k.depth=-48;items(k);};
 const clings=(items)=>{const k=cluster('right','wall-'+stage+'-window-stickers','Window stickers on the glass',windowZ,low+wh/2);k.z=-62;items(k);};
 // Skirting scuffs, wall marks and the switch plate belong to the materials
 // layer (child-material-detail.mjs); this layer does not duplicate them.

 // ---- The bedroom door: wall-attached decor (closed slab in a cased frame,
 // nothing on the floor), height marks on the hinge-side casing, a hall glow
 // under it. Same rule every stage, so one size keeps one door.
 const DW=860,DH=2040,CAS=80,doorHalf=DW/2+CAS+10;
 let door=null;
 const buildDoor=(maxAge,notes,dress)=>{
  // Clothes hooks are wall decor too: they shift along the wall to clear the door.
  const movable=['growth-chart','personality-hooks','personality-bag','personality-jumper'],keep=busy.right;busy.right=keep.filter(r=>!movable.includes(r.id));
  const u=fit('right',doorHalf,0,DH+CAS+20,front-1400-90-doorHalf,windowZ+curtainHalf+15,front);busy.right=keep;
  if(u===null){growthStrip(maxAge,notes);return null;}
  const hooks=findId('personality-hooks');if(hooks&&hooks.visible!==false){root.updateMatrixWorld(true);const hb=new THREE.Box3().setFromObject(hooks).applyMatrix4(inv);
   if(hb.max.z>u-doorHalf-35&&hb.min.z<u+doorHalf+35){const shift=u+doorHalf+40-hb.min.z;if(hb.max.z+shift<=front-40){hooks.position.z+=shift;busy.right=busy.right.filter(r=>!['personality-hooks','personality-bag','personality-jumper'].includes(r.id));busy.right.push({u0:hb.min.z+shift,u1:hb.max.z+shift,v0:hb.min.y,v1:hb.max.y,id:'personality-hooks'});root.userData.childWallLifeMovedHooks=shift;}}}
  // The toddler's linen growth chart gives way: the marks are on the frame now.
  const gc=findId('growth-chart');if(gc&&gc.visible!==false){const b=new THREE.Box3().setFromObject(gc).applyMatrix4(inv);if(b.max.z>u-doorHalf-35&&b.min.z<u+doorHalf+35){gc.visible=false;retired.push('growth-chart');}}
  claim('right',u-doorHalf,u+doorHalf,0,DH+CAS+20,'wall-'+stage+'-door');
  const k=cluster('right','wall-'+stage+'-door','Bedroom door, frame and pencil height marks',u,0);
  const slabCol={early:'#f4efe4',primary:'#f2ede2',preteen:'#ece6dc',teen:'#3a4a63',college:'#e9e3d6'}[stage],casing='#f6f2ea';
  k.solid(new THREE.BoxGeometry(DW+10,DH+6,2),'#2b2622',0,(DH+6)/2,4);
  k.solid(new THREE.BoxGeometry(DW-6,DH-10,30),slabCol,0,(DH-10)/2+8,6);
  for(const [y0,y1] of [[170,930],[1110,1880]])for(const [x,y,w,hh] of [[0,y1,DW-220,14],[0,y0,DW-220,14],[-(DW-220)/2,(y0+y1)/2,14,y1-y0],[(DW-220)/2,(y0+y1)/2,14,y1-y0]])k.solid(new THREE.BoxGeometry(w,hh,4),slabCol,x,y,22.5);
  for(const s of [-1,1]){k.solid(new THREE.BoxGeometry(CAS,DH+CAS,24),casing,s*(DW/2+CAS/2),(DH+CAS)/2,12);k.solid(new THREE.BoxGeometry(CAS+8,150,28),casing,s*(DW/2+CAS/2),75,14);}
  k.solid(new THREE.BoxGeometry(DW+2*CAS+24,CAS,26),casing,0,DH+CAS/2,13);
  const lx=DW/2-75;k.solid(new THREE.CylinderGeometry(28,28,8,18),'#b9b4aa',lx,1000,25,0,0,Math.PI/2);k.solid(new THREE.BoxGeometry(130,18,16),'#b9b4aa',lx-55,1000,40);k.solid(new THREE.BoxGeometry(18,40,6),'#8f8a80',lx,900,24);
  for(const y of [220,1020,1820])k.solid(new THREE.BoxGeometry(14,100,6),'#a9a49a',-DW/2+4,y,22);
  // Light from the hall leaks under the door (emissive only; lighting owns the wedge).
  k.glow('hall',new THREE.BoxGeometry(DW-14,7,2),'#ffe2b0',0,4,22);
  const len=1890,region=atlasReq(CAS-12,len,marksArt(maxAge,notes,110),1.2);k.z=24;k.sheet(CAS-12,len,region,{x:-(DW/2+CAS/2),y:110+len/2,z:24.4,bow:0});
  k.slabZ=21;dress?.(k);
  door={wall:'right',u,width:DW,height:DH,frame:DW+2*CAS,threshold:{x:W,z:u},glow:'under-door'};
  return door;
 };
 // A guitar on a wall hanger, placed where the wide camera can see it.
 const guitar=(owner,wall,prefer,lo,hi)=>{const u=fit(wall,165,950,2170,prefer,lo,hi);if(u===null)return;const k=cluster(wall,'wall-'+owner+'-guitar','Acoustic guitar on a wall hanger',u,1460);claim(wall,u-165,u+165,950,2170,k.id);
  const base=wall==='rear'?depthAt('rear',0,0,950,2170):0;
  const body=new THREE.Shape();body.moveTo(0,-330);body.bezierCurveTo(200,-330,200,-60,110,-20);body.bezierCurveTo(160,60,150,200,0,200);body.bezierCurveTo(-150,200,-160,60,-110,-20);body.bezierCurveTo(-200,-60,-200,-330,0,-330);
  const geo=new THREE.ExtrudeGeometry(body,{depth:90,bevelEnabled:true,bevelThickness:6,bevelSize:6,bevelSegments:2,curveSegments:16}).scale(.85,1,1);k.solid(geo,owner==='college'?'#b88a52':'#c4955a',0,-170,base+22);
  k.solid(new THREE.CylinderGeometry(40,40,2,24),'#1d1410',0,-130,base+125,0,0,Math.PI/2);k.solid(new THREE.BoxGeometry(110,24,4),'#3b2a1f',0,-310,base+121);
  k.solid(new THREE.BoxGeometry(56,560,26),'#5b3b26',0,270,base+105);k.solid(new THREE.BoxGeometry(80,170,22),'#2a1d15',0,600,base+102);
  for(let i=0;i<6;i++)k.solid(new THREE.BoxGeometry(1.2,890,1.2),'#d8d4cc',(i-2.5)*8,150,base+124);for(let i=0;i<6;i++)k.solid(new THREE.CylinderGeometry(5,5,22,8),'#c7c9cc',(i%2?1:-1)*48,560+Math.floor(i/2)*46,base+102,0,0,Math.PI/2);
  k.solid(new THREE.BoxGeometry(70,30,60),'#3a3a3a',0,505,base+30);for(const s of [-1,1])k.solid(new THREE.CylinderGeometry(5,5,90,8),'#3a3a3a',s*26,510,base+75,0,0,Math.PI/2);
  if(owner==='college'){k.solid(new THREE.CircleGeometry(30,18),'#e2584c',70,-250,base+124);k.solid(new THREE.BoxGeometry(70,34,1),'#f0d34a',-60,-60,base+124,.3);}
 };
 let hero=null;
 // Door dressing helpers (on the slab face, local to the door cluster).
 const doorSign=(k,region,w,hh,y,rot=0,tape='#e4d3a6')=>{k.z=k.slabZ;k.sheet(w,hh,region,{x:-40,y,z:k.slabZ+4.4,rot,bow:1});k.tape(-40-w*.3,y+hh/2-6,k.slabZ+6.4,44,16,-.3,tape);k.tape(-40+w*.3,y+hh/2-6,k.slabZ+6.4,44,16,.3,tape);};
 const overDoorHook=(k)=>{k.solid(new THREE.BoxGeometry(60,60,4),'#8f8a80',120,DH-6,k.slabZ+2);k.solid(new THREE.BoxGeometry(60,4,40),'#8f8a80',120,DH+24,8);k.solid(new THREE.CylinderGeometry(5,5,40,8),'#8f8a80',120,DH-40,k.slabZ+20,0,0,Math.PI/2);};

 if(stage==='early'){
  // ---- EARLY: the tree-and-moon mural is the sleeping wall (early-years-wall-life);
  // here: a scribble zone of a dozen-plus drawings at a toddler's height ----
  const designs=[0,1,2,3,4,5,6,7].map(i=>atlasReq(280,340,(c,w,hh)=>drawChildCrayon(c,w,hh,P,i),1.1));
  const big=[2,5].map(i=>atlasReq(300,420,(c,w,hh)=>drawChildCrayon(c,w,hh,P,i+8),1));
  const scrib=atlasReq(320,200,(c,w,hh)=>{c.clearRect(0,0,w,hh);c.globalAlpha=.4;c.strokeStyle=P.accent;c.lineWidth=6;c.lineCap='round';c.beginPath();for(let t=0;t<26;t+=.2)c.lineTo(w*.36+Math.cos(t)*(22+t*2.6),hh*.55+Math.sin(t)*(15+t*1.8));c.stroke();c.globalAlpha=.28;c.strokeStyle=P.second;c.lineWidth=7;c.beginPath();c.moveTo(w*.66,hh*.8);c.quadraticCurveTo(w*.8,hh*.2,w*.96,hh*.42);c.stroke();c.globalAlpha=.18;c.fillStyle='#ffffff';c.beginPath();c.ellipse(w*.4,hh*.55,w*.3,hh*.32,0,0,7);c.fill();},.8);
  const start=l.bed[0]+960,stop=Math.min(W-240,start+1900);
  const got=fitW('rear',[1900,1600,1300,1000],120,1010,w=>start+w/2,start-40,stop+40);
  if(got){const {u,w:span}=got,k=cluster('rear','wall-early-low-drawings','The scribble zone: drawings taped up at my height',u,560);claim('rear',u-span/2,u+span/2,120,1010,k.id);
   const r=rng(5),n=Math.round(span/130);let z=0;
   for(let i=0;i<n;i++){const t=(i+.5)/n,isBig=i===3||i===Math.floor(n*.7),row=isBig?0:i%2,w=isBig?300:[250,230,260,240,220][i%5],hh=isBig?420:[300,280,320,290,270][i%5];
    const x=-span/2+t*span+(r()-.5)*40,y=(isBig?40:row?-150:150)+(r()-.5)*50,rot=(r()-.5)*.22+(i===n-1?.38:0),v0=560+y-hh/2,v1=560+y+hh/2;
    z+=.9;k.z=depthAt('rear',0,0,v0,v1)+z;k.sheet(w,hh,isBig?big[i%2]:designs[i%8],{x,y,z:k.z,rot,curl:i%4===1?22:0,corner:i%2?1:2,bow:2});
    const tz=k.z+2.2;k.tape(x-w*.28,y+hh/2-6,tz,46,17,-.2+rot);if(i!==n-1)k.tape(x+w*.28,y+hh/2-6,tz,46,17,.18+rot);if(isBig)k.tape(x,y-hh/2+8,tz,46,17,.1);}
   k.z=13.5;k.mark(320,200,scrib,span/2-420,-360,-.1);
  }
  const coatAndCrown=(k,cx,cy,z)=>{
   const coat=new THREE.Shape();coat.moveTo(-40,0);coat.lineTo(40,0);coat.lineTo(95,-90);coat.lineTo(80,-110);coat.lineTo(60,-80);coat.lineTo(70,-400);coat.lineTo(-70,-400);coat.lineTo(-60,-80);coat.lineTo(-80,-110);coat.lineTo(-95,-90);coat.closePath();
   k.solid(new THREE.CylinderGeometry(9,12,60,10),'#b08a5e',cx,cy,z+30,0,0,Math.PI/2);k.solid(new THREE.ExtrudeGeometry(coat,{depth:36,bevelEnabled:true,bevelThickness:6,bevelSize:6,bevelSegments:2}),'#e8b93b',cx,cy-8,z+6);k.solid(ell(52,46,26,12,8),'#e8b93b',cx,cy-20,z+40);
   for(let i=0;i<4;i++)k.solid(new THREE.CylinderGeometry(7,7,4,10),'#f6f0dc',cx,cy-150-i*60,z+50,0,0,Math.PI/2);
   const crown=new THREE.Shape();crown.moveTo(-70,0);crown.lineTo(70,0);crown.lineTo(70,70);crown.lineTo(42,35);crown.lineTo(20,80);crown.lineTo(0,40);crown.lineTo(-20,80);crown.lineTo(-42,35);crown.lineTo(-70,70);crown.closePath();
   k.solid(new THREE.CylinderGeometry(9,12,60,10),'#b08a5e',cx+200,cy,z+30,0,0,Math.PI/2);k.solid(new THREE.ExtrudeGeometry(crown,{depth:8,bevelEnabled:false}),'#d8a531',cx+200,cy-120,z+30,.12);for(const [x,col] of [[-30,'#c84a3c'],[0,'#3c78c8'],[30,'#3ca86b']])k.solid(new THREE.SphereGeometry(8,8,6),col,cx+200+x,cy-100+x*.12,z+40);
   k.solid(new THREE.CylinderGeometry(1.2,1.2,60,4),'#d8d0c0',cx+200,cy-30,z+34);};
  const letters=['N','O','A'].map((ch,i)=>atlasReq(150,150,(c,w,hh)=>{fill(c,['#e8b4a0','#a9cbc4','#f0d48a'][i],0,0,w,hh);text(c,ch,w/2,hh*.74,110,P.ink,{align:'center',family:SERIF});},1));
  buildDoor(4,{2:'2',3:'3',4:'4 '+'Noa'},k=>{
   // Painted name letters, and the raincoat and crown on pegs at toddler height.
   const disc=()=>{const s=new THREE.Shape();s.absarc(0,0,75,0,Math.PI*2,false);return s;};
   letters.forEach((r,i)=>{k.z=k.slabZ;k.sheet(150,150,r,{x:-200+i*170,y:1620+(i%2)*30,z:k.slabZ+4.6,rot:(i-1)*.12,shape:disc(),bow:0});});
   coatAndCrown(k,-170,1080,k.slabZ);});
  if(!door){const u=fit('right',170,700,1260,back+240,back,windowZ);if(u!==null){const k=cluster('right','wall-early-peg-rail','Low peg rail · raincoat and dress-up crown',u,1180);claim('right',u-170,u+170,700,1260,k.id);k.solid(new THREE.BoxGeometry(330,60,18),'#c9aa7d',0,0,9);coatAndCrown(k,-100,0,0);}}
  hero={wall:'rear',u0:-W,u1:Math.min(W,l.bed[0]+1700),v0:930,v1:H-40,kind:'tree-and-moon mural'};
  sill(k=>{
   // Cress egg-head, a pine cone, a pebble line-up and a small dinosaur.
   k.solid(new THREE.SphereGeometry(28,14,10),'#f1e9da',-260,40,32);k.solid(new THREE.CylinderGeometry(20,24,30,12),P.accent,-260,15,32);
   for(let i=0;i<9;i++)k.solid(new THREE.ConeGeometry(4,32,4),'#7fae5a',-268+(i%3)*8,72+(i%2)*6,24+Math.floor(i/3)*8,(i-4)*.12);
   k.solid(new THREE.SphereGeometry(4,6,4),'#3c3c3c',-270,44,58);k.solid(new THREE.SphereGeometry(4,6,4),'#3c3c3c',-251,44,58);
   for(let i=0;i<5;i++)k.solid(new THREE.SphereGeometry(13+i%3*4,9,6).scale(1,.6,1),['#9a958c','#c7bfb1','#7d8a8f','#b9a48c','#d6d0c4'][i],-90+i*40,8,30);
   k.solid(new THREE.ConeGeometry(24,58,8),'#7a5534',150,30,30);
   const dino=[[0,30,0,26,17,15],[38,48,0,14,12,10],[50,60,0,11,9,9],[-34,26,0,18,8,8]];for(const [x,y,z,a,b,c] of dino)k.solid(ell(a,b,c,10,8),P.second,280+x,y,30+z);
   for(const x of [-12,14])k.solid(new THREE.CylinderGeometry(7,7,22,6),P.second,280+x,11,30);
  });
  clings(k=>{const shapes=[[-560,-430,'#f2b84b'],[-430,-520,'#e47f6a'],[-480,-330,'#7cc0c6'],[430,-470,'#b48ad1'],[540,-380,'#f2b84b']];
   for(const [x,y,col] of shapes){const st=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,rr=i%2?20:44;i?st.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):st.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}k.solid(new THREE.ShapeGeometry(st),col,x,y,-62,x*.002);}
   const fish=new THREE.Shape();fish.moveTo(-50,0);fish.quadraticCurveTo(0,40,40,0);fish.quadraticCurveTo(0,-40,-50,0);fish.moveTo(40,0);fish.lineTo(70,24);fish.lineTo(70,-24);fish.lineTo(40,0);k.solid(new THREE.ShapeGeometry(fish),'#f08a5d',-120,-500,-62);
  });
 }

 if(stage==='primary'){
  // ---- ELEMENTARY: a crowded school-year pinboard, glow-in-the-dark planets ----
  const ink=P.ink,cert=atlasReq(230,165,(c,w,hh)=>{sheetBg(c,w,hh,'#fbf6e6',{age:.03});c.strokeStyle=P.feature;c.lineWidth=5;c.strokeRect(7,7,w-14,hh-14);c.strokeStyle=P.second;c.lineWidth=1.4;c.strokeRect(14,14,w-28,hh-28);text(c,'STAR READER',w/2,48,24,ink,{align:'center',family:SERIF});text(c,'awarded to',w/2,70,11,ink,{align:'center',weight:''});hand(c,name,w/2,98,24,'#1d3f8f',{align:'center',seed:5});text(c,'for reading 40 books this year!',w/2,122,10,ink,{align:'center',weight:''});dot(c,w-44,hh-38,19,'#d8a531');ring(c,w-44,hh-38,14,'#f6dc8a',2);scribble(c,26,hh-28,60,'#333',7);});
  const classPhoto=atlasReq(210,150,(c,w,hh)=>{fill(c,'#f4f1ea',0,0,w,hh);vgrad(c,10,10,w-20,hh-38,'#a8c2cf','#d8cdb3');const r=rng(9);for(let row=0;row<3;row++)for(let i=0;i<8;i++){const x=24+i*23+(row%2)*8,y=34+row*26;dot(c,x,y,6.5,['#e7c3a0','#9c6b4e','#d9a97f','#7a5038'][Math.floor(r()*4)]);fill(c,['#c45a4a','#2e4f6b','#3d6b5a','#d8a531','#6b4f8a'][Math.floor(r()*5)],x-8,y+6,16,14);}text(c,'CLASS 3B · MAPLE SCHOOL',w/2,hh-12,10,'#333',{align:'center'});});
  const rocket=atlasReq(180,240,(c,w,hh)=>{sheetBg(c,w,hh,'#fffdf6',{age:.02});const q=(pts,col)=>poly(c,pts,col);q([[90,30],[120,90],[120,170],[60,170],[60,90]],'#e5e1d6');path(c,[[90,30],[120,90],[120,170],[60,170],[60,90],[90,30]],'#2a2a2a',2.5);dot(c,90,105,15,'#7cc0e0');ring(c,90,105,15,'#2a2a2a',2);q([[60,140],[38,182],[60,170]],'#d9493a');q([[120,140],[142,182],[120,170]],'#d9493a');q([[70,172],[90,226],[110,172]],'#f2a93b');for(let i=0;i<9;i++)dot(c,20+i*18,20+(i%3)*14,2.2,'#e0b83a');hand(c,'TO MARS!',90,22,16,'#2a2a2a',{align:'center',seed:4});});
  const spelling=atlasReq(170,220,(c,w,hh)=>{sheetBg(c,w,hh,'#ffffff',{rule:13,margin:true,age:.03});hand(c,'Spelling  wk 12',30,22,13,'#223',{seed:2});['planet','orbit','comet','gravity','crater','rocket','galaxy','meteor'].forEach((s,i)=>{hand(c,(i+1)+'. '+s,28,48+i*20,12,'#1d3f8f',{seed:20+i});path(c,[[132,40+i*20],[137,46+i*20],[148,34+i*20]],'#d23',2);});hand(c,'10/10 ★',100,212,16,'#d23',{seed:3});});
  const timetable=atlasReq(260,150,(c,w,hh)=>{sheetBg(c,w,hh,'#fffef8',{age:.02});text(c,'MY WEEK',10,20,13,ink);const days=['MON','TUE','WED','THU','FRI'],acts=['swim','library','art club','soccer','pizza!'];days.forEach((d,i)=>{const x=10+i*49;fill(c,[P.second,P.feature,P.accent,P.second,P.feature][i],x,28,46,22);text(c,d,x+23,44,11,'#fff',{align:'center'});hand(c,acts[i],x+23,78,11,'#223',{align:'center',seed:i});dot(c,x+23,108,9,i===2?'#e0b83a':'#dcd6c8');});hand(c,'library book due THURS',12,140,11,'#c33',{seed:8});});
  const tooth=atlasReq(120,90,(c,w,hh)=>{sheetBg(c,w,hh,'#fdf1f4',{age:.02});hand(c,'Dear Tooth',10,22,12,'#333',{seed:31});hand(c,'Fairy, #4!!',14,42,12,'#333',{seed:32});c.fillStyle='#fff';c.beginPath();c.moveTo(60,55);c.quadraticCurveTo(80,50,82,62);c.lineTo(76,84);c.lineTo(70,70);c.lineTo(64,84);c.lineTo(58,62);c.fill();path(c,[[60,55],[82,58],[76,84],[70,70],[64,84],[58,62],[60,55]],'#777',1.2);});
  const libcard=atlasReq(120,75,(c,w,hh)=>{fill(c,P.second,0,0,w,hh);fill(c,'#fff',8,30,w-16,32);text(c,'CITY LIBRARY',10,20,11,'#fff');for(let i=0;i<22;i++)fill(c,'#222',14+i*4.2,40,i%3?1.6:2.6,16);});
  const chore=atlasReq(300,420,(c,w,hh)=>{sheetBg(c,w,hh,'#fffaf0',{age:.03});text(c,'JOBS CHART',w/2,34,24,ink,{align:'center'});const jobs=['make bed','feed Pepper','pack bag','reading 20 min','tidy LEGO'],days='MTWTFSS';[...days].forEach((d,i)=>text(c,d,112+i*26,62,13,ink,{align:'center'}));
   jobs.forEach((j,r)=>{hand(c,j,10,92+r*58,13,'#223',{seed:r});for(let i=0;i<7;i++){c.strokeStyle='rgba(0,0,0,.2)';c.lineWidth=1;c.strokeRect(100+i*26,72+r*58,24,30);if((r*7+i)%5!==3&&i<5){const col=['#e0b83a','#d9493a','#4a8dd0','#59a35a'][(r+i)%4];c.save();c.translate(112+i*26,87+r*58);c.rotate((r+i)*.4);poly(c,Array.from({length:10},(_,n)=>{const a=-Math.PI/2+n*Math.PI/5,rr=n%2?4.5:10;return [Math.cos(a)*rr,Math.sin(a)*rr];}),col);c.restore();}}});
   hand(c,'5 stars = park on Saturday!',w/2,hh-18,13,'#c33',{align:'center',seed:44});});
  const map=atlasReq(560,380,(c,w,hh)=>{fill(c,'#bfdbe3',0,0,w,hh);const r=rng(12);const blob=(cx,cy,sx,sy)=>{c.fillStyle='#e8dcae';c.beginPath();for(let a=0;a<6.3;a+=.25){const rr=1+.25*Math.sin(a*3+r()*2);c.lineTo(cx+Math.cos(a)*sx*rr,cy+Math.sin(a)*sy*rr);}c.fill();};
   blob(110,110,70,55);blob(140,250,45,80);blob(290,100,55,45);blob(300,230,50,85);blob(420,130,95,65);blob(470,290,45,30);text(c,'OUR PLANET',w/2,32,26,'#1f4e66',{align:'center'});for(let x=0;x<w;x+=40)fill(c,'rgba(31,78,102,.18)',x,0,.8,hh);for(let y=0;y<hh;y+=40)fill(c,'rgba(31,78,102,.18)',0,y,w,.8);
   hand(c,'we went here!',120,300,14,'#c33',{seed:6});hand(c,'grandma',430,330,14,'#c33',{seed:7});});
  const pennant=atlasReq(560,190,(c,w,hh)=>{fill(c,P.second,0,0,w,hh);fill(c,P.feature,0,0,46,hh);text(c,'HARBOR OTTERS',70,hh*.62,46,'#f7f1e1',{sx:.85});});
  const cork=atlasReq(860,600,(c,w,hh)=>{fill(c,'#c79d6c',0,0,w,hh);speckle(c,w,hh,9000,['#8a6440','#e3c597','#6f4f31','#b88a58'],77,2.4,.55);},.7);
  // The door: a KEEP OUT sign with its small print, and race-day medals on a hook.
  const keepOut=atlasReq(300,210,(c,w,hh)=>{sheetBg(c,w,hh,'#fff8e8',{age:.03});c.strokeStyle='#d9493a';c.lineWidth=7;c.strokeRect(8,8,w-16,hh-16);hand(c,'KEEP OUT',w/2,82,46,'#d9493a',{align:'center',seed:3,weight:'bold'});hand(c,'(except Pepper',w/2,128,22,'#223',{align:'center',seed:4});hand(c,'and Mum with snacks)',w/2,158,22,'#223',{align:'center',seed:5});for(let i=0;i<4;i++)dot(c,30+i*80,190,6,['#f2b84b','#3c78c8','#3ca86b','#e47f6a'][i]);},1.1);
  buildDoor(9,{4:'4',6:'6 · lost tooth!',8:'8',9:'9 '+name},k=>{doorSign(k,keepOut,300,210,1580,-.04);
   const z=k.slabZ;k.solid(new THREE.BoxGeometry(40,50,10),'#7a5534',-40,1330,z+5);k.solid(new THREE.CylinderGeometry(4,4,40,8),'#b9bec2',-40,1322,z+26,0,0,Math.PI/2);
   [['#d9493a','#d8a531'],['#2f6fb4','#c0c4c8'],['#3ca86b','#b8773a']].forEach(([rib,med],i)=>{const x=(i-1)*34;k.solid(new THREE.BoxGeometry(18,230,1.5),rib,-40+x*.6,1330-125-i*12,z+42+i*2.5,x*.0016);k.solid(new THREE.CylinderGeometry(26,26,4,20),med,-40+x*.9,1330-250-i*12,z+43+i*2.5,0,0,Math.PI/2);});
   for(const [x,y,col,r] of [[180,1900,'#f2b84b',30],[230,1240,'#7cc0c6',22],[-260,700,'#e47f6a',26]])k.solid(new THREE.CircleGeometry(r,16),col,x,y,z+4.6);});
  // ---- The bed wall: one loud obsession. A hand-painted space mural over the
  // bed, with plastic glow stickers on it and spilling out towards the desk:
  // bright sticker colours by day, phosphor green at night. ----
  let spill=null;
  {const mL=-W+40,mR=Math.max(mL+1300,Math.min(l.bed[0]+1350,W-700)),mB=960,mT=H-70,MW=mR-mL,MH=mT-mB;
   const cw=2048,ch=Math.round(2048*MH/MW),canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;const c=canvas.getContext('2d');
   c.save();c.scale(cw/MW,ch/MH);const r=rng(31);
   // Painted edge: a rounded panel whose border wobbles like a brush stroke.
   c.beginPath();const steps=160;for(let i=0;i<=steps;i++){const t=i/steps,per=2*(MW+MH),d=t*per;let x,y;if(d<MW){x=d;y=0;}else if(d<MW+MH){x=MW;y=d-MW;}else if(d<2*MW+MH){x=MW-(d-MW-MH);y=MH;}else{x=0;y=MH-(d-2*MW-MH);}
    const k=14+Math.sin(i*1.7)*9;x=Math.min(MW-k,Math.max(k,x));y=Math.min(MH-k,Math.max(k,y));i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.save();c.clip();
   vgrad(c,0,0,MW,MH,'#16234a','#2d4f78');
   for(let i=0;i<9;i++){c.globalAlpha=.14;c.fillStyle=['#7a5aa8','#3d8f9a','#b0567a'][i%3];c.beginPath();c.ellipse(r()*MW,r()*MH,180+r()*260,90+r()*140,r()*3,0,7);c.fill();}c.globalAlpha=1;
   for(let i=0;i<260;i++){c.fillStyle=i%5?'#f4f1df':'#ffe39a';const s=1.5+r()*3.5;c.fillRect(r()*MW,r()*MH,s,s);}
   // Sun breaking in at the top-left corner.
   c.fillStyle='#f6b13d';c.beginPath();c.arc(40,40,260,0,7);c.fill();c.fillStyle='#ffd468';c.beginPath();c.arc(40,40,190,0,7);c.fill();
   for(let i=0;i<10;i++){const a=.08+i*.16;path(c,[[40+Math.cos(a)*290,40+Math.sin(a)*290],[40+Math.cos(a)*370,40+Math.sin(a)*370]],'#f6b13d',18);}
   const planet=(x,y,rad,cols,ringed)=>{if(ringed){c.strokeStyle='#e9d28a';c.lineWidth=rad*.22;c.beginPath();c.ellipse(x,y,rad*1.9,rad*.5,-.3,Math.PI,2*Math.PI);c.stroke();}
    dot(c,x,y,rad,cols[0]);c.save();c.beginPath();c.arc(x,y,rad,0,7);c.clip();for(let i=1;i<cols.length;i++){c.fillStyle=cols[i];c.fillRect(x-rad,y-rad+i*rad*.42,rad*2,rad*.2);}c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.arc(x+rad*.35,y+rad*.25,rad,0,7);c.fill();c.restore();
    if(ringed){c.strokeStyle='#e9d28a';c.lineWidth=rad*.22;c.beginPath();c.ellipse(x,y,rad*1.9,rad*.5,-.3,0,Math.PI);c.stroke();}};
   planet(MW*.72,MH*.24,150,['#dcb15a','#c7953f','#e8c77a'],true);
   planet(MW*.3,MH*.6,120,['#3f84c4','#5aa65a','#3f84c4']);dot(c,MW*.3+170,MH*.6-120,34,'#c9c6bd');
   planet(MW*.86,MH*.68,80,['#c4613f','#a84a2e']);planet(MW*.55,MH*.5,58,['#b48ad1','#9a6fb8']);
   // Rocket on a looping dotted trail, and a tethered astronaut.
   const trail=[];for(let i=0;i<=40;i++){const t=i/40;trail.push([MW*(.06+t*.62),MH*(.92-t*.62)+Math.sin(t*6)*60]);}
   c.setLineDash?.([18,22]);path(c,trail,'#f4f1df',7);c.setLineDash?.([]);
   const [rx,ry]=trail[40];c.save();c.translate(rx,ry);c.rotate(-.6);poly(c,[[0,-120],[42,-40],[42,90],[-42,90],[-42,-40]],'#f2efe6');poly(c,[[0,-120],[42,-40],[-42,-40]],'#d9493a');poly(c,[[-42,40],[-80,110],[-42,90]],'#d9493a');poly(c,[[42,40],[80,110],[42,90]],'#d9493a');dot(c,0,0,22,'#7cc0e0');ring(c,0,0,22,'#3a3a3a',5);poly(c,[[-26,90],[0,170],[26,90]],'#f6b13d');c.restore();
   hand(c,'TO MARS!',MW*.12,MH*.86,64,'#ffd468',{seed:7,weight:'bold',rot:-.2});
   const ax=MW*.46,ay=MH*.2;path(c,[[ax,ay+60],[ax+120,ay+180],[rx-40,ry+40]],'#e4e0d4',4);c.save();c.translate(ax,ay);c.rotate(.3);fill(c,'#f2efe6',-46,0,92,120);dot(c,0,-20,52,'#f2efe6');dot(c,0,-20,36,'#e0a63b');fill(c,'#f2efe6',-80,10,34,90);fill(c,'#f2efe6',46,10,34,90);fill(c,'#f2efe6',-40,120,30,80);fill(c,'#f2efe6',10,120,30,80);c.restore();
   // A hand-lettered constellation, the way a parent would help paint it.
   const cons=[[.12,.22],[.18,.16],[.25,.19],[.31,.13],[.37,.17],[.36,.27],[.29,.29]].map(([x,y])=>[MW*x,MH*y+MH*.06]);path(c,cons,'rgba(244,241,223,.6)',3);cons.forEach(([x,y])=>dot(c,x,y,9,'#fff4c8'));hand(c,'the big dipper',MW*.14,MH*.4,30,'#f4f1df',{seed:9});
   c.restore();c.restore();
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;own(map);
   const k=cluster('rear','wall-primary-space-mural','Hand-painted space mural with glow stickers',(mL+mR)/2,(mB+mT)/2);k.paint=true;
   k.extra=[{geo:new THREE.PlaneGeometry(MW,MH),mat:lock(material('#ffffff',{map,roughness:.92,metalness:0,alphaTest:.5})),at:[0,0,1.4],name:'Painted space mural'}];
   hero={wall:'rear',u0:mL,u1:mR,v0:mB,v1:mT,kind:'space mural'};claim('rear',mL,mR,mB,mT,'wall-primary-space-mural');
   // Stickers: on the mural and trailing off it towards the desk.
   const cols=['#f6e04a','#8be36b','#ff8fb8','#7fd6ff','#ffb84a'],st=rng(12);let n=0;
   const star=(rr)=>{const s=new THREE.Shape();for(let j=0;j<10;j++){const a=Math.PI/2+j*Math.PI/5,q=j%2?rr*.45:rr;j?s.lineTo(Math.cos(a)*q,Math.sin(a)*q):s.moveTo(Math.cos(a)*q,Math.sin(a)*q);}s.closePath();return s;};
   for(let i=0;i<30;i++){const x=mL+80+st()*(MW-160),y=mB+80+st()*(MH-160),rr=14+st()*22;k.glow('phosphor',new THREE.ShapeGeometry(star(rr)),cols[i%5],x-(mL+mR)/2,y-(mB+mT)/2,4.5+(i%3)*.3,st());n++;}
   spill=()=>{const k2=cluster('rear','wall-primary-glow-stickers','Glow stickers trailing off the mural',mR,0);for(let i=0;i<16;i++){const x=mR+40+st()*Math.min(1500,W-mR-300),y=2050+st()*(H-2200),rr=14+st()*22;if(x>W-200||!free('rear',{u0:x-rr,u1:x+rr,v0:y-rr,v1:y+rr},6))continue;k2.glow('phosphor',new THREE.ShapeGeometry(star(rr)),cols[i%5],x-mR,y,3.4,st());}};
   const moon=new THREE.Shape();moon.absarc(0,0,70,Math.PI*.35,Math.PI*1.65,false);moon.absarc(28,0,56,Math.PI*1.55,Math.PI*.45,true);k.glow('phosphor',new THREE.ShapeGeometry(moon,24),'#f6e04a',MW*.38,MH*.32,3.6,.4);
   k.glow('phosphor',new THREE.CircleGeometry(48,24),'#8be36b',-MW*.25,MH*.3,3.6);k.glow('phosphor',new THREE.RingGeometry(60,74,30).scale(1,.38,1),'#ff8fb8',-MW*.25,MH*.3,3.8,.3);
  }
  // Cork pinboard over the homework desk, crowded the way a school year is.
  const bh=600,bv=1640,pin=fitW('rear',[920,780,640],bv-bh/2-20,bv+bh/2+60,w=>l.desk[0]-60,-W+400,W-200),bw=pin?pin.w-60:860,bu=pin?.u??null;
  if(pin){const k=cluster('rear','wall-primary-pinboard','School-year pinboard over the homework desk',bu,bv);claim('rear',bu-bw/2-30,bu+bw/2+30,bv-bh/2-20,bv+bh/2+60,k.id);
   const d=depthAt('rear',0,0,bv-bh/2,bv+bh/2),f=bw/860;for(const [x,y,w,hh] of [[0,bh/2+14,bw+56,28],[0,-bh/2-14,bw+56,28],[-bw/2-14,0,28,bh],[bw/2+14,0,28,bh]])k.solid(new THREE.BoxGeometry(w,hh,24),'#b08a5e',x,y,d+12);
   k.z=d+10;k.sheet(bw,bh,cork,{bow:0});k.z=d+11;
   const items=[[cert,230,165,-270,140,-.03],[classPhoto,210,150,-30,170,.04],[rocket,180,240,250,120,-.06,22],[spelling,170,220,-320,-110,.05],[timetable,260,150,-40,-60,-.02],[tooth,120,90,175,-130,.09],[libcard,120,75,320,-150,-.12]];
   items.forEach(([r,w,hh,x,y,rot,curl=0],i)=>{k.sheet(w,hh,r,{x:x*f,y,rot,curl,corner:3,bow:1.5});k.pin(x*f,y+hh/2-14,k.z,['#c84a3c','#3c78c8','#e0b83a','#3ca86b'][i%4]);});
   // A science-fair rosette hanging from a pin.
   const rx=360*f;k.solid(new THREE.CylinderGeometry(42,42,6,20),'#2f6fb4',rx,90,k.z+5,0,0,Math.PI/2);k.solid(new THREE.CylinderGeometry(26,26,8,16),'#f1e2b0',rx,90,k.z+9,0,0,Math.PI/2);for(const s of [-1,1])k.solid(new THREE.BoxGeometry(28,90,2),'#2f6fb4',rx+s*16,22,k.z+3,s*.18);
  }
  // Chore chart at child height, beside the pinboard if the wall allows.
  {const u=fit('rear',170,1040,1500,(bu??l.desk[0])-bw/2-260,-W+200,W-200);if(u!==null){const k=cluster('rear','wall-primary-jobs-chart','Jobs chart with star stickers',u,1270);claim('rear',u-170,u+170,1040,1500,k.id);k.z=depthAt('rear',0,0,1040,1500);k.sheet(300,420,chore,{rot:-.02,curl:12,corner:1});k.tape(-100,206,k.z+2);k.tape(100,206,k.z+2,48,18,.15);}}
  // World map with pins, and the team pennant high on the window wall.
  {const u=fit('right',300,1200,1620,door?door.u+doorHalf+340:windowZ+curtainHalf+400);if(u!==null){const k=cluster('right','wall-primary-world-map','World map with family-trip pins',u,1410);claim('right',u-300,u+300,1200,1620,k.id);k.sheet(560,380,map,{curl:18,corner:2,bow:2});for(const [x,y,col] of [[-160,40,'#c84a3c'],[-60,-80,'#c84a3c'],[150,-120,'#3c78c8'],[120,60,'#e0b83a']])k.pin(x,y,k.z,col);k.tape(-250,185,k.z+2);k.tape(250,185,k.z+2,48,18,.2);}}
  {const u=fit('right',300,2280,2560,door?door.u+doorHalf+340:windowZ+curtainHalf+500);if(u!==null){const k=cluster('right','wall-primary-team-pennant','Harbor Otters team pennant',u,2420);claim('right',u-300,u+300,2280,2560,k.id);const sh=new THREE.Shape();sh.moveTo(-280,95);sh.lineTo(280,8);sh.lineTo(-280,-95);sh.closePath();k.sheet(560,190,pennant,{shape:sh,rot:-.04,bow:3});k.solid(new THREE.CylinderGeometry(5,5,210,8),'#7a5534',-284,0,4);}}
  spill?.();
  // A planets fact poster above the bed on the side wall (seen in film angles).
  {const facts=atlasReq(420,600,(c,w,hh)=>{fill(c,'#1d2c55',0,0,w,hh);text(c,'OUR SOLAR SYSTEM',w/2,48,30,'#ffd468',{align:'center'});['Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune'].forEach((s,i)=>{const y=100+i*60;dot(c,60,y,8+[2,5,5,4,18,15,10,10][i],['#b5b0a5','#e3c27a','#3f84c4','#c4613f','#d9a86a','#dcb15a','#9fd6dc','#4f6fd0'][i]);text(c,s,120,y+8,22,'#f4f1df',{weight:''});});hand(c,'Pluto is still a planet to me',30,hh-24,18,'#ffd468',{seed:2});},1);
   const u=fit('left',230,1150,1800,-l.bed[1]);if(u!==null){const k=cluster('left','wall-primary-planets-poster','Solar-system poster above the bed',u,1470);claim('left',u-230,u+230,1150,1800,k.id);k.sheet(420,600,facts,{rot:.02,curl:16,corner:1});k.tape(-150,292,k.z+1);k.tape(150,292,k.z+1,48,18,.2);}}
  sill(k=>{k.solid(new THREE.CylinderGeometry(30,24,70,14),'#f4f1ea',-200,35,30);k.solid(new THREE.CylinderGeometry(28,28,4,12),'#6b4a32',-200,68,30);for(let i=0;i<3;i++){k.solid(new THREE.CylinderGeometry(1.8,1.8,60+i*14,5),'#7fae5a',-205+i*6,98+i*7,30,(i-1)*.15);k.solid(new THREE.SphereGeometry(9,8,6),'#8cc265',-205+i*8-(i-1)*6,128+i*14,30);}
   for(let i=0;i<6;i++)k.solid(new THREE.SphereGeometry(12+(i%3)*5,8,6),['#a49d91','#7d8a8f','#c9b79d','#5f6b70','#d8cfc0','#8c7a66'][i],10+i*36,9,26+(i%2)*14);
   k.solid(new THREE.CylinderGeometry(14,14,80,10),'#e8e3d8',260,40,30);k.solid(new THREE.ConeGeometry(14,34,10),'#d9493a',260,97,30);for(const s of [-1,1])k.solid(new THREE.BoxGeometry(4,30,24),'#d9493a',260+s*16,12,30);});
  clings(k=>{for(const [x,y,col,r] of [[-520,-420,'#f2b84b',40],[-430,-500,'#7cc0c6',26],[500,-450,'#e47f6a',34]]){const st=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;i?st.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):st.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}k.solid(new THREE.ShapeGeometry(st),col,x,y,-62);}
   const dino=new THREE.Shape();dino.moveTo(-90,-40);dino.quadraticCurveTo(-40,10,0,0);dino.quadraticCurveTo(30,60,70,70);dino.lineTo(80,50);dino.quadraticCurveTo(40,40,40,-10);dino.lineTo(30,-40);dino.lineTo(15,-40);dino.lineTo(10,-20);dino.lineTo(-20,-20);dino.lineTo(-25,-40);dino.lineTo(-40,-40);dino.lineTo(-45,-25);dino.closePath();k.solid(new THREE.ShapeGeometry(dino),'#6fbf73',-150,-460,-62);});
 }

 if(stage==='preteen'){
  // ---- PRETEEN: a painted arch over the bed, a big photo wall, the door's signs ----
  const kinds=['beach','friends','dog','mountain','cake','forest','lake','friends','city','beach','dog','concert','mountain'];
  const caps=['summer!!','us <3','Pepper','camp','12!!','hike','lake day','best friends','trip','','good boy','first gig?!','we made it'];
  const photos=kinds.map((kind,i)=>atlasReq(88,106,(c,w,hh)=>polaroid(c,w,hh,kind,40+i,caps[i]),2.2));
  const sketches=[0,1,2,3].map(i=>atlasReq(210,280,(c,w,hh)=>{sheetBg(c,w,hh,'#f5f0e3',{age:.04,seed:60+i});const r=rng(70+i);const g='rgba(40,40,45,';
   if(i===0){c.strokeStyle=g+'.75)';c.lineWidth=1.6;c.beginPath();c.ellipse(w/2,hh*.45,70,36,0,0,7);c.stroke();dot(c,w/2,hh*.45,26,'rgba(60,70,80,.55)');dot(c,w/2,hh*.45,11,'#222');dot(c,w/2+8,hh*.42,4,'#fff');for(let k=0;k<26;k++){const a=Math.PI*(1.1+k*.03);path(c,[[w/2+Math.cos(a)*70,hh*.45+Math.sin(a)*36],[w/2+Math.cos(a)*84,hh*.45+Math.sin(a)*48]],g+'.6)',1);}hand(c,'eye study #7',20,hh-20,12,'#444',{seed:i});}
   else if(i===1){c.strokeStyle=g+'.7)';c.lineWidth=1.5;c.beginPath();c.moveTo(60,hh*.85);c.quadraticCurveTo(50,hh*.5,80,hh*.42);c.lineTo(88,hh*.18);c.quadraticCurveTo(98,hh*.12,104,hh*.2);c.lineTo(102,hh*.38);c.lineTo(115,hh*.12);c.quadraticCurveTo(125,hh*.08,128,hh*.16);c.lineTo(124,hh*.4);c.lineTo(140,hh*.2);c.quadraticCurveTo(150,hh*.17,151,hh*.26);c.lineTo(145,hh*.5);c.quadraticCurveTo(165,hh*.42,172,hh*.48);c.quadraticCurveTo(150,hh*.62,140,hh*.85);c.stroke();for(let k=0;k<40;k++)path(c,[[70+r()*60,hh*(.55+r()*.25)],[80+r()*60,hh*(.5+r()*.25)]],g+'.18)',1);hand(c,'hands are HARD',20,hh-18,12,'#444',{seed:i});}
   else if(i===2){c.strokeStyle=g+'.7)';c.lineWidth=1.6;c.beginPath();c.ellipse(w/2,hh*.55,60,48,0,0,7);c.stroke();c.beginPath();c.moveTo(w/2-50,hh*.42);c.lineTo(w/2-40,hh*.28);c.lineTo(w/2-22,hh*.38);c.moveTo(w/2+50,hh*.42);c.lineTo(w/2+40,hh*.28);c.lineTo(w/2+22,hh*.38);c.stroke();for(const s of [-1,1]){dot(c,w/2+s*20,hh*.52,5,'#333');for(let k=0;k<3;k++)path(c,[[w/2+s*30,hh*.6+k*4],[w/2+s*70,hh*.57+k*7]],g+'.5)',1);}path(c,[[w/2-6,hh*.6],[w/2,hh*.63],[w/2+6,hh*.6]],g+'.7)',1.4);hand(c,'Pepper (asleep)',20,hh-18,12,'#444',{seed:i});}
   else{for(let k=0;k<9;k++)path(c,[[w*.5,hh*.38],[k*w/8,hh]],g+'.25)',1);fill(c,'rgba(40,40,45,.08)',30,hh*.5,50,hh*.3);c.strokeStyle=g+'.7)';c.lineWidth=1.4;for(const [x,y,ww2,hh2] of [[30,hh*.5,50,hh*.3],[w-80,hh*.46,50,hh*.36]])c.strokeRect(x,y,ww2,hh2);hand(c,'my street, 1pt persp.',18,hh-18,12,'#444',{seed:i});}
  },1.1));
  const zine=atlasReq(150,210,(c,w,hh)=>{fill(c,'#f0d34a',0,0,w,hh);for(let i=0;i<5;i++)dot(c,30+i*25,60+(i%2)*30,18,i%2?'#e2584c':'#2b2b2b');text(c,'FOUND',12,150,32,'#2b2b2b',{sx:.8});text(c,'zine #2',12,175,14,'#2b2b2b',{weight:''});});
  const tix=atlasReq(160,70,(c,w,hh)=>{fill(c,'#e8d9b8',0,0,w,hh);c.setLineDash?.([3,3]);path(c,[[118,0],[118,hh]],'#7a6a50',1);c.setLineDash?.([]);text(c,'ADMIT ONE',10,24,13,'#7a3b2c');text(c,'Aquarium · SAT 10:30',10,46,10,'#555',{weight:''});text(c,'No 0472',124,40,10,'#7a3b2c',{rot:-Math.PI/2});});
  const filmPoster=atlasReq(380,560,(c,w,hh)=>poster(c,w,hh,{bg:'#283a4d',ink:'#f1e6cf',hot:'#e3a26b',style:'film',title:'THE LIGHTHOUSE YEAR',lines:['a film about a summer, and a dog','IN CINEMAS · rated PG'],seed:5}));
  // ---- The bed wall: a floor-to-ceiling painted arch (clay over denim, with
  // an ochre sun) behind the bed; lighting's fairy swag hangs across it. ----
  const AW=1500,ac=Math.max(-W+30+AW/2,l.bed[0]+60),aTop=Math.min(H-120,2450),aR=AW/2,aSpring=aTop-aR;
  {const k=cluster('rear','wall-preteen-painted-arch','Hand-painted arch behind the bed',ac,0);k.paint=true;
   const archShape=(cx,half,y0,top,inset=0)=>{const s=new THREE.Shape(),r=half-inset,spring=top-half;s.moveTo(cx-r,y0);s.lineTo(cx+r,y0);s.lineTo(cx+r,spring);s.absarc(cx,spring,r,0,Math.PI,false);s.lineTo(cx-r,y0);s.closePath();return s;};
   const bands=(cx,half,top,col,zUp,zDado)=>{const up=archShape(cx,half,903,top),low=new THREE.Shape();low.moveTo(cx-half,102);low.lineTo(cx+half,102);low.lineTo(cx+half,878);low.lineTo(cx-half,878);low.closePath();
    k.solid(new THREE.ShapeGeometry(up,32),col,0,0,zUp);k.solid(new THREE.ShapeGeometry(low),col,0,0,zDado);k.solid(new THREE.BoxGeometry(half*2,22,1.4),col,cx,891,28.9);};
   bands(620,450,Math.min(aTop-480,1950),'#466a87',1.6,13.6);
   k.solid(new THREE.CircleGeometry(240,40),'#e0a85c',560,Math.min(aTop-180,2260),2.4);
   bands(0,aR,aTop,'#c88770',3.2,15.2);
   const line=new THREE.Shape(),ri=aR-70,ro=aR-46;line.moveTo(-ro,903);line.lineTo(-ro,aSpring);line.absarc(0,aSpring,ro,Math.PI,0,true);line.lineTo(ro,903);line.lineTo(ri,903);line.lineTo(ri,aSpring);line.absarc(0,aSpring,ri,0,Math.PI,false);line.lineTo(-ri,903);line.closePath();
   k.solid(new THREE.ShapeGeometry(line,32),'#f1e3cf',0,0,3.9);
   claim('rear',ac-aR,ac+1070,100,aTop,k.id);hero={wall:'rear',u0:ac-aR,u1:ac+1070,v0:100,v1:aTop,kind:'painted arch'};}
  // A photo wall three times the old size, washi-taped beside the arch.
  const big=kinds.slice(0,12).map((kind,i)=>atlasReq(160,195,(c,w,hh)=>polaroid(c,w,hh,kind,40+i,caps[i]),1.6));
  {const got=fitW('rear',[800,620],1400,2260,w=>ac+1070+60+w/2,-W+200,W-200);if(got){const {u,w:gw}=got,cols=gw>700?4:3,k=cluster('rear','wall-preteen-photo-wall','Photo wall, washi-taped',u,1830);claim('rear',u-gw/2,u+gw/2,1400,2260,k.id);
   const r=rng(17),base=depthAt('rear',0,0,1400,2260);let pi=0;
   for(let row=0;row<3;row++)for(let col=0;col<cols;col++){const x=(col-(cols-1)/2)*190+(r()-.5)*24,y=(1-row)*225+(r()-.5)*20,rot=(r()-.5)*.18;k.z=base+pi*.3;
    k.sheet(160,195,big[pi%big.length],{x,y,z:k.z,rot,curl:pi%5===3?14:0,corner:pi%2?1:3,bow:1.4});k.tape(x+Math.sin(rot)*-90,y+88,k.z+1.4,60,18,rot+(r()-.5)*.5,['#e8a0b4','#86c5c0','#f0cf6a','#b6a6dc'][pi%4]);pi++;}
   k.z=base+pi*.3+.5;k.sheet(160,70,tix,{x:gw/2-60,y:-370,rot:.14});k.tape(gw/2-60,-338,k.z+1.2,30,13,.1,'#86c5c0');}}
  // The door: KNOCK FIRST, and the photo-booth strips moved out of the corner.
  const knock=atlasReq(280,200,(c,w,hh)=>{fill(c,'#f7e9ef',0,0,w,hh);hand(c,'KNOCK',w/2,78,52,'#c4577a',{align:'center',seed:11,weight:'bold'});hand(c,'FIRST!!',w/2,140,46,'#3f6b7f',{align:'center',seed:12,weight:'bold'});for(let i=0;i<6;i++)dot(c,24+i*46,182,7,['#e8a0b4','#86c5c0','#f0cf6a'][i%3]);},1.1);
  const strip=atlasReq(60,190,(c,w,hh)=>{fill(c,'#fbfaf6',0,0,w,hh);['friends','friends','friends','cake'].forEach((k2,i)=>scene(c,5,5+i*45,w-10,40,k2,90+i));},2.4);
  buildDoor(12,{6:'6',9:'9',11:'11 (shoes on!)',12:'12 '+name},k=>{doorSign(k,knock,280,200,1600,.05,'#86c5c0');
   [-140,-70,0].forEach((x,i)=>{k.z=k.slabZ;k.sheet(60,190,strip,{x:x+120,y:1220+(i-1)*14,z:k.slabZ+4.5+i*.2,rot:(i-1)*.08,bow:1});k.tape(x+120,1312+(i-1)*14,k.slabZ+6.4,30,14,(i-1)*.3,'#e8a0b4');});
   for(const [x,y,col] of [[200,1900,'#e8a0b4'],[-260,1150,'#f0cf6a'],[180,700,'#86c5c0']]){const heart=new THREE.Shape();heart.moveTo(0,-26);heart.bezierCurveTo(-40,0,-26,30,0,13);heart.bezierCurveTo(26,30,40,0,0,-26);k.solid(new THREE.ShapeGeometry(heart),col,x,y,k.slabZ+4.6);}});
  // A cork vision board above the bed on the side wall (film angles).
  {const corkB=atlasReq(600,450,(c,w,hh)=>{fill(c,'#c79d6c',0,0,w,hh);speckle(c,w,hh,4000,['#8a6440','#e3c597','#6f4f31'],5,2.4,.55);},.7);
   const u=fit('left',330,1150,1680,-l.bed[1]);if(u!==null){const k=cluster('left','wall-preteen-vision-board','Cork vision board: photos, tickets, a pressed flower',u,1415);claim('left',u-330,u+330,1150,1680,k.id);
    k.solid(new THREE.BoxGeometry(640,490,20),'#c9b08a',0,0,10);k.z=20;k.sheet(600,450,corkB,{bow:0});k.z=21;
    [[photos[3],-200,90,-.08],[photos[7],-60,110,.05],[tix,140,140,.1],[photos[1],180,-60,-.06],[sketches[2],-160,-90,.04],[zine,40,-80,-.1]].forEach(([r,x,y,rot],i)=>{const w=r===tix?160:r===zine?150:r===sketches[2]?150:88,hh=r===tix?70:r===zine?210:r===sketches[2]?200:106;k.sheet(w,hh,r,{x,y,rot,curl:i===4?12:0,bow:1});k.pin(x,y+hh/2-12,k.z,['#c84a3c','#3c78c8','#e0b83a'][i%3]);});}}
  // Sketch cluster and the film poster on the window wall, past the door.
  {const u=fit('right',330,1460,2100,door?door.u+doorHalf+370:windowZ+curtainHalf+380);if(u!==null){const k=cluster('right','wall-preteen-sketches','Sketches and a zine, washi-taped',u,1780);claim('right',u-330,u+330,1460,2100,k.id);
   const set=[[sketches[0],-180,140,-.05,0],[sketches[1],40,170,.04,18],[sketches[2],230,90,-.03,0],[sketches[3],-120,-150,.06,0],[zine,120,-160,-.08,10],[tix,-250,-260,.12,0]];
   set.forEach(([r,x,y,rot,curl],i)=>{const w=r===zine?150:r===tix?160:210,hh=r===zine?210:r===tix?70:280;k.sheet(w,hh,r,{x,y,rot,curl,corner:i%2?1:2});k.tape(x-w*.3,y+hh/2-8,k.z+1,52,16,-.35,['#e8a0b4','#86c5c0','#f0cf6a'][i%3]);k.tape(x+w*.3,y+hh/2-8,k.z+1,52,16,.3,['#86c5c0','#f0cf6a','#e8a0b4'][i%3]);});}}
  {const u=fit('right',200,1880,2480,door?door.u+doorHalf+240:windowZ+curtainHalf+300);if(u!==null){const k=cluster('right','wall-preteen-film-poster','Poster from a favourite film',u,2180);claim('right',u-200,u+200,1880,2480,k.id);k.sheet(380,560,filmPoster,{rot:.02,curl:20,corner:3});for(const [x,y] of [[-170,262],[170,262],[-170,-262]])k.tape(x,y,k.z+1,46,18,x*.002);}}
  sill(k=>{k.solid(new THREE.CylinderGeometry(34,28,52,14),'#d9c7b0',-210,26,30);for(let i=0;i<7;i++){const a=i*.9;k.solid(ell(9,16,7),'#7fa38a',-210+Math.cos(a)*12,62+(i%3)*6,30+Math.sin(a)*12,0,a);}
   k.solid(new THREE.SphereGeometry(36,16,12),'#cfe6ee',40,70,30);k.solid(new THREE.CylinderGeometry(34,38,30,14),'#5a4a3e',40,15,30);k.solid(new THREE.ConeGeometry(14,30,8),'#e8e8e8',40,62,30);
   k.solid(new THREE.BoxGeometry(110,18,60),'#a85d4a',230,9,30);k.solid(new THREE.BoxGeometry(104,16,56),'#3f6b7f',230,26,30,.1);});
  clings(k=>{const heart=new THREE.Shape();heart.moveTo(0,-40);heart.bezierCurveTo(-60,0,-40,45,0,20);heart.bezierCurveTo(40,45,60,0,0,-40);k.solid(new THREE.ShapeGeometry(heart),'#e8a0b4',470,-430,-62,.2);
   const prism=new THREE.Shape();prism.moveTo(0,40);prism.lineTo(34,-20);prism.lineTo(-34,-20);prism.closePath();k.solid(new THREE.ShapeGeometry(prism),'#cfe8f2',-480,-150,-62);k.solid(new THREE.CylinderGeometry(.7,.7,825,4),'#dddddd',-480,302,-61);});
 }

 if(stage==='teen'){
  // ---- HIGH SCHOOL: gig posters wall to wall, the door, records and the guitar ----
  const posters=[
   {bg:'#e9dcc3',ink:'#293e5b',hot:'#da9a68',style:'sun',title:'LOW TIDE STATIC',lines:['w/ Paper Lanterns','THE COPPER ROOM · FRI 14 MAR · 7PM'],seed:1},
   {bg:'#293e5b',ink:'#c77960',hot:'#da9a68',style:'moth',title:'MOTH & MERIDIAN',lines:['new record OUT NOW','Elm St Hall · all ages'],seed:2},
   {bg:'#c77960',ink:'#293e5b',hot:'#f1e6cf',style:'stack',title:'SATURDAY SATELLITES',lines:['spring tour','RIVERSIDE ARTS 05.04'],seed:3},
   {bg:'#f2efe6',ink:'#151515',hot:'#e2584c',style:'xerox',title:'NORTHBOUND',lines:['ALL AGES SHOW $8','basement of the old mill'],seed:4},
   {bg:'#dcb35c',ink:'#2b2b2b',hot:'#c77960',style:'woodcut',title:'the quiet hours',lines:['acoustic night','Harbor Library steps · free'],seed:5},
   {bg:'#7389ac',ink:'#f2ead8',hot:'#da9a68',style:'handmade',title:'SOUND / FORM',lines:['battle of the bands!!','school gym · thurs 6pm · come pls'],seed:6}
  ].map((s,i)=>atlasReq([380,330,360,300,340,320][i],[540,470,520,430,500,450][i],(c,w,hh)=>poster(c,w,hh,s),1.15));
  const setlist=atlasReq(150,220,(c,w,hh)=>{sheetBg(c,w,hh,'#fbfbf7',{rule:16,age:.05});hand(c,'SET',16,26,18,'#111',{seed:1,weight:'bold'});['1. Static','2. Paper Boats','3. Northbound','4. (new one)','5. Harbor','6. Slow Fade'].forEach((s,i)=>hand(c,s,14,56+i*26,14,'#1a1a1a',{seed:i+3}));});
  const ticket=[0,1].map(i=>atlasReq(170,66,(c,w,hh)=>{fill(c,i?'#c9dfe8':'#f0d9a8',0,0,w,hh);text(c,i?'MOTH & MERIDIAN':'LOW TIDE STATIC',10,24,13,'#2a2a2a');text(c,i?'ELM ST HALL · GA':'THE COPPER ROOM · GA',10,44,10,'#444',{weight:''});text(c,'$12.00',10,60,10,'#444',{weight:''});path(c,[[130,0],[130,hh]],'rgba(0,0,0,.3)',1);},1.6));
  const exams=atlasReq(300,200,(c,w,hh)=>{sheetBg(c,w,hh,'#ffffff',{grid:10,age:.03});text(c,'EXAMS',12,24,16,'#c33');[['MON 2','Chem'],['WED 4','English lit.'],['FRI 6','Maths P1'],['TUE 10','History'],['THU 12','Maths P2 !!']].forEach(([d,s],i)=>{hand(c,d,14,52+i*28,13,'#223',{seed:i});hand(c,s,100,52+i*28,13,'#223',{seed:i+9});});path(c,[[96,40],[200,48]],'#c33',2);});
  const notes=[['#f6e27a',['revise ch 4','ask Mr K']],['#9ad0e6',['band pr. sat','11am!']],['#f4a7b9',['return amp','to Leo']],['#b9e3a1',['drink','water :)']]].map(([col,lines],i)=>atlasReq(76,76,(c,w,hh)=>sticky(c,w,hh,col,lines,i*7),2));
  const sleeves=[0,1,2].map(i=>atlasReq(310,310,(c,w,hh)=>{const r=rng(120+i);if(i===0){fill(c,'#1d2530',0,0,w,hh);for(let k=0;k<12;k++)ring(c,w/2,hh/2,10+k*12,k%2?'#da9a68':'#7389ac',3);text(c,'NORTHBOUND',16,hh-18,22,'#f2ead8',{sx:.85});}
   else if(i===1){vgrad(c,0,0,w,hh,'#f1c27d','#c45f4a');dot(c,w*.5,hh*.42,70,'#f6e3b8');fill(c,'#2a2230',0,hh*.62,w,hh*.38);text(c,'low tide static',16,hh-18,22,'#f6e3b8',{weight:'',family:SERIF});}
   else{fill(c,'#e9e4d8',0,0,w,hh);for(let k=0;k<30;k++)fill(c,['#293e5b','#c77960','#dcb35c'][k%3],r()*w,r()*hh,10+r()*60,4+r()*12);text(c,'THE QUIET HOURS',16,hh-18,18,'#293e5b');}},1));
  const pennant=atlasReq(600,190,(c,w,hh)=>{fill(c,'#293e5b',0,0,w,hh);fill(c,'#c77960',0,0,50,hh);text(c,'NORTH RIDGE XC',74,hh*.62,46,'#f2ead8',{sx:.82});});
  // (No string lights here: the lighting layer gives this age an LED cove and a neon over the bed.)
  // The door: DO NOT DISTURB, band stickers, and a hoodie on an over-door hook.
  const dnd=atlasReq(110,260,(c,w,hh)=>{fill(c,'#151515',0,0,w,hh);c.fillStyle='#f2efe6';c.beginPath();c.arc(w/2,40,24,0,7);c.fill();text(c,'DO NOT',w/2,130,22,'#e2584c',{align:'center'});text(c,'DISTURB',w/2,160,20,'#e2584c',{align:'center'});hand(c,'(practising)',w/2,210,15,'#f2efe6',{align:'center',seed:4});},1.2);
  buildDoor(16,{9:'9',12:'12',14:'14 growth spurt!!',15:'15',16:'16 '+name},k=>{const z=k.slabZ,lx=DW/2-75;
   k.sheet(110,260,dnd,{x:lx-55,y:1000-150,z:z+26,rot:.05,bow:0});
   for(const [x,y,col,rr] of [[-220,1500,'#e2584c',44],[-60,1640,'#f0d34a',30],[150,1450,'#7389ac',38],[-180,900,'#151515',34]])k.solid(new THREE.CircleGeometry(rr,20),col,x,y,z+4.6);
   k.solid(new THREE.BoxGeometry(150,60,1),'#f2efe6',60,1260,z+4.6,.12);
   overDoorHook(k);k.solid(new THREE.BoxGeometry(380,460,60),'#4d5d4a',120,1760,z+40,0,0,.04);for(const s of [-1,1])k.solid(new THREE.BoxGeometry(110,420,50),'#4d5d4a',120+s*230,1740,z+38,s*.12);k.solid(ell(120,90,40),'#4d5d4a',120,2010,z+44);});
  // Exam timetable and sticky notes at seated eye height, beside the desk (not behind the monitor).
  {const u=fit('rear',260,1000,1290,l.desk[0]-(l.desktopSize==='60x30'?762:610)-300,-W+300,W-140);if(u!==null){const k=cluster('rear','wall-teen-exam-notes','Exam timetable and sticky notes',u,1140);claim('rear',u-260,u+260,1000,1290,k.id);k.z=depthAt('rear',0,0,1000,1290);k.sheet(300,200,exams,{x:-90,rot:-.02});k.tape(-90,96,k.z+1,60,18,.05,'#d5d5cf');notes.forEach((r,i)=>{k.z=depthAt('rear',0,0,1000,1290)+2;k.sheet(76,76,r,{x:110+(i%2)*88,y:(i<2?50:-40),rot:(i-1.5)*.08,curl:i===2?10:3,corner:2,bow:.6});});}}
  // ---- The bed wall and beyond: posters wall to wall, overlapping, at angles,
  // over the bed and the desk alike (the neon sign hangs over them). ----
  const more=[
   {bg:'#151515',ink:'#f2ead8',hot:'#e2584c',style:'grid',title:'VELVET STATIC',lines:['+ special guests','THE COPPER ROOM · SAT'],seed:21},
   {bg:'#f0d34a',ink:'#151515',hot:'#293e5b',style:'stack',title:'LATE TRAINS',lines:['free show','skate park, 4pm'],seed:22},
   {bg:'#e8a0b4',ink:'#293e5b',hot:'#f2ead8',style:'sun',title:'SOFT GEOMETRY',lines:['album release','Elm St Hall'],seed:23},
   {bg:'#3c5b3f',ink:'#f2ead8',hot:'#dcb35c',style:'woodcut',title:'HOLLOW PINES',lines:['summer tour','RIVERSIDE ARTS'],seed:24},
   {bg:'#2b2230',ink:'#da9a68',hot:'#7389ac',style:'moth',title:'THE NIGHT BUS',lines:['last stop tour','all ages'],seed:25},
   {bg:'#f2efe6',ink:'#293e5b',hot:'#c77960',style:'xerox',title:'KITE STRINGS',lines:['DIY SHOW $5','the old mill'],seed:26},
   {bg:'#c4613f',ink:'#f2ead8',hot:'#151515',style:'lecture',title:'RIVERSIDE SOUND FEST',lines:['3 stages · 24 bands','tickets at the gate'],seed:27},
   {bg:'#7389ac',ink:'#151515',hot:'#f0d34a',style:'handmade',title:'OPEN MIC',lines:['every thurs','the bean café'],seed:28}
  ].map((s,i)=>atlasReq([340,300,360,320,340,300,380,280][i],[480,430,500,450,480,420,540,400][i],(c,w,hh)=>poster(c,w,hh,s),.85));
  const sizes=[[380,540],[330,470],[360,520],[300,430],[340,500],[320,450]],moreSizes=[[340,480],[300,430],[360,500],[320,450],[340,480],[300,420],[380,540],[280,400]];
  const pool=[...posters.map((r,i)=>[r,...sizes[i]]),...more.map((r,i)=>[r,...moreSizes[i]])];
  const smalls=[[sleeves[0],300,300],[sleeves[1],300,300],[sleeves[2],300,300],[setlist,150,220],[ticket[0],170,66],[ticket[1],170,66]];
  const posterBand=(wall,x0,x1,v0,v1,id,label,seed)=>{const r=rng(seed),k=cluster(wall,id,label,0,0);k.composite=true;let x=x0,n=0,z=wall==='rear'?depthAt('rear',0,0,v0,v1):1.6;
   const put=([reg,w,hh],cx,cy,rot,extra={})=>{const rect={u0:cx-w/2,u1:cx+w/2,v0:cy-hh/2,v1:cy+hh/2};if(rect.v0<v0-20||rect.v1>v1+10||!free(wall,rect,4))return false;z+=1.25;k.z=z;
    k.sheet(w,hh,reg,{x:cx,y:cy,z,rot,curl:n%5===2?20:n%7===3?12:0,corner:n%2?1:3,tear:n%9===4?.25:0,bow:1.8,...extra});
    if(n%3===0){k.pin(cx-w*.42,cy+hh/2-14,z);k.pin(cx+w*.42,cy+hh/2-14,z,'#e0b83a');}else{k.tape(cx-w*.38,cy+hh/2-6,z+1,50,18,-.4+rot);k.tape(cx+w*.38,cy+hh/2-6,z+1,50,18,.35+rot);}n++;return true;};
   let pi=Math.floor(r()*pool.length);
   while(x<x1-120){const it=pool[pi++%pool.length],w=it[1];const cx=x+w/2-20;
    put(it,cx,v1-it[2]/2-10-r()*70,(r()-.5)*.12);const it2=pool[(pi+5)%pool.length];put(it2,cx+(r()-.5)*90,v0+it2[2]/2+r()*90,(r()-.5)*.12);x+=w*(.78+r()*.18);}
   // A middle layer fills the band so it reads wall to wall, overlapping both rows.
   for(let i=0;i<Math.round((x1-x0)/300);i++){const it=pool[(pi+i*3)%pool.length];put(it,x0+it[1]/2+r()*(x1-x0-it[1]),(v0+v1)/2+(r()-.5)*(v1-v0-it[2])*.6,(r()-.5)*.14);}
   for(let i=0;i<Math.round((x1-x0)/420);i++){const it=smalls[i%smalls.length];put(it,x0+120+r()*(x1-x0-240),v0+120+r()*(v1-v0-240),(r()-.5)*.3);}
   if(!n)clusters.splice(clusters.indexOf(k),1);else claim(wall,x0,x1,v0,v1,id);return n;};
  const pv0=1180,pv1=Math.min(H-170,2640);
  const sheetsRear=posterBand('rear',-W+60,W-150,pv0,pv1,'wall-teen-poster-wall','Gig posters wall to wall: bands, sleeves, set lists and stubs',4);
  hero={wall:'rear',u0:-W+60,u1:W-150,v0:pv0,v1:pv1,kind:'gig-poster wall',sheets:sheetsRear};
  // The posters carry on round the corner above the bed (film angles).
  posterBand('left',-(l.bed[1]+700),-l.back-60,1150,Math.min(H-170,2500),'wall-teen-poster-corner','Posters carried round the corner above the bed',9);
  // Window wall, past the door: the guitar, records and the XC pennant.
  guitar('teen','right',door?door.u+doorHalf+210:back+230,door?door.u+doorHalf:back,door?front:windowZ);
  {const got=fitW('right',[940,630],1240,1760,w=>door?door.u+doorHalf+400+w/2:windowZ+curtainHalf+50+w/2);if(got){const {u,w:lw}=got,n=lw>900?3:2,k=cluster('right','wall-teen-record-ledge','Record ledge with favourite sleeves',u,1260);claim('right',u-lw/2,u+lw/2,1240,1760,k.id);
   k.solid(new THREE.BoxGeometry(lw,22,95),'#1f2326',0,0,48);k.solid(new THREE.BoxGeometry(lw,40,10),'#1f2326',0,20,92);
   const xs=n===3?[-310,0,310]:[-157,157];xs.forEach((x,i)=>{const lean=-.1;k.solid(new THREE.BoxGeometry(300,300,4),'#151515',x,161,32,0,0,lean);const g=new THREE.PlaneGeometry(300,300);g.userData.region=sleeves[i];k.paper.push(xf(g,x,161,34.2,0,0,lean));});
   k.solid(new THREE.CylinderGeometry(145,145,3,40),'#121212',xs[0]+150,165,18,0,0,Math.PI/2-.1);}}
  {const u=fit('right',320,2240,2560,door?door.u+doorHalf+360:windowZ+curtainHalf+520);if(u!==null){const k=cluster('right','wall-teen-pennant','North Ridge cross-country pennant',u,2400);claim('right',u-320,u+320,2240,2560,k.id);const sh=new THREE.Shape();sh.moveTo(-300,95);sh.lineTo(300,6);sh.lineTo(-300,-95);sh.closePath();k.sheet(600,190,pennant,{shape:sh,rot:.03,bow:3});k.pin(-280,70,k.z);k.pin(-280,-70,k.z);}}
  sill(k=>{k.solid(new THREE.CylinderGeometry(30,24,48,12),'#c77960',-230,24,30);k.solid(new THREE.CylinderGeometry(15,17,90,10),'#5f8a5c',-230,92,30);k.solid(new THREE.CylinderGeometry(7,8,40,8),'#5f8a5c',-208,96,30,-.6);
   k.solid(new THREE.CylinderGeometry(26,30,18,14),'#2f2f2f',30,9,30);k.solid(new THREE.CylinderGeometry(6,6,70,8),'#d8b45a',30,52,30);k.solid(new THREE.CylinderGeometry(24,12,40,14),'#d8b45a',30,106,30);
   k.solid(new THREE.BoxGeometry(46,30,42),'#f2f2f2',200,15,30);});
  clings(k=>{const g=new THREE.CircleGeometry(48,24);k.solid(g,'#151515',470,-480,-62);k.solid(new THREE.RingGeometry(26,34,24),'#e2584c',470,-480,-61.5);});
 }

 if(stage==='college'){
  // ---- COLLEGE: whiteboard and semester calendar, photo-lit string lights ----
  const wb=atlasReq(900,600,(c,w,hh)=>{fill(c,'#f7f8f6',0,0,w,hh);vgrad(c,0,0,w,hh,'rgba(255,255,255,0)','rgba(160,170,175,.12)');speckle(c,w,hh,500,['#9aa5ab'],7,2.5,.12);
   c.globalAlpha=.2;hand(c,'(old) seminar 3 → read Ostrom',40,560,22,'#2a5ba8',{seed:99});c.globalAlpha=1;
   hand(c,'THESIS · ch.2 draft → FRI',40,64,34,'#c43030',{seed:1,weight:'bold'});path(c,[[40,76],[420,80]],'#c43030',3);
   const box=(x,y,s,col)=>{c.strokeStyle=col;c.lineWidth=3;c.strokeRect(x,y,150,64);hand(c,s,x+12,y+40,22,col,{seed:x});};
   box(60,140,'rainfall','#1d1d1d');box(330,140,'runoff','#1d1d1d');box(600,140,'cities','#1d1d1d');box(330,300,'policy?','#2a5ba8');
   path(c,[[210,172],[330,172]],'#1d1d1d',3);path(c,[[480,172],[600,172]],'#1d1d1d',3);path(c,[[405,204],[405,300]],'#2a5ba8',3);path(c,[[675,204],[480,320]],'#2a5ba8',3);
   hand(c,'Q = C·i·A',600,330,30,'#2f7d4a',{seed:5});
   ['[ ] email Prof. Adeyemi','[x] lab report','[x] rent','[ ] book train home','[ ] laundry (!!)'].forEach((s,i)=>hand(c,s,40,420+i*34,22,'#1d1d1d',{seed:20+i}));
   hand(c,'call mum sun',600,520,24,'#c43030',{seed:8});
  },.95);
  const calendar=atlasReq(300,420,(c,w,hh)=>{fill(c,'#fbfaf5',0,0,w,hh);fill(c,'#294f56',0,0,w,150);for(let i=0;i<6;i++)path(c,Array.from({length:30},(_,k)=>[k*w/29,30+i*18+Math.sin(k*.4+i)*8]),i%2?'#ce9b6a':'#688e8f',2.5);
   text(c,'OCTOBER',14,180,22,'#294f56');const days='MTWTFSS';[...days].forEach((d,i)=>text(c,d,22+i*38,204,11,'#666',{align:'center'}));
   for(let d=0;d<31;d++){const col=(d+2)%7,row=Math.floor((d+2)/7),x=22+col*38,y=226+row*36;text(c,String(d+1),x,y,12,'#333',{align:'center',weight:''});if(d<20){path(c,[[x-12,y-12],[x+12,y+4]],'#c43030',1.6);path(c,[[x+12,y-12],[x-12,y+4]],'#c43030',1.6);}if(d===23||d===27)ring(c,x,y-4,15,'#2a5ba8',2);}
   hand(c,'midterm',22+((23+2)%7)*38-30,226+Math.floor(25/7)*36+20,10,'#2a5ba8',{seed:3});});
  const kinds=['friends','lake','concert','city','mountain','friends','beach','dog'],caps=['flat 4B','reading wk','!!!','first night','field trip','graduation?','home','Pepper'];
  const photos=kinds.map((kd,i)=>atlasReq(88,106,(c,w,hh)=>polaroid(c,w,hh,kd,200+i,caps[i]),2.2));
  const posters=[
   atlasReq(400,560,(c,w,hh)=>poster(c,w,hh,{bg:'#e7e1d5',ink:'#294f56',hot:'#ce9b6a',style:'grid',title:'FORM & FIELD',lines:['BFA student exhibition','Hall B · opens thurs 6pm'],seed:11}),1.1),
   atlasReq(360,500,(c,w,hh)=>poster(c,w,hh,{bg:'#1e2a2e',ink:'#e7e1d5',hot:'#ce9b6a',style:'film',title:'FILM NIGHT: THE LONG WAY ROUND',lines:['thurs 8pm · room 204','free popcorn (allegedly)'],seed:12}),1.1),
   atlasReq(380,540,(c,w,hh)=>poster(c,w,hh,{bg:'#346971',ink:'#f3ead8',hot:'#ce9b6a',style:'lecture',title:'LOCAL TO GLOBAL',lines:['public lecture: water, cities','& the next fifty years'],seed:13}),1.1),
   atlasReq(340,480,(c,w,hh)=>poster(c,w,hh,{bg:'#e9dcc3',ink:'#293e5b',hot:'#da9a68',style:'sun',title:'LOW TIDE STATIC',lines:['w/ Paper Lanterns','THE COPPER ROOM'],seed:1}),1.1),
   atlasReq(300,420,(c,w,hh)=>poster(c,w,hh,{bg:'#efe3c8',ink:'#3c5b3f',hot:'#b5653e',style:'botanic',title:'grow something',lines:['screenprint 3/20'],seed:14}),1.1)];
  const postcards=['lake','mountain','city'].map((kd,i)=>atlasReq(150,105,(c,w,hh)=>{scene(c,0,0,w,hh,kd,300+i);text(c,['greetings from the lake','alpine hut 2,100m','city museum · free fri'][i],8,hh-10,11,'#fff',{max:w-16});},1.6));
  // String lights with photos pegged along them, across the top of the rear wall.
  {const pts=lightLine([-W+260,W-240],[[H-230,150,2],[H-190,100,2],[H-150,60,3],[H-110,30,4]]);if(pts){const k=cluster('rear','wall-college-string-lights','String lights with pegged photos',0,0);
   k.solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),180,1.6,4,false),'#efe9df',0,0,0);for(let i=1;i<60;i+=2){const p=pts[i];k.glow('bulbs',new THREE.SphereGeometry(8,8,6),'#fff1d2',p.x,p.y-12,30);}
   let pi=0;for(let i=4;i<58;i+=7){const p=pts[i];if(!free('rear',{u0:p.x-50,u1:p.x+50,v0:p.y-130,v1:p.y},4))continue;claim('rear',p.x-50,p.x+50,p.y-130,p.y,'wall-college-string-lights');k.sheet(88,106,photos[pi%photos.length],{x:p.x,y:p.y-62,z:31+pi*.2,rot:((pi%3)-1)*.08,curl:pi%3===2?8:0,corner:3});k.clip(p.x,p.y-6,29);pi++;}
   for(const p of [pts[0],pts[30],pts[60]])k.solid(new THREE.CylinderGeometry(3,3,32,6),'#9a9a9a',p.x,p.y+4,16.5,0,0,Math.PI/2);}}
  // The door: a robe on an over-door hook and the term timetable taped at eye level.
  const term=atlasReq(210,297,(c,w,hh)=>{sheetBg(c,w,hh,'#ffffff',{grid:12,age:.02});text(c,'TERM 1 · WEEK 7',12,26,15,'#294f56');['MON  9 Hydrology','TUE 11 Studio','WED  2 Seminar','THU 10 Lab','FRI  — library'].forEach((s,i)=>text(c,s,12,62+i*30,12,'#333',{weight:'',family:MONO}));hand(c,'home fri!!',110,hh-26,18,'#c43030',{seed:3});},1.2);
  buildDoor(18,{9:'9',12:'12',14:'14',16:'16',18:'18 → off to uni!'},k=>{doorSign(k,term,210,297,1480,-.03,'#e6e6e0');
   overDoorHook(k);const z=k.slabZ;k.solid(new THREE.BoxGeometry(400,700,70),'#c8b79a',120,1560,z+44,0,0,.03);for(const s of [-1,1])k.solid(new THREE.BoxGeometry(120,620,56),'#c8b79a',120+s*250,1540,z+40,s*.1);k.solid(new THREE.BoxGeometry(60,520,20),'#b3a284',120,1500,z+82);k.solid(ell(130,80,40),'#c8b79a',120,1930,z+44);});
  // ---- The bed wall: a salon-hung gallery of mixed frames (no accent panel). ----
  const gArt=[
   atlasReq(400,500,(c,w,hh)=>{fill(c,'#f4f0e6',0,0,w,hh);scene(c,40,40,w-80,hh-120,'mountain',501);text(c,'field course, 2025',40,hh-40,16,'#555',{weight:''});},.9),
   atlasReq(280,360,(c,w,hh)=>{fill(c,'#efe6d2',0,0,w,hh);for(let i=0;i<7;i++){c.save();c.translate(w/2,hh*.72);c.rotate(-1.1+i*.37);c.fillStyle=i%2?'#3c5b3f':'#6f8f5f';c.beginPath();c.ellipse(0,-hh*.25,28,hh*.2,0,0,7);c.fill();c.restore();}path(c,[[w/2,hh*.72],[w/2,hh*.9]],'#3c5b3f',4);text(c,'Fern, no. 4',20,hh-18,13,'#555',{weight:'',family:SERIF});},1),
   atlasReq(240,240,(c,w,hh)=>{fill(c,'#294f56',0,0,w,hh);dot(c,w*.4,hh*.45,70,'#ce9b6a');ring(c,w*.6,hh*.55,60,'#e7e1d5',6);dot(c,w*.75,hh*.25,18,'#e7e1d5');},1),
   atlasReq(220,300,(c,w,hh)=>{fill(c,'#f7f4ec',0,0,w,hh);c.strokeStyle='#222';c.lineWidth=2.2;c.beginPath();c.moveTo(80,60);c.bezierCurveTo(150,40,170,120,140,160);c.bezierCurveTo(120,190,150,220,120,250);c.moveTo(80,60);c.bezierCurveTo(40,110,60,200,110,230);c.stroke();dot(c,120,120,4,'#222');path(c,[[100,175],[125,178]],'#222',2);},1),
   atlasReq(340,240,(c,w,hh)=>{fill(c,'#e9e0c9',0,0,w,hh);c.strokeStyle='rgba(41,79,86,.5)';c.lineWidth=1.5;for(let i=0;i<9;i++){c.beginPath();for(let x=0;x<=w;x+=10)c.lineTo(x,30+i*24+Math.sin(x/40+i)*10);c.stroke();}text(c,'HARBOR VALLEY · 1:25 000',14,hh-14,12,'#294f56');},1),
   atlasReq(200,260,(c,w,hh)=>{fill(c,'#ce9b6a',0,0,w,hh);text(c,'stay',20,90,46,'#294f56',{family:SERIF});text(c,'curious.',20,150,46,'#294f56',{family:SERIF});},1),
   atlasReq(220,220,(c,w,hh)=>{fill(c,'#f4f0e6',0,0,w,hh);scene(c,18,18,w-36,hh-36,'friends',503);},1.2),
   atlasReq(180,240,(c,w,hh)=>{fill(c,'#f4f0e6',0,0,w,hh);scene(c,16,16,w-32,hh-32,'lake',504);},1.2)];
  {const gx=Math.max(-W+620,l.bed[0]+60),gy=Math.min(1830,H-980),k=cluster('rear','wall-college-gallery','Salon-hung gallery wall over the bed',gx,gy);k.composite=true;let n=0,minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
   const base=depthAt('rear',0,0,gy-500,gy+460),t=24;
   const frames=[[0,420,520,-250,70,'#1d1d1d'],[1,300,380,140,170,'#c9b08a'],[2,260,260,420,30,'#f2efe6'],[3,240,320,-560,-60,'#b08a4e'],[4,360,260,110,-190,'#1d1d1d'],[5,220,280,-320,-360,'#f2efe6'],[6,240,240,400,-280,'#c9b08a'],[7,200,260,-560,300,'#1d1d1d']];
   for(const [ai,w,hh,dx,dy,col] of frames){const x=gx+dx,y=gy+dy,rect={u0:x-w/2-t,u1:x+w/2+t,v0:y-hh/2-t,v1:y+hh/2+t};if(!free('rear',rect,10))continue;
    for(const [bx,by,bw,bh] of [[0,hh/2+t/2,w+2*t,t],[0,-hh/2-t/2,w+2*t,t],[-w/2-t/2,0,t,hh],[w/2+t/2,0,t,hh]])k.solid(new THREE.BoxGeometry(bw,bh,24),col,dx+bx,dy+by,base+12);
    k.sheet(w,hh,gArt[ai],{x:dx,y:dy,z:base+3,bow:0});n++;minX=Math.min(minX,rect.u0);maxX=Math.max(maxX,rect.u1);minY=Math.min(minY,rect.v0);maxY=Math.max(maxY,rect.v1);}
   // A small round mirror among the frames (stylised, no realtime reflection).
   if(free('rear',{u0:gx+300,u1:gx+540,v0:gy+180,v1:gy+420},10)){k.solid(new THREE.TorusGeometry(115,12,8,40),'#b08a4e',420,300,base+12);k.solid(new THREE.CircleGeometry(104,40),'#c4d2d6',420,300,base+6);n++;minX=Math.min(minX,gx+300);maxX=Math.max(maxX,gx+540);maxY=Math.max(maxY,gy+420);}
   if(n){claim('rear',minX,maxX,minY,maxY,k.id);hero={wall:'rear',u0:minX,u1:maxX,v0:minY,v1:maxY,kind:'gallery wall',frames:n};}else clusters.splice(clusters.indexOf(k),1);}
  // The guitar from school, now with stickers, hung beside the gallery.
  guitar('college','rear',(hero?.u1??l.bed[0]+700)+220,-W+200,W-200);
  // A block-printed tapestry above the bed on the side wall (film angles).
  {const tap=atlasReq(1100,800,(c,w,hh)=>{fill(c,'#e7dcc6',0,0,w,hh);for(let row=0;row<6;row++)for(let col=0;col<10;col++){const x=60+col*100,y=70+row*120,k=(row+col)%3;c.fillStyle=['#294f56','#ce9b6a','#7a5a43'][k];if(k===0){c.beginPath();c.moveTo(x,y-30);c.lineTo(x+30,y);c.lineTo(x,y+30);c.lineTo(x-30,y);c.fill();}else if(k===1)dot(c,x,y,18,c.fillStyle);else c.fillRect(x-28,y-6,56,12);}speckle(c,w,hh,3000,['#5a4a3a','#ffffff'],8,2,.12);},.6);
   const u=fit('left',600,1250,2250,-l.bed[1]);if(u!==null){const k=cluster('left','wall-college-tapestry','Block-printed tapestry on a dowel',u,1760);claim('left',u-600,u+600,1250,2250,k.id);
    k.solid(new THREE.CylinderGeometry(12,12,1240,10),'#937353',0,430,30,Math.PI/2);for(const s of [-1,1])k.solid(new THREE.SphereGeometry(16,8,6),'#937353',s*628,430,30);k.z=14;k.sheet(1100,800,tap,{y:20,bow:6});
    for(let i=0;i<22;i++)k.solid(new THREE.BoxGeometry(6,50,3),'#d8cdb4',-525+i*50,-405,18,(i%3-1)*.06);}}
  // Whiteboard and calendar above the desk.
  const bv=1620;let u0=null,wbw=0,withCal=false;
  for(const [bw,cal] of [[900,true],[760,true],[620,true],[760,false],[620,false]]){const tw=bw+(cal?380:40);u0=fit('rear',tw/2,bv-330,bv+330,Math.min(l.desk[0]+60,W-160-tw/2),-W+300,W-140);if(u0!==null){wbw=bw;withCal=cal;break;}}
  if(u0!==null){const tw=wbw+(withCal?380:40),k=cluster('rear','wall-college-whiteboard','Whiteboard plan and semester calendar',u0,bv);claim('rear',u0-tw/2,u0+tw/2,bv-330,bv+330,k.id);const d=depthAt('rear',0,0,bv-330,bv+330),bx=withCal?-190:0,bh=Math.min(600,wbw*.667);
   for(const [x,y,w,hh] of [[bx,bh/2+9,wbw+18,18],[bx,-bh/2-9,wbw+18,18],[bx-wbw/2-9,0,18,bh],[bx+wbw/2+9,0,18,bh]])k.solid(new THREE.BoxGeometry(w,hh,22),'#b8bec2',x,y,d+11);
   k.z=d+12;k.sheet(wbw,bh,wb,{x:bx,bow:0});k.solid(new THREE.BoxGeometry(wbw*.5,14,50),'#b8bec2',bx+wbw*.15,-bh/2-24,d+25);
   [['#c43030',-40],['#2a5ba8',0],['#1d1d1d',40]].forEach(([col,x])=>{k.solid(new THREE.CylinderGeometry(8,8,120,10),'#f0f0f0',bx+wbw*.15+x*1.4,-bh/2-10,d+40,Math.PI/2);k.solid(new THREE.CylinderGeometry(8.5,8.5,30,10),col,bx+wbw*.15+x*1.4+58,-bh/2-10,d+40,Math.PI/2);});
   k.solid(new THREE.BoxGeometry(110,40,30),'#3a3a3a',bx-wbw*.25,-bh/2-12,d+34);
   // A printed article held by magnets, and the calendar on a nail.
   k.z=d+14;const art=atlasReq(210,297,(c,w,hh)=>{sheetBg(c,w,hh,'#ffffff',{age:.02});text(c,'Commons, cities and water',14,30,14,'#111',{family:SERIF});for(let i=0;i<22;i++)fill(c,'#9a9a9a',14,48+i*10,w-28-(i%5===4?60:0),2.2);for(let i=0;i<5;i++)fill(c,'rgba(240,220,60,.55)',14,98+i*40,w-60,8);},1.2);
   k.sheet(210,297,art,{x:bx+wbw/2-150,y:60,rot:.03,curl:8,corner:1});for(const [x,y,col] of [[bx+wbw/2-210,190,'#c43030'],[bx+wbw/2-90,190,'#2a5ba8']])k.solid(new THREE.CylinderGeometry(12,12,10,14),col,x,y,k.z+6,0,0,Math.PI/2);
   const cx=bx+wbw/2+220;k.z=d+2;if(withCal){k.solid(new THREE.CylinderGeometry(2.5,2.5,20,6),'#777',cx,225,d+10,0,0,Math.PI/2);k.sheet(300,420,calendar,{x:cx,y:20,rot:-.015,bow:2.5,curl:10,corner:0});k.solid(new THREE.BoxGeometry(40,16,10),'#2b2b2b',cx,222,k.z+5);}
  }
  // Poster corner on the window wall: newer taste, one kept from school.
  {const got=fitW('right',[940,690],1260,2560,w=>door?door.u+doorHalf+40+w/2:windowZ+curtainHalf+50+w/2);if(got){const {u,w:pw}=got,full=pw>900,k=cluster('right','wall-college-posters','Exhibition, film-night and lecture posters',u,1930);claim('right',u-pw/2,u+pw/2,1260,2560,k.id);
   (full?[[3,-250,230,-.05,0,.3],[0,-80,160,.02,0,0],[2,240,260,.03,18,0],[1,190,-190,-.03,0,0],[4,-260,-210,.05,12,0]]:[[3,-160,200,-.05,0,.3],[2,150,230,.03,18,0],[1,0,-250,-.03,0,0]]).forEach(([i,x,y,rot,curl,tear],n)=>{const w=[400,360,380,340,300][i],hh=[560,500,540,480,420][i];k.sheet(w,hh,posters[i],{x,y,rot,curl,tear,corner:n%2?3:1,bow:2});k.tape(x-w*.36,y+hh/2-8,k.z+1,50,18,-.3,'#e6e6e0');k.tape(x+w*.36,y+hh/2-8,k.z+1,50,18,.25,'#e6e6e0');});
   postcards.forEach((r,i)=>{const y=(full?-440:-590)+i*20;k.sheet(150,105,r,{x:(full?-20:-120)+i*(full?40:110),y,rot:(i-1)*.09});k.pin((full?-20:-120)+i*(full?40:110),y+40,k.z,'#3c78c8');});}}
  // Picture ledge with leaning frames and a trailing plant beside the bed.
  {const got=fitW('rear',[520,400],1180,1720,w=>l.bed[0]+650+60+w/2,-W+200,W-200);if(got){const {u,w:lw}=got;const k=cluster('rear','wall-college-picture-ledge','Picture ledge, leaning frames and a trailing plant',u,1200);claim('rear',u-lw/2,u+lw/2,1180,1720,k.id);const d=depthAt('rear',0,0,1180,1720);
   k.solid(new THREE.BoxGeometry(lw,22,90),'#937353',0,0,d+45);k.solid(new THREE.BoxGeometry(lw,30,8),'#937353',0,22,d+88);
   const framed=[atlasReq(230,300,(c,w,hh)=>{fill(c,'#f5f1e8',0,0,w,hh);scene(c,24,24,w-48,hh-80,'mountain',401);text(c,'Alpine study, 2023',24,hh-24,12,'#555',{weight:''});},1.2),atlasReq(170,220,(c,w,hh)=>{fill(c,'#f5f1e8',0,0,w,hh);scene(c,18,18,w-36,hh-36,'friends',402);},1.4)];
   (lw>500?[[-110,230,300,-.09],[110,170,220,-.07]]:[[-60,230,300,-.09]]).forEach(([x,w,hh,lean],i)=>{k.solid(new THREE.BoxGeometry(w+24,hh+24,18),i?'#2b2b2b':'#c9b08a',x,11+hh/2+12,d+40,0,0,lean);const g=new THREE.PlaneGeometry(w,hh);g.userData.region=framed[i];k.paper.push(xf(g,x,11+hh/2+12,d+50,0,0,lean));});
   k.solid(new THREE.CylinderGeometry(40,32,80,14),'#e7e1d5',lw/2-70,51,d+47);const vine=(dx,len,seed)=>{const r=rng(seed),pts=[];for(let i=0;i<=8;i++)pts.push(new THREE.Vector3(lw/2-70+dx+Math.sin(i*.8+seed)*14,90-i*len/8,d+50+Math.cos(i)*6));k.solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,2,4,false),'#4f7a45',0,0,0);for(let i=1;i<=8;i++){const p=pts[i];k.solid(ell(14,10,4),r()>.5?'#6f9b5f':'#5d8a51',p.x+(i%2?10:-10),p.y,p.z+6,(i%2?.5:-.5));}};
   vine(-30,260,1);vine(10,380,2);vine(36,180,3);for(let i=0;i<5;i++)k.solid(ell(18,12,6),'#6f9b5f',lw/2-70+(i-2)*22,108+(i%2)*14,d+45,(i-2)*.4);}}
  sill(k=>{for(const [x,col] of [[-250,'#b5653e'],[-150,'#e7e1d5']]){k.solid(new THREE.CylinderGeometry(32,26,58,12),col,x,29,30);for(let i=0;i<8;i++){const a=i*.8;k.solid(ell(12,8,6),'#6f9b5f',x+Math.cos(a)*14,72+(i%3)*12,30+Math.sin(a)*14,.3,a);}}
   k.solid(new THREE.CylinderGeometry(34,30,92,16),'#294f56',60,46,30);k.solid(new THREE.TorusGeometry(20,6,6,12),'#294f56',96,50,30,0,0,0);
   k.solid(new THREE.BoxGeometry(150,20,64),'#c9b08a',240,10,30);k.solid(new THREE.BoxGeometry(140,24,60),'#346971',240,32,30,.08);});
  clings(k=>{k.solid(new THREE.BoxGeometry(120,80,.8),'#f1ead6',480,-520,-62);k.solid(new THREE.BoxGeometry(100,24,.9),'#294f56',480,-500,-61.5);});
 }

 // One seamless plaster skin over the window wall's inner face (with the
 // window hole): the shell is four boxes, and their meeting edges at sill and
 // head height sparkled as dotted lines at the wide camera.
 {const sh=new THREE.Shape();sh.moveTo(back,0);sh.lineTo(front,0);sh.lineTo(front,H);sh.lineTo(back,H);sh.closePath();const hole=new THREE.Path();hole.moveTo(windowZ-ww/2,low);hole.lineTo(windowZ-ww/2,low+wh);hole.lineTo(windowZ+ww/2,low+wh);hole.lineTo(windowZ+ww/2,low);hole.closePath();sh.holes.push(hole);
  const g=new THREE.ShapeGeometry(sh),uv=g.attributes.uv,pp=g.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,(pp.getX(i)-back)/l.depth,pp.getY(i)/H);
  const shell=right.children.find(o=>o.isMesh&&o.geometry?.parameters?.width===80&&Math.abs(o.geometry.parameters.height-low)<1),skin=mesh(right,g,shell?.material||m.plaster,[W-1,0,0]);
  // The shell boxes keep their colour but lose the stipple bump: each box face restarts the
  // bump UVs, and those seams at sill and head height showed through as dotted lines.
  if(shell){const flat=shell.material.clone();flat.bumpMap=null;flat.needsUpdate=true;for(const o of right.children)if(o.isMesh&&o.material===shell.material&&o.geometry?.parameters?.width===80)o.material=flat;}skin.rotation.y=-Math.PI/2;skin.name='Window wall plaster skin';skin.castShadow=false;skin.receiveShadow=true;skin.userData.presentationOnly=true;skin.userData.dropSurface=false;}
 // Matching skirting on the window wall, stopping at the door casing.
 {const k=cluster('right','wall-'+stage+'-skirting','Painted skirting board',(back+front)/2,50),segs=door?[[back+2,door.u-DW/2-CAS-6],[door.u+DW/2+CAS+6,front-2]]:[[back+2,front-2]];
  for(const [a,b] of segs)if(b-a>20)k.solid(new THREE.BoxGeometry(b-a,100,20),'#efe7d4',(a+b)/2-(back+front)/2,0,10);}
 const atlas=packAtlas();finish(atlas);
 // Wall wear from the materials layer (ghost-poster rectangles, Blu-Tack,
 // pins) is built before this layer and cannot see it, so this layer clears
 // any wear quad that would land on its art; and the preteen's dado touch-up
 // patch, which read as a flat grey square on the navy dado.
 let wearRemoved=0;
 for(const wall of ['rear','right','left']){let o=null;root.traverse(x=>{if(x.name==='Wall wear · '+wall)o=x;});if(!o?.geometry?.index)continue;
  const pos=o.geometry.attributes.position,uv=o.geometry.attributes.uv,idx=o.geometry.index,mine=busy[wall].filter(r=>fixtures.includes(r.id));
  for(let q=0;q*6<idx.count;q++){const ids=[...new Set([0,1,2,3,4,5].map(k=>idx.getX(q*6+k)))];let cx=0,cy=0,cz=0,cu=0,cv=0;for(const i of ids){cx+=pos.getX(i);cy+=pos.getY(i);cz+=pos.getZ(i);cu+=uv.getX(i);cv+=uv.getY(i);}const n=ids.length;cx/=n;cy/=n;cz/=n;cu/=n;cv/=n;
   const u=wall==='rear'?cx:wall==='right'?cz:-cz,patch=stage==='preteen'&&wall==='rear'&&cy<900&&cu<.25&&cv<.25;
   if(patch||mine.some(r=>u>r.u0-20&&u<r.u1+20&&cy>r.v0-20&&cy<r.v1+20)){for(const i of ids)pos.setXYZ(i,pos.getX(ids[0]),pos.getY(ids[0]),pos.getZ(ids[0]));wearRemoved++;}}
  pos.needsUpdate=true;o.geometry.computeBoundingSphere();o.geometry.computeBoundingBox?.();}
 const glows=Object.entries(glowMats);
 const summary={stage,fixtures,clusters:fixtures.length,
  // For lighting (read lazily each phase): the door its hall wedge enters by,
  // and the hero bed-wall statement its night wash centres on.
  door,hero,retired,wearRemoved,stringLights:!!glowMats.bulbs,glowStickers:!!glowMats.phosphor,atlas:atlas?2048:0,phase:'morning',
  // Claimed wall rectangles (mm; u = along the wall as seen from inside, v = height) for later layers.
  rects:Object.fromEntries(Object.entries(busy).map(([w,list])=>[w,list.filter(r=>fixtures.includes(r.id)).map(({u0,u1,v0,v1,id})=>({u0,u1,v0,v1,id}))]))};
 root.userData.childWallLife=summary;
 return {update(phase){
  for(const [ch,mat] of glows){mat.emissiveIntensity=ch==='phosphor'?{night:.55,evening:.12}[phase]||0:ch==='hall'?{night:stage==='primary'?1.4:.6,evening:.35}[phase]||0:{evening:1.6,party:1.2,night:stage==='teen'||stage==='college'?.25:0,afternoon:.12}[phase]||0;}
  summary.phase=phase;
 }};
}
