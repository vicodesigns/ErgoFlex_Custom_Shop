import * as THREE from 'three';
import {earlyYearsProfile} from './early-years-profiles.mjs';
import {CHILD_PERSONALITY_PALETTES} from './child-personality-detail.mjs';

// Surfaces, textiles and a year of use. Each life stage has its own material
// story (60 neutral / 30 textile / 10 accent) instead of one shared cream and
// sage shell. Everything here is a canvas texture or a material change on an
// existing mesh; the only additions are flat, merged wear layers, a fringe
// strip and a switch plate. No transforms of furniture, desk or wall art change.
export const CHILD_MATERIAL_STORIES={
 early:{name:'Limed pine boards · gingham cotton · scalloped play rug',trio:'buttermilk walls & limed floor / profile colour bedding / profile accent',floor:'limed',wood:'#e4cba3',woodRough:.6,trim:'#f6eedf',paintRough:.97,dadoRough:.84,quilt:'gingham',throw:'cable',rug:'scallop',curtain:'dots',nook:'cord',cushion:'cord',headboard:null,sheet:'#f6efe2',pillows:['#f7f1e6','#f1e4cf']},
 primary:{name:'Amber oak floor · painted furniture · patchwork · striped flat-weave',trio:'sunny cream walls & white-painted furniture over a dark amber floor / lagoon textiles / ochre & coral',floor:'honey',wood:'#f1ebdf',woodRough:.42,trim:'#f7f1e2',paintRough:.95,dadoRough:.8,quilt:'patchwork',throw:'waffle',rug:'kilim',curtain:'ticking',nook:'canvas',cushion:'canvas',headboard:{color:'#3f8584',kind:'canvas'},upholstery:'#3f7f7d',sheet:'#f3f1ea',pillows:['#f4efe4','#e7c766']},
 preteen:{name:'Painted boards · denim & chambray · Beni lattice',trio:'clay-blush walls & warm-grey painted boards / denim / clay',floor:'painted',wood:'#e3d5c0',woodRough:.62,trim:'#f0e9e3',paintRough:.94,dadoRough:.78,quilt:'denim',throw:'chunky',rug:'beni',curtain:'chambray',nook:'twill',cushion:'cord',headboard:{color:'#566f8c',kind:'twill'},upholstery:'#566f8c',sheet:'#e9edf0',pillows:['#dfe5ea','#c9d3dc']},
 teen:{name:'Smoked oak · charcoal jersey & velvet · graphic wool',trio:'putty grey with a bottle-green window wall, smoked oak / indigo & charcoal / terracotta',accentWall:'#40564b',floor:'smoked',wood:'#a88766',woodRough:.5,trim:'#e3e1dc',paintRough:.9,dadoRough:.74,quilt:'jersey',throw:'waffle',rug:'graphic',curtain:'blackout',nook:'velvet',cushion:'velvet',headboard:{color:'#2f3b59',kind:'velvet'},upholstery:'#3a3f4b',sheet:'#9a9ea6',pillows:['#7b8290','#5d6472']},
 college:{name:'Grey-washed wide boards · washed linen · jute & petrol',trio:'clay limewash walls & grey-washed boards / petrol linen / caramel',limewash:true,floor:'greywash',wood:'#9b7553',woodRough:.48,trim:'#ede5d7',paintRough:.93,dadoRough:.8,quilt:'linen',throw:'chunky',rug:'jute',curtain:'linen',nook:'boucle',cushion:'velvet',headboard:{color:'#ddd2bf',kind:'boucle'},upholstery:'#3d4547',sheet:'#efe8dc',pillows:['#ece4d6','#d8cdb9']}
};
const FLOORS={
 limed:{base:'#c99f6b',grain:'#7f5530',ga:.4,wash:'rgba(244,232,212,.16)',lime:true,edge:'rgba(110,80,48,.45)',rough:.72,tint:.07,light:true},
 honey:{base:'#b97842',grain:'#6a3c17',ga:.46,edge:'rgba(70,38,14,.55)',rough:.54,tint:.09},
 painted:{base:'#b98a5c',grain:'#7a5430',ga:.4,paint:'#9d9284',streak:'#f4efe6',edge:'rgba(52,44,36,.16)',rough:.62,tint:.03,light:true},
 smoked:{base:'#7a5c42',grain:'#2b1c11',ga:.52,edge:'rgba(18,10,5,.6)',rough:.5,tint:.08},
 greywash:{base:'#9b8670',grain:'#4f3e31',ga:.48,wash:'rgba(200,194,184,.22)',edge:'rgba(52,42,32,.5)',rough:.7,tint:.07,light:true}
};
const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgba=(h,a)=>{const [r,g,b]=hx(h);return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,a)).toFixed(3)})`;};
const mix=(a,b,t)=>{const B=hx(b);return '#'+hx(a).map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};
const random=seed=>()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const radial=(c,x,y,r,inner,outer)=>{const g=c.createRadialGradient(x,y,0,x,y,r);if(!g?.addColorStop)return;g.addColorStop(0,inner);g.addColorStop(1,outer);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};
const path=(c,pts)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));};
const soft=(c,pts,width,color,alpha,steps=6)=>{c.lineCap='round';c.lineJoin='round';for(let k=0;k<steps;k++){c.strokeStyle=rgba(color,alpha);c.lineWidth=width*(1-k/steps);path(c,pts);c.stroke();}};
const speckle=(c,w,h,r,n,cols,amax,size=1.6)=>{for(let i=0;i<n;i++){c.fillStyle=rgba(cols[i%cols.length],amax*r());c.fillRect(r()*w,r()*h,.8+r()*size,.8+r()*size);}};
const ellipse=(c,x,y,rx,ry,a,fill)=>{c.fillStyle=fill;c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),a,0,Math.PI*2);c.fill();};

// ---- Pure canvas painters (no three.js), exported for texture review sheets.
export function drawPlank(c,w,h,kind,r){
 const f=FLOORS[kind];c.fillStyle=f.base;c.fillRect(0,0,w,h);
 for(let i=0;i<54;i++){const x0=r()*w,amp=1.5+r()*5,k=.4+r()*2.4,ph=r()*6;c.strokeStyle=rgba(f.grain,(.2+r()*.8)*f.ga);c.lineWidth=.5+r()*1.7;c.beginPath();for(let y=0;y<=h;y+=16){const x=x0+Math.sin(y/h*Math.PI*k+ph)*amp;y?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
 const cx=w*(.3+r()*.4),cy=h*(.25+r()*.5);for(let j=0;j<8;j++){c.strokeStyle=rgba(f.grain,f.ga*(.55+r()*.4));c.lineWidth=.8+r()*1.2;c.beginPath();const sw=6+j*7,sh=50+j*30;c.moveTo(cx-sw,cy+sh);c.quadraticCurveTo(cx+r()*4-2,cy-sh*.35,cx+sw,cy+sh);c.stroke();}
 for(let i=0;i<520;i++){c.fillStyle=rgba(f.grain,f.ga*.7*r());c.fillRect(r()*w,r()*h,1,2+r()*5);}
 if(f.wash){c.fillStyle=f.wash;c.fillRect(0,0,w,h);if(f.lime)for(let i=0;i<260;i++){c.fillStyle='rgba(255,252,244,.4)';c.fillRect(r()*w,r()*h,1,3+r()*7);}}
 if(f.paint){
  c.fillStyle=f.paint;c.fillRect(0,0,w,h);
  for(let i=0;i<70;i++){c.fillStyle=rgba(i%3?f.streak:'#6f665a',.02+.04*r());c.fillRect(r()*w,r()*h,1+r()*3,25+r()*90);}
  for(let i=0;i<26;i++){c.strokeStyle=rgba(f.grain,.07);c.lineWidth=1;const x=r()*w;c.beginPath();c.moveTo(x,0);c.lineTo(x+(r()-.5)*4,h);c.stroke();}
 }
 c.fillStyle=f.edge;c.fillRect(0,0,2,h);c.fillRect(w-2,0,2,h);c.fillRect(0,0,w,2.5);c.fillRect(0,h-2.5,w,2.5);
}
// Luminance-only timber: the stage tone stays in material.color, so clones of
// the oak keep their own tint. Lighter, irregular borders read as rubbed edges.
export function drawTimber(c,w,h,r){
 c.fillStyle='rgb(222,222,222)';c.fillRect(0,0,w,h);
 for(let i=0;i<42;i++){const x0=r()*w,amp=2+r()*7,k=.3+r()*1.8,ph=r()*6;c.strokeStyle=`rgba(120,120,120,${(.08+r()*.2).toFixed(3)})`;c.lineWidth=.6+r()*2.2;c.beginPath();for(let y=0;y<=h;y+=8){const x=x0+Math.sin(y/h*Math.PI*k+ph)*amp;y?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
 for(let i=0;i<300;i++){c.fillStyle=`rgba(110,110,110,${(.15*r()).toFixed(3)})`;c.fillRect(r()*w,r()*h,1,2+r()*4);}
 for(let i=0;i<4;i++){const e=7+r()*4;c.fillStyle='rgba(255,255,255,.22)';c.fillRect(0,0,w,e*(1-i/4));c.fillRect(0,h-e*(1-i/4),w,e*(1-i/4));c.fillRect(0,0,e*(1-i/4),h);c.fillRect(w-e*(1-i/4),0,e*(1-i/4),h);}
 for(let i=0;i<40;i++){const side=i%4,t=r(),len=10+r()*40,d=1+r()*3;c.fillStyle='rgba(255,255,255,.35)';if(side===0)c.fillRect(t*w,0,len,d);else if(side===1)c.fillRect(t*w,h-d,len,d);else if(side===2)c.fillRect(0,t*h,d,len);else c.fillRect(w-d,t*h,d,len);}
}
export function drawRug(c,w,h,kind,p,r,early){
 const knots=(cols,a,n=9000)=>speckle(c,w,h,r,n,cols,a,1.8);
 if(kind==='scallop'){
  c.fillStyle='#f4ebda';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=6)for(let x=(y/6)%2*3;x<w;x+=6){c.fillStyle=`rgba(150,130,100,${(.05+r()*.06).toFixed(3)})`;c.beginPath();c.arc(x,y,1.6,0,Math.PI*2);c.fill();}
  const b=54;c.fillStyle=p.second;c.fillRect(0,0,w,b);c.fillRect(0,h-b,w,b);c.fillRect(0,0,b,h);c.fillRect(w-b,0,b,h);
  for(let x=b;x<w-b;x+=34){for(const y of [b,h-b]){c.beginPath();c.arc(x+17,y,17,0,Math.PI*2);c.fill();}}
  for(let y=b;y<h-b;y+=34){for(const x of [b,w-b]){c.beginPath();c.arc(x,y+17,17,0,Math.PI*2);c.fill();}}
  c.fillStyle=p.accent;for(let x=b+30;x<w-b-20;x+=20){c.beginPath();c.arc(x,b+34,3.5,0,Math.PI*2);c.arc(x,h-b-34,3.5,0,Math.PI*2);c.fill();}
  for(let y=b+30;y<h-b-20;y+=20){c.beginPath();c.arc(b+34,y,3.5,0,Math.PI*2);c.arc(w-b-34,y,3.5,0,Math.PI*2);c.fill();}
  for(const [x,y] of [[b/2,b/2],[w-b/2,b/2],[b/2,h-b/2],[w-b/2,h-b/2]])ellipse(c,x,y,15,15,0,p.feature);
  knots(['#ffffff','#6d5a40'],.16);
  c.lineCap='round';for(const [x,y,col] of [[.3,.74,p.accent],[.34,.71,p.second]]){c.strokeStyle=rgba(col,.55);c.lineWidth=3;path(c,[[w*x,h*y],[w*x+14,h*y-9],[w*x+6,h*y+5],[w*x+22,h*y-4]]);c.stroke();}
  ellipse(c,w*.62,h*.66,26,15,.3,'rgba(190,140,80,.13)');ellipse(c,w*.625,h*.665,14,8,.3,'rgba(190,140,80,.1)');
 }else if(kind==='kilim'){
  const bands=[p.ink,'#f1e8d2',p.dado,'#f1e8d2',p.feature,p.accent,'#f1e8d2',p.dado,p.feature,'#f1e8d2',p.ink];
  const widths=[18,46,70,22,56,30,40,70,56,46,18],total=widths.reduce((a,b)=>a+b,0);let x=0;
  for(let i=0;i<bands.length;i++){const bw=widths[i]/total*w;c.fillStyle=bands[i];c.fillRect(x,0,bw+1,h);
   if(bw>40){const motif=bands[(i+3)%bands.length]===bands[i]?p.ink:bands[(i+3)%bands.length];c.fillStyle=motif;for(let y=12;y<h;y+=36){c.beginPath();c.moveTo(x+bw/2,y);c.lineTo(x+bw/2+bw*.28,y+14);c.lineTo(x+bw/2,y+28);c.lineTo(x+bw/2-bw*.28,y+14);c.closePath();c.fill();c.fillStyle=bands[i];c.beginPath();c.moveTo(x+bw/2,y+7);c.lineTo(x+bw/2+bw*.12,y+14);c.lineTo(x+bw/2,y+21);c.lineTo(x+bw/2-bw*.12,y+14);c.closePath();c.fill();c.fillStyle=motif;}}
   else if(bw>15){c.fillStyle='#f1e8d2';for(let y=0;y<h;y+=12){c.fillRect(x+bw/2-2,y,4,6);}}
   x+=bw;}
  for(let y=0;y<h;y+=3){c.fillStyle=`rgba(0,0,0,${(.03+r()*.04).toFixed(3)})`;c.fillRect(0,y,w,1);}
  knots(['#ffffff','#3b2f22'],.1,6000);
 }else if(kind==='beni'){
  c.fillStyle='#ece3d2';c.fillRect(0,0,w,h);
  for(let i=0;i<7000;i++){const x=r()*w,y=r()*h;c.strokeStyle=r()<.5?`rgba(255,252,244,${(.25*r()).toFixed(3)})`:`rgba(150,128,100,${(.18*r()).toFixed(3)})`;c.lineWidth=1+r()*1.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+(r()-.5)*5,y+3+r()*7);c.stroke();}
  for(let i=0;i<60;i++)ellipse(c,r()*w,r()*h,20+r()*60,12+r()*40,r()*3,r()<.5?'rgba(255,250,240,.12)':'rgba(120,100,80,.08)');
  c.lineJoin='round';const cell=w/6;for(let row=-1;row<h/cell*3.4+1;row++)for(let col=-1;col<8;col++){const cx=col*cell+(row%2?cell/2:0)+(r()-.5)*10,cy=row*cell*.3;const pts=[[cx,cy-cell*.3],[cx+cell*.5,cy],[cx,cy+cell*.3],[cx-cell*.5,cy]].map(([a,b])=>[a+(r()-.5)*14,b+(r()-.5)*12]);c.strokeStyle=rgba('#4a3c32',.55);c.lineWidth=2+r()*1.2;path(c,[...pts,pts[0]]);c.stroke();
   if(r()<.07){c.fillStyle=rgba(r()<.6?p.accent:p.second,.5);c.beginPath();c.moveTo(cx,cy-cell*.12);c.lineTo(cx+cell*.2,cy);c.lineTo(cx,cy+cell*.12);c.lineTo(cx-cell*.2,cy);c.closePath();c.fill();}}
 }else if(kind==='graphic'){
  c.fillStyle='#2b3550';c.fillRect(0,0,w,h);
  for(const [x,y,col] of [[0,h,p.accent],[w,0,'#e2b285']]){for(let i=9;i>0;i--){c.strokeStyle=i%2?col:'#2b3550';c.lineWidth=17;c.beginPath();c.arc(x,y,i*30+40,0,Math.PI*2);c.stroke();}}
  c.fillStyle='#7487a6';for(let i=0;i<5;i++)c.fillRect(w*.42+i*22,h*.18,9,h*.64);
  c.fillStyle=p.accent;c.fillRect(w*.42-26,h*.5-5,5*22+30,10);
  knots(['#ffffff','#05070d'],.12,10000);
 }else{
  c.fillStyle='#bc9e74';c.fillRect(0,0,w,h);const s=16;
  for(let col=0;col<w/s+1;col++)for(let y=0;y<h;y+=s){const up=col%2;c.strokeStyle=r()<.5?`rgba(232,208,165,${(.5+r()*.3).toFixed(3)})`:`rgba(122,94,58,${(.45+r()*.3).toFixed(3)})`;c.lineWidth=5;c.beginPath();c.moveTo(col*s,y+(up?s:0));c.lineTo(col*s+s,y+(up?0:s));c.stroke();}
  knots(['#f3e3c4','#5c4126'],.08,3000);
  const b=30;c.fillStyle=p.dado;c.fillRect(0,0,w,b);c.fillRect(0,h-b,w,b);c.fillRect(0,0,b,h);c.fillRect(w-b,0,b,h);
  c.strokeStyle='rgba(236,226,208,.55)';c.setLineDash?.([6,5]);c.lineWidth=1.5;c.strokeRect(b-7,b-7,w-2*b+14,h-2*b+14);c.setLineDash?.([]);
 }
 // A year on the floor: the window side is sun-faded and a walking lane has
 // crushed the pile. Both are light, broad and deliberately subtle.
 radial(c,w*.97,h*.06,w*.75,kind==='graphic'?'rgba(196,172,170,.55)':'rgba(255,246,222,.5)','rgba(255,247,226,0)');
 soft(c,[[-20,h*.92],[w*.35,h*.6],[w*.7,h*.3],[w+20,h*.12]],h*.26,kind==='graphic'?'#8f93a6':kind==='jute'?'#efe0bf':'#8b7d68',kind==='graphic'?.05:.04);
 ellipse(c,w*.47,h*.5,w*.05,h*.045,.4,kind==='graphic'?'rgba(10,12,22,.24)':'rgba(140,96,52,.13)');
}
export function drawQuilt(c,w,h,kind,p,r){
 if(kind==='gingham'){
  c.fillStyle='#f6efe2';c.fillRect(0,0,w,h);const s=22;
  for(let x=0;x<w;x+=s*2){c.fillStyle=rgba(p.second,.42);c.fillRect(x,0,s,h);}for(let y=0;y<h;y+=s*2){c.fillStyle=rgba(p.second,.42);c.fillRect(0,y,w,s);}
  speckle(c,w,h,r,2500,['#ffffff','#5d4a35'],.08);
  c.fillStyle=p.accent;c.fillRect(0,0,w,14);c.fillRect(0,h-14,w,14);c.fillRect(0,0,14,h);c.fillRect(w-14,0,14,h);
  for(const [x,y] of [[.3,.55],[.68,.42],[.5,.78]]){c.fillStyle=p.feature;c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?9:20;c.lineTo(w*x+Math.cos(a)*rr,h*y+Math.sin(a)*rr);}c.closePath();c.fill();}
 }else if(kind==='patchwork'){
  const cols=7,rows=8,pw=w/cols,ph=h/rows,fabrics=[p.dado,p.feature,p.accent,'#f3ead6',mix(p.dado,'#ffffff',.55),mix(p.ink,'#ffffff',.25),'#e9d9b6'];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const col=fabrics[Math.floor(r()*fabrics.length)],x=i*pw,y=j*ph,kind2=Math.floor(r()*5);c.fillStyle=col;c.fillRect(x,y,pw+1,ph+1);
   const fg=col==='#f3ead6'||col==='#e9d9b6'?p.dado:'rgba(255,250,238,.7)';c.fillStyle=fg;c.strokeStyle=fg;
   if(kind2===1)for(let a=6;a<pw;a+=12)for(let b=6;b<ph;b+=12){c.beginPath();c.arc(x+a+(b%24?6:0),y+b,2.2,0,Math.PI*2);c.fill();}
   else if(kind2===2){c.lineWidth=3;for(let a=5;a<pw;a+=11){c.beginPath();c.moveTo(x+a,y);c.lineTo(x+a,y+ph);c.stroke();}}
   else if(kind2===3){c.lineWidth=2;for(let a=0;a<pw+ph;a+=10){c.beginPath();c.moveTo(x+a,y);c.lineTo(x+a-ph,y+ph);c.stroke();}c.fillStyle=col;}
   else if(kind2===4){for(let a=10;a<pw;a+=20)for(let b=10;b<ph;b+=20){c.fillRect(x+a-1,y+b-5,2,10);c.fillRect(x+a-5,y+b-1,10,2);}}
  }
  c.strokeStyle='rgba(60,45,30,.35)';c.lineWidth=1.5;for(let i=1;i<cols;i++){c.beginPath();c.moveTo(i*pw,0);c.lineTo(i*pw,h);c.stroke();}for(let j=1;j<rows;j++){c.beginPath();c.moveTo(0,j*ph);c.lineTo(w,j*ph);c.stroke();}
  c.strokeStyle='rgba(255,252,240,.75)';c.setLineDash?.([4,4]);c.lineWidth=1.2;for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)c.strokeRect(i*pw+5,j*ph+5,pw-10,ph-10);c.setLineDash?.([]);
  speckle(c,w,h,r,1500,['#ffffff','#3a2d20'],.07);
 }else if(kind==='denim'){
  c.fillStyle='#5d7795';c.fillRect(0,0,w,h);
  for(let k=-h;k<w;k+=3){c.strokeStyle=k%2?'rgba(255,255,255,.07)':'rgba(10,25,50,.12)';c.lineWidth=1.4;c.beginPath();c.moveTo(k,0);c.lineTo(k+h,h);c.stroke();}
  for(let i=0;i<7;i++)radial(c,r()*w,r()*h,40+r()*90,'rgba(214,226,238,.22)','rgba(214,226,238,0)');
  c.strokeStyle='#d9a25d';c.lineWidth=2;c.setLineDash?.([6,4]);const n=4,m=5;for(let i=1;i<n;i++){c.beginPath();c.moveTo(i*w/n,0);c.lineTo(i*w/n,h);c.stroke();}for(let j=1;j<m;j++){c.beginPath();c.moveTo(0,j*h/m);c.lineTo(w,j*h/m);c.stroke();}c.setLineDash?.([]);
  c.fillStyle='#4a6280';c.fillRect(w*.58,h*.58,w*.17,h*.14);c.strokeStyle='#d9a25d';c.setLineDash?.([4,3]);c.strokeRect(w*.58+4,h*.58+4,w*.17-8,h*.14-8);c.setLineDash?.([]);
  c.fillStyle='#e9e3d6';c.fillRect(0,0,w,10);c.fillRect(0,h-10,w,10);
 }else if(kind==='jersey'){
  c.fillStyle='#3a3f4a';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=56){c.fillStyle=y/56%2?'rgba(255,255,255,.05)':'rgba(0,0,0,.08)';c.fillRect(0,y,w,28);}
  speckle(c,w,h,r,16000,['#a4aab7','#0d1016'],.32,1.4);
  c.fillStyle=p.accent;c.fillRect(0,h*.1,w,16);c.fillStyle='#e2b285';c.fillRect(0,h*.1+24,w,4);
 }else{
  c.fillStyle='#4e7477';c.fillRect(0,0,w,h);
  for(let i=0;i<500;i++){const y=r()*h;c.fillStyle=r()<.5?`rgba(255,255,255,${(.06*r()).toFixed(3)})`:`rgba(0,20,25,${(.08*r()).toFixed(3)})`;c.fillRect(0,y,w,.6+r()*1.2);}
  for(let i=0;i<46;i++){const x=r()*w,y=r()*h,a=r()*Math.PI,len=120+r()*200;c.strokeStyle='rgba(225,240,240,.17)';c.lineWidth=5+r()*8;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+Math.cos(a)*len*.5+10,y+Math.sin(a)*len*.5,x+Math.cos(a)*len,y+Math.sin(a)*len);c.stroke();c.strokeStyle='rgba(10,30,35,.16)';c.beginPath();c.moveTo(x+3,y+3);c.quadraticCurveTo(x+Math.cos(a)*len*.5+13,y+Math.sin(a)*len*.5+3,x+Math.cos(a)*len+3,y+Math.sin(a)*len+3);c.stroke();}
  c.fillStyle='#d8ccb5';c.fillRect(0,h-36,w,6);c.fillRect(0,h-24,w,3);
 }
 // The corner nearest the room is the one sat on to put shoes on.
 radial(c,w*.97,h*.96,w*.48,kind==='jersey'||kind==='linen'||kind==='denim'?'rgba(232,226,214,.45)':'rgba(255,250,240,.42)','rgba(255,250,240,0)');
 speckle(c,w*.25,h*.22,r,500,['#ffffff'],.4,1.4);
}
export function drawThrow(c,w,h,kind,colour,r){
 c.fillStyle=colour;c.fillRect(0,0,w,h);
 const dark=rgba(mix(colour,'#000000',.45),.4),light=rgba(mix(colour,'#ffffff',.5),.45);
 if(kind==='cable'||kind==='chunky'){const s=kind==='chunky'?22:11;
  for(let x=0;x<w;x+=s)for(let y=0;y<h;y+=s*.8){c.strokeStyle=dark;c.lineWidth=s*.16;c.beginPath();c.moveTo(x+s*.1,y);c.lineTo(x+s*.5,y+s*.65);c.lineTo(x+s*.9,y);c.stroke();c.strokeStyle=light;c.lineWidth=s*.12;c.beginPath();c.moveTo(x+s*.18,y+s*.05);c.lineTo(x+s*.5,y+s*.55);c.stroke();}
  if(kind==='cable')for(let x=40;x<w;x+=110){for(let y=-20;y<h;y+=36){c.strokeStyle=dark;c.lineWidth=7;c.beginPath();c.moveTo(x-12,y);c.bezierCurveTo(x+16,y+12,x+16,y+24,x-12,y+36);c.stroke();c.strokeStyle=light;c.lineWidth=5;c.beginPath();c.moveTo(x+12,y+18);c.bezierCurveTo(x-16,y+30,x-16,y+42,x+12,y+54);c.stroke();}}
 }else{const s=14;c.strokeStyle=dark;c.lineWidth=3;for(let x=0;x<w;x+=s){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=s){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  c.strokeStyle=light;c.lineWidth=1.5;for(let x=4;x<w;x+=s){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}}
 speckle(c,w,h,r,2500,['#ffffff','#000000'],.1);
 c.fillStyle=rgba(mix(colour,'#000000',.2),.9);c.fillRect(0,0,w,8);c.fillRect(0,h-8,w,8);
}
export function drawCurtain(c,w,h,kind,p,r){
 const base={dots:p.curtain,ticking:'#f1ead8',chambray:'#a9bccb',blackout:'#6f7889',linen:'#cfc2a7'}[kind];c.fillStyle=base;c.fillRect(0,0,w,h);
 for(let i=0;i<2600;i++){c.fillStyle=r()<.5?'rgba(255,255,255,.07)':'rgba(30,25,20,.06)';if(r()<.5)c.fillRect(0,r()*h,w,.7);else c.fillRect(r()*w,0,.7,h);}
 if(kind==='dots')for(let y=16;y<h;y+=44)for(let x=(y/44%2)*22+11;x<w;x+=44){c.fillStyle=(x+y)%3?p.accent:p.second;c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fill();}
 if(kind==='ticking')for(let x=10;x<w;x+=40){c.fillStyle=p.dado;c.fillRect(x,0,4,h);c.fillRect(x+9,0,2,h);}
 if(kind==='blackout'){c.fillStyle='rgba(240,236,228,.75)';c.fillRect(0,h-14,w,14);}
 if(kind==='linen'){c.fillStyle=p.dado;c.fillRect(0,h-46,w,26);}
 // The leading edge beside the glass has faded in a year of sun.
 const g=c.createLinearGradient(w,0,w*.55,0);if(g?.addColorStop){g.addColorStop(0,kind==='blackout'?'rgba(214,210,200,.3)':'rgba(255,250,236,.28)');g.addColorStop(1,'rgba(255,250,236,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}
}
// One small wear atlas (4x4 cells) shared by every wall decal of the room.
export function drawWearAtlas(c,S,p,story,r){
 c.clearRect(0,0,S,S);const q=S/4;
 const cell=(i,fn)=>{c.save();c.translate((i%4)*q,Math.floor(i/4)*q);c.beginPath();c.rect(2,2,q-4,q-4);c.clip();fn(q);c.restore();};
 const print=(x,y,s,a)=>{ellipse(c,x,y,s*.55,s*.75,a,'rgba(82,70,58,.13)');c.strokeStyle='rgba(70,60,50,.08)';c.lineWidth=.8;for(let k=1;k<4;k++){c.beginPath();c.ellipse(x,y,s*.14*k,s*.19*k,a,0,Math.PI*2);c.stroke();}};
 cell(0,s=>{for(let i=0;i<9;i++)print(s*(.2+r()*.6),s*(.2+r()*.6),8+r()*6,r()*3);});
 cell(1,s=>{for(const [x,y,k] of [[.32,.55,1],[.68,.45,.85]]){ellipse(c,s*x,s*y,13*k,16*k,0,'rgba(92,80,66,.14)');for(let f=0;f<5;f++){const a=-2.6+f*.42+(f===0?-.35:0);ellipse(c,s*x+Math.cos(a)*24*k,s*y+Math.sin(a)*24*k,4.5*k,8*k,a+Math.PI/2,'rgba(92,80,66,.14)');}}});
 cell(2,s=>{c.lineCap='round';for(const [col,o] of [[p.accent,0],[p.second,9],[p.feature,18]]){c.strokeStyle=rgba(col,.62);c.lineWidth=3;c.beginPath();c.moveTo(s*.15,s*.5+o);for(let i=0;i<14;i++)c.lineTo(s*(.18+i*.05),s*(.38+(i%2)*.24)+o+(r()-.5)*8);c.stroke();}c.strokeStyle=rgba(p.ink,.5);c.lineWidth=2;c.beginPath();c.arc(s*.72,s*.3,13,0,Math.PI*2);c.stroke();});
 cell(3,s=>{c.lineCap='round';for(let i=0;i<22;i++){c.strokeStyle=`rgba(30,24,18,${(.16+r()*.22).toFixed(3)})`;c.lineWidth=1.5+r()*3;const x=s*r(),y=s*(.3+r()*.5);c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+8,y-3-r()*4,x+16+r()*20,y+(r()-.5)*6);c.stroke();}});
 cell(4,s=>{c.fillStyle='rgba(255,255,255,.12)';c.fillRect(s*.12,s*.1,s*.76,s*.8);for(const [x,y,a] of [[.12,.1,-.5],[.88,.1,.45],[.12,.9,.4],[.88,.9,-.5]]){c.save();c.translate(s*x,s*y);c.rotate(a);c.fillStyle='rgba(226,200,146,.75)';c.fillRect(-10,-4,20,8);c.fillStyle='rgba(250,246,236,.85)';c.fillRect(-3,-4,7,5);c.restore();}});
 cell(5,s=>{for(const [x,y] of [[.15,.12],[.85,.12],[.15,.88],[.85,.88],[.5,.5]]){ellipse(c,s*x,s*y,7+r()*3,6+r()*3,r()*3,'rgba(110,98,86,.2)');ellipse(c,s*x+1,s*y,2.5,2.2,0,'rgba(120,140,160,.6)');}});
 cell(6,s=>{c.strokeStyle='rgba(70,72,76,.5)';c.lineWidth=1.3;for(let i=0;i<4;i++){c.beginPath();c.moveTo(s*(.15+i*.06),s*.2);c.lineTo(s*(.15+i*.06),s*.38);c.stroke();}c.beginPath();c.moveTo(s*.12,s*.36);c.lineTo(s*.38,s*.22);c.stroke();c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?7:16;c.lineTo(s*.68+Math.cos(a)*rr,s*.62+Math.sin(a)*rr);}c.closePath();c.stroke();c.beginPath();c.arc(s*.3,s*.7,12,0,Math.PI*2);c.stroke();});
 cell(7,s=>{for(const [x,y] of [[.25,.2],[.7,.24],[.48,.6],[.2,.78]]){ellipse(c,s*x,s*y,7,6,r(),'rgba(255,255,255,.55)');ellipse(c,s*x,s*y,1.6,1.6,0,'rgba(40,34,28,.65)');}});
 cell(8,s=>{const g=c.createLinearGradient(0,s*.3,0,s*.7);if(g?.addColorStop){g.addColorStop(0,'rgba(60,50,40,0)');g.addColorStop(.5,'rgba(60,50,40,.13)');g.addColorStop(1,'rgba(60,50,40,0)');c.fillStyle=g;c.fillRect(0,0,s,s);}for(let i=0;i<14;i++){c.fillStyle='rgba(40,32,24,.09)';c.fillRect(s*r(),s*(.4+r()*.2),8+r()*20,1+r()*2);}});
 cell(9,s=>{c.fillStyle=rgba(p.feature,.95);c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?14:32;c.lineTo(s*.5+Math.cos(a)*rr,s*.5+Math.sin(a)*rr);}c.closePath();c.fill();c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.moveTo(s*.5,s*.5-32);c.lineTo(s*.5+8,s*.5-14);c.lineTo(s*.5-6,s*.5-12);c.closePath();c.fill();ellipse(c,s*.5,s*.5+40,22,5,0,'rgba(120,100,70,.12)');});
 cell(10,s=>{for(let i=0;i<14;i++){const a=r()*Math.PI*2,d=s*(.2+r()*.2);print(s*.5+Math.cos(a)*d,s*.5+Math.sin(a)*d*1.1,6+r()*5,r()*3);}});
 cell(11,s=>{for(const [x,y,rr] of [[.3,.35,20],[.65,.6,18],[.45,.75,15]]){c.strokeStyle='rgba(80,70,60,.16)';c.lineWidth=4;c.beginPath();c.arc(s*x,s*y,rr,0,Math.PI*2);c.stroke();ellipse(c,s*x,s*y,rr*.8,rr*.8,0,'rgba(90,80,70,.07)');}});
 cell(12,s=>{c.fillStyle=rgba(mix(story.patch||p.wall,'#ffffff',.25),.55);c.beginPath();c.moveTo(s*.12,s*.18);for(let i=0;i<=8;i++)c.lineTo(s*(.12+i*.095),s*.15+(r()-.5)*6);for(let i=0;i<=8;i++)c.lineTo(s*.88+(r()-.5)*6,s*(.15+i*.09));for(let i=8;i>=0;i--)c.lineTo(s*(.12+i*.095),s*.85+(r()-.5)*6);c.closePath();c.fill();});
 cell(13,s=>{c.fillStyle='rgba(255,255,255,.1)';c.fillRect(s*.1,s*.08,s*.8,s*.84);c.strokeStyle='rgba(90,80,70,.1)';c.lineWidth=3;c.strokeRect(s*.1,s*.08,s*.8,s*.84);ellipse(c,s*.5,s*.06,2,2,0,'rgba(40,34,28,.6)');});
 cell(14,s=>{for(let i=0;i<16;i++)ellipse(c,s*(.3+r()*.4),s*(.3+r()*.5),1+r()*3,1+r()*4,r()*3,'rgba(150,120,90,.16)');});
 cell(15,s=>{for(let i=0;i<22;i++){c.fillStyle=rgba([p.accent,p.second,p.ink][i%3],.5);c.beginPath();c.arc(s*(.2+r()*.6),s*(.2+r()*.6),1.5+r()*1.5,0,Math.PI*2);c.fill();}});
}
function drawPatina(c,S,l,stage,p,r){
 c.clearRect(0,0,S,S);const w=l.width,d=l.depth,front=l.back+d,X=x=>(x+w/2)/w*S,Y=z=>(z-l.back)/d*S,mm=v=>v/w*S;
 const young=stage==='early'||stage==='primary',chairZ=l.desk[1]+(stage==='early'?800:950);
 // Dust settles at the skirting; the window side is gently sun-bleached.
 const edge=(x0,y0,x1,y1)=>{const g=c.createLinearGradient(x0,y0,x1,y1);if(!g?.addColorStop)return;g.addColorStop(0,'rgba(55,42,30,.16)');g.addColorStop(1,'rgba(55,42,30,0)');c.fillStyle=g;c.fillRect(Math.min(x0,x1),Math.min(y0,y1),Math.abs(x1-x0)||S,Math.abs(y1-y0)||S);};
 edge(0,0,0,mm(110));edge(S,0,S-mm(110),0);edge(0,0,mm(110),0);
 const winZ=l.back+1500,light=FLOORS[CHILD_MATERIAL_STORIES[stage].floor].light,bleach=light?.06:.1;for(let k=0;k<6;k++){c.fillStyle=`rgba(255,244,214,${bleach})`;c.beginPath();c.moveTo(S,Y(winZ-700+k*70));c.lineTo(X(w/2-2300+k*170),Y(winZ-300+k*70));c.lineTo(X(w/2-2600+k*170),Y(winZ+1500-k*80));c.lineTo(S,Y(winZ+800-k*70));c.closePath();c.fill();}
 // Walking lanes from the door side to the bed and the desk chair.
 const entry=[X(w*.08),S+10],mid=[X(l.play[0]*.5),Y(front-1100)],bedSide=[X(l.bed[0]+700),Y(l.bed[1]+500)],chair=[X(l.desk[0]),Y(chairZ)];
 // Pale floors grey and dull where people walk; dark floors bleach and scuff
 // lighter; painted boards wear back to timber.
 const laneCol=stage==='preteen'?'#a88560':light?'#6d5c48':'#f1e2c8',lane=stage==='preteen'?.05:light?.04:.05;
 soft(c,[entry,mid,bedSide],mm(620),laneCol,lane);soft(c,[entry,mid,chair],mm(560),laneCol,lane);
 ellipse(c,X(l.bed[0]+720),Y(l.bed[1]+150),mm(260),mm(700),0,rgba(laneCol,lane*3.2));
 if(young){for(let i=0;i<14;i++){const a=r()*Math.PI*2,d=mm(230+r()*90);c.strokeStyle='rgba(60,45,30,.12)';c.lineWidth=1.5;c.beginPath();c.arc(chair[0]+Math.cos(a)*d,chair[1]+Math.sin(a)*d,mm(25),a,a+1.2);c.stroke();}}
 else for(let i=0;i<70;i++){const rr=mm(200+r()*420),a=r()*Math.PI*2;c.strokeStyle=r()<.65?`rgba(255,255,255,${(.05+r()*.08).toFixed(3)})`:`rgba(40,30,20,${(.04+r()*.06).toFixed(3)})`;c.lineWidth=.7+r()*1.1;c.beginPath();c.arc(chair[0],chair[1]+mm(60),rr,a,a+.25+r()*1.1);c.stroke();}
 // Heel scuffs scattered along the lanes.
 const along=(a,b,t,spread)=>[a[0]+(b[0]-a[0])*t+(r()-.5)*spread,a[1]+(b[1]-a[1])*t+(r()-.5)*spread];
 const scuffs=stage==='teen'?60:stage==='early'?26:44;for(let i=0;i<scuffs;i++){const seg=r()<.5?[mid,bedSide]:r()<.5?[entry,mid]:[mid,chair],[x,y]=along(seg[0],seg[1],r(),mm(700));c.strokeStyle=`rgba(28,22,16,${(.14+r()*.18).toFixed(3)})`;c.lineWidth=.8+r()*1.4;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+3,y-2,x+5+r()*9,y+(r()-.5)*4);c.stroke();}
 if(stage==='early'){
  for(let t=0;t<4;t++){const x0=X(l.play[0]-1300+t*600),y0=Y(l.play[1]+650+(t%2)*120);for(const o of [0,6]){c.strokeStyle='rgba(55,42,30,.3)';c.lineWidth=2;c.beginPath();c.moveTo(x0,y0+o);c.bezierCurveTo(x0+45,y0-40+o,x0+90,y0+30+o,x0+150,y0-12+o);c.stroke();}}
  for(const [dx,dz,col] of [[-500,-950,p.accent],[-300,-1000,p.second],[350,-930,p.feature],[700,820,p.accent]]){c.strokeStyle=rgba(col,.75);c.lineWidth=3.5;c.beginPath();const x=X(l.play[0]+dx),y=Y(l.play[1]+dz);c.moveTo(x,y);for(let i=1;i<7;i++)c.lineTo(x+i*5,y+(i%2?-7:6));c.stroke();}
 }else if(stage==='primary'){for(let i=0;i<12;i++){c.fillStyle=rgba([p.accent,p.dado,p.ink][i%3],.45);c.beginPath();c.arc(chair[0]+(r()-.5)*mm(500),chair[1]-mm(300)+(r()-.5)*mm(300),1.4,0,Math.PI*2);c.fill();}
  for(let i=0;i<8;i++)ellipse(c,entry[0]+(r()-.5)*mm(400),entry[1]-mm(100+r()*300),mm(18),mm(30),r(),'rgba(110,90,60,.1)');}
 else if(stage==='preteen'){for(const seg of [[entry,mid],[mid,bedSide],[mid,chair]])for(let i=0;i<22;i++){const t=r(),[x,y]=along(seg[0],seg[1],t,mm(300)*(.3+r()));ellipse(c,x,y,mm(10+r()*14),mm(60+r()*160),(r()-.5)*.08,`rgba(185,138,92,${(.2+r()*.18).toFixed(3)})`);}}
 else{const rings=stage==='college'?[[l.bed[0]+760,l.bed[1]-650],[l.desk[0]-520,l.desk[1]+150]]:[[l.bed[0]+740,l.bed[1]-700]];for(const [x,z] of rings){c.strokeStyle='rgba(92,60,30,.22)';c.lineWidth=1.6;c.beginPath();c.arc(X(x),Y(z),mm(38),0,Math.PI*1.8);c.stroke();c.strokeStyle='rgba(92,60,30,.12)';c.beginPath();c.arc(X(x)+2,Y(z)+1,mm(36),.5,Math.PI*2.2);c.stroke();}}
}

export function enhanceChildMaterials({room,root,layout:l,helpers:h,materials:m,groups}){
 const stage=CHILD_MATERIAL_STORIES[l.ageStage]?l.ageStage:'early',story=CHILD_MATERIAL_STORIES[stage],early=earlyYearsProfile(l),p={...(early?.palette||CHILD_PERSONALITY_PALETTES[stage])};
 const {bed,nook,rug,rear,left,right,floor}=groups,front=l.back+l.depth,mm=root.scale.x||.001,seed=[...l.id].reduce((a,ch)=>a*31+ch.charCodeAt(0)|0,7);
 const own=t=>{(root.ownedTextures||=[]).push(t);return t;};
 const canvasMap=(w,hh,draw,{data=false,repeat=null}={})=>{const cv=document.createElement('canvas');cv.width=w;cv.height=hh;draw(cv.getContext('2d'),w,hh,random(seed+w*7+hh));const t=new THREE.CanvasTexture(cv);if(!data)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);}t.needsUpdate=true;return own(t);};
 const lock=(mat,surface)=>{mat.userData.roomFinishLocked=true;if(surface)mat.userData.roomSurface=surface;mat.needsUpdate=true;return mat;};
 const std=(color,roughness,extra={},surface)=>lock(h.material(color,{roughness,metalness:0,...extra}),surface);
 const velvet=color=>{const v=new THREE.MeshPhysicalMaterial({color,roughness:.8,metalness:0,sheen:1,sheenRoughness:.35,sheenColor:new THREE.Color(mix(color,'#ffffff',.5))});v.userData.roomCraftFinish='velvet';return lock(v,'fabric');};
 const swap=(o,mat)=>{if(!o?.isMesh)return;o.replacedMaterials||=[];o.replacedMaterials.push(o.material);o.material=mat;};
 const recolor=(o,color,roughness)=>{if(!o?.isMesh)return;const c=o.material.clone();c.color.set(color);if(roughness!==undefined)c.roughness=roughness;swap(o,lock(c));};
 const near=(a,b,eps=.5)=>Math.abs(a-b)<eps;
 const report={stage,story:story.name,trio:story.trio,floor:story.floor,rug:story.rug,quilt:story.quilt,throw:story.throw,curtain:story.curtain,decals:0,textures:0};
 const texturesBefore=(root.ownedTextures||[]).length;

 // Fabric relief maps: tiny, tiled and shared by every soft surface here.
 const bump=kind=>bump[kind]||=canvasMap(128,128,(c,w,hh,r)=>{c.fillStyle='rgb(128,128,128)';c.fillRect(0,0,w,hh);
  if(kind==='cord'){for(let x=0;x<w;x+=8){c.fillStyle='rgb(200,200,200)';c.fillRect(x+1,0,4,hh);c.fillStyle='rgb(70,70,70)';c.fillRect(x+6,0,2,hh);}}
  else if(kind==='canvas'||kind==='twill'){for(let y=0;y<hh;y+=4)for(let x=0;x<w;x+=4){const v=kind==='twill'?((x+y)/4)%3===0:((x+y)/4)%2===0;c.fillStyle=v?'rgb(176,176,176)':'rgb(96,96,96)';c.fillRect(x,y,4,4);}}
  else if(kind==='boucle'){for(let i=0;i<900;i++){c.strokeStyle=`rgb(${150+(r()*100|0)},${150+(r()*100|0)},${150+(r()*100|0)})`;c.lineWidth=1.2;c.beginPath();c.arc(r()*w,r()*hh,1.5+r()*3,0,Math.PI*2);c.stroke();}}
  else if(kind==='stipple'){for(let i=0;i<2600;i++){const v=110+(r()*40|0);c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(r()*w,r()*hh,1+r()*2,1+r()*2);}}
 },{data:true,repeat:kind==='stipple'?[22,12]:kind==='boucle'?[5,5]:[7,7]});
 const fabric=(kind,color)=>{if(kind==='velvet')return velvet(color);const f=std(color,kind==='canvas'?.9:.96,{bumpMap:bump(kind==='cord'?'cord':kind==='boucle'?'boucle':kind==='twill'?'twill':'canvas'),bumpScale:(kind==='boucle'?.35:kind==='cord'?.3:.14)*mm},'fabric');f.userData.roomCraftFinish={cord:'corduroy',canvas:'cotton canvas',twill:'denim twill',boucle:'boucle'}[kind]||'woven';return f;};

 // ---- Walls: per-stage paint finish (chalky matt to washable eggshell dado)
 // with a faint roller stipple. Trim paint follows the stage's neutral.
 m.plaster.roughness=story.paintRough;m.plaster.bumpMap=bump('stipple');m.plaster.bumpScale=.06*mm;m.plaster.needsUpdate=true;
 m.sage.roughness=story.dadoRough;m.sage.bumpMap=bump('stipple');m.sage.bumpScale=.05*mm;m.sage.needsUpdate=true;
 m.cream.color.set(story.trim);m.cream.roughness=.5;
 if(story.limewash){m.plaster.map=canvasMap(256,256,(c,w,hh,r)=>{c.fillStyle='rgb(238,238,238)';c.fillRect(0,0,w,hh);for(let i=0;i<70;i++){const x=r()*w,y=r()*hh,rr=20+r()*70,col=r()<.6?'rgba(255,255,255,.18)':'rgba(150,140,128,.06)';for(const dx of [-w,0,w])for(const dy of [-hh,0,hh])radial(c,x+dx,y+dy,rr,col,'rgba(238,238,238,0)');}},{repeat:[3,1.6]});m.plaster.map.colorSpace=THREE.SRGBColorSpace;m.plaster.needsUpdate=true;}
 if(story.accentWall&&right){const accent=m.plaster.clone();accent.color.set(story.accentWall);accent.roughness=.86;lock(accent);for(const o of right.children)if(o.isMesh&&o.material===m.plaster)swap(o,accent);}
 // Paint base for the wall layer (child-wall-life builds after this pass).
 report.paint={wall:p.wall,dado:p.dado,feature:p.feature,trim:story.trim,accentWall:story.accentWall||null,finish:story.limewash?'limewash':story.paintRough>=.95?'chalky matt':'flat matt',roughness:story.paintRough,dadoRoughness:story.dadoRough};

 // ---- Floor: one plank texture per stage, four orientations per board so
 // repeated figure never lines up; a single patina layer carries a year of use.
 const planks=floor?.children.find(o=>o.isInstancedMesh);
 if(planks){
  const f=FLOORS[story.floor],map=canvasMap(128,512,(c,w,hh,r)=>drawPlank(c,w,hh,story.floor,r));
  const mat=planks.material;mat.map=map;mat.bumpMap=map;mat.bumpScale=.22*mm;mat.color.set('#ffffff');mat.roughness=f.rough;mat.userData.roomFinishLocked=true;mat.userData.roomCraftFinish=story.floor+' boards';mat.needsUpdate=true;
  const r=random(seed+11),turn=[new THREE.Quaternion(),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI)];
  const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),tone=new THREE.Color();
  for(let i=0;i<planks.count;i++){planks.getMatrixAt(i,matrix);matrix.decompose(pos,q,scale);matrix.compose(pos,turn[Math.floor(r()*4)],scale);planks.setMatrixAt(i,matrix);const v=1-f.tint+r()*f.tint*1.6,warm=(r()-.5)*f.tint*.5;tone.setRGB(v+warm,v,v-warm);planks.setColorAt(i,tone);}
  planks.instanceMatrix.needsUpdate=true;if(planks.instanceColor)planks.instanceColor.needsUpdate=true;
  const patina=h.mesh(floor,new THREE.PlaneGeometry(l.width,l.depth),std('#ffffff',.85,{map:canvasMap(512,512,(c,w,hh,r)=>drawPatina(c,w,l,stage,p,r)),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),[0,.6,l.back+l.depth/2]);
  patina.rotation.x=-Math.PI/2;patina.name='Floor patina · a year of use';patina.castShadow=false;patina.receiveShadow=true;patina.userData.presentationOnly=true;patina.userData.dropSurface=false;patina.raycast=()=>{};
 }

 // ---- Furniture timber: stage species tone, grain and rubbed edges.
 m.oak.map=canvasMap(256,256,(c,w,hh,r)=>drawTimber(c,w,hh,r));m.oak.color.set(story.wood);m.oak.roughness=story.woodRough;m.oak.userData.roomCraftFinish={early:'birch',primary:'honey oak',preteen:'limed oak',teen:'smoked oak',college:'oiled walnut'}[stage];m.oak.needsUpdate=true;
 // The tall wardrobe carcass was trim paint and read as a blank block in the
 // larger rooms; it takes the stage timber, its painted doors stay.
 root.traverse(o=>{if(o.userData.propId==='personal-wardrobe')for(const c of o.children)if(c.isMesh&&c.material===m.cream)c.material=m.oak;});
 // Upholstery that used to be the shared sage now follows the stage.
 m.green.color.set(story.upholstery||p.cloth);

 // ---- Play rug: a stage pattern on a fine-segmented body whose front
 // corner has curled up a little; flat borders are painted into the weave.
 const rw=l.tier?2200:1750,rd=l.tier?1700:1300,curlR=230,curl=(x,z)=>{const s=(rw/2-x)+(rd/2-z);return s<curlR?30*(1-s/curlR)**2:0;};
 if(rug){
  const body=rug.children.find(o=>{if(!o.isMesh||!o.geometry)return false;o.geometry.computeBoundingBox();const s=o.geometry.boundingBox.getSize(new THREE.Vector3());return near(s.y,8,.05)&&near(s.x,rw,1);});
  for(const o of [...rug.children])if(o.isMesh&&o.material===m.green)o.visible=false;
  for(const o of [...rug.children])if(o.isMesh&&o.geometry?.type==='PlaneGeometry'&&!o.name&&near(o.position.y,9.1,.05))o.visible=false;
  if(body){
   const rugMap=canvasMap(768,576,(c,w,hh,r)=>drawRug(c,w,hh,story.rug,{...p,dado:p.dado},r,!!early));
   const geo=new THREE.BoxGeometry(rw,8,rd,44,1,34),pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,pos.getY(i)+curl(pos.getX(i),pos.getZ(i)));geo.computeVertexNormals();
   const old=body.geometry;body.geometry=geo;let used=false;root.traverse(o=>{if(o.geometry===old)used=true;});if(!used)old.dispose();
   swap(body,std('#ffffff',.98,{map:rugMap,bumpMap:rugMap,bumpScale:.4*mm},'fabric'));body.material.userData.roomCraftFinish=story.rug+' rug';body.name='Play rug · '+story.rug;
   if(story.rug==='kilim'||story.rug==='beni'){
    // Knotted fringe at the two short ends, following the curl.
    const fringeMap=canvasMap(64,64,(c,w,hh,r)=>{c.clearRect(0,0,w,hh);for(let x=1;x<w;x+=3){c.strokeStyle=`rgba(240,230,208,${(.85+r()*.15).toFixed(2)})`;c.lineWidth=1.6;c.beginPath();c.moveTo(x,0);c.lineTo(x+(r()-.5)*3,hh*(.7+r()*.3));c.stroke();}});fringeMap.wrapT=THREE.RepeatWrapping;fringeMap.wrapS=THREE.RepeatWrapping;
    const parts=[];for(const side of [-1,1]){const g=new THREE.PlaneGeometry(rd-20,70,17,1);g.rotateX(-Math.PI/2);g.rotateY(Math.PI/2*side);g.translate(side*(rw/2+33),1.2,0);const gp=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<gp.count;i++){gp.setY(i,gp.getY(i)+curl(Math.min(gp.getX(i),rw/2),gp.getZ(i)));uv.setX(i,uv.getX(i)*(rd/120));}parts.push(g);}
    const merged=mergePlanes(parts);const fringe=h.mesh(rug,merged,std('#ffffff',.95,{map:fringeMap,alphaTest:.45,side:THREE.DoubleSide},'fabric'),[0,0,0]);fringe.name='Rug fringe';fringe.castShadow=false;fringe.userData.presentationOnly=true;fringe.userData.dropSurface=false;
   }
  }
 }

 // ---- Bed: quilt cover, sheet, pillows, headboard and throw by stage.
 const quilt=bed?.children.find(o=>o.isMesh&&near(o.position.y,361,.1));
 if(quilt){const map=canvasMap(512,512,(c,w,hh,r)=>{drawQuilt(c,w,hh,story.quilt,p,r);c.fillStyle=story.sheet;c.beginPath();c.moveTo(w*(1-300/1110),hh);c.lineTo(w,hh);c.lineTo(w,hh*(1-300/1320));c.closePath();c.fill();});const qb=canvasMap(256,256,(c,w,hh,r)=>{c.fillStyle='rgb(150,150,150)';c.fillRect(0,0,w,hh);c.strokeStyle='rgb(70,70,70)';c.lineWidth=2;
  if(story.quilt==='gingham'){for(let k=-hh;k<w;k+=42){c.beginPath();c.moveTo(k,0);c.lineTo(k+hh,hh);c.moveTo(k+hh,0);c.lineTo(k,hh);c.stroke();}}
  else if(story.quilt==='patchwork'){for(let x=0;x<=w;x+=w/7){c.beginPath();c.moveTo(x,0);c.lineTo(x,hh);c.stroke();}for(let y=0;y<=hh;y+=hh/8){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}}
  else if(story.quilt==='denim'){for(let x=0;x<=w;x+=w/4){c.beginPath();c.moveTo(x,0);c.lineTo(x,hh);c.stroke();}for(let y=0;y<=hh;y+=hh/5){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}}
  else for(let i=0;i<60;i++){c.strokeStyle=`rgb(${90+(r()*90|0)},${90+(r()*90|0)},${90+(r()*90|0)})`;c.lineWidth=1+r()*3;const x=r()*w,y=r()*hh,a=r()*Math.PI;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*30,y+Math.sin(a)*30);c.stroke();}
 },{data:true});swap(quilt,std('#ffffff',story.quilt==='jersey'?.9:.95,{map,bumpMap:qb,bumpScale:.35*mm},'fabric'));quilt.material.userData.roomCraftFinish=story.quilt+' cover';
  // The foot corner nearest the room is turned back, showing the lining.
  const top=(x,z)=>377+4*Math.sin(x*.009)*Math.sin((z+230)*.009)-5*Math.pow(Math.abs(x)/555,10)-3*Math.pow(Math.abs(z-300)/660,10)+9;
  const pts=[[255,960],[555,660],[265,670]],fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(pts.flatMap(([x,z])=>[x,top(x,z),z]),3));fg.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1],2));fg.setIndex([0,1,2]);fg.computeVertexNormals();
  const flap=h.mesh(bed,fg,std({early:'#f3e6cf',primary:p.feature,preteen:'#ebe4d6',teen:p.accent,college:'#d8ccb5'}[stage],.95,{side:THREE.DoubleSide},'fabric'));flap.name='Quilt corner turned back';flap.castShadow=false;flap.userData.presentationOnly=true;flap.position.set(0,0,0);
 }
 const sheet=std(story.sheet,.95,{bumpMap:m.linen.bumpMap||null,bumpScale:.1*mm},'fabric');
 for(const o of bed?.children||[]){
  if(!o.isMesh)continue;
  if(near(o.position.y,267.5,.2))swap(o,sheet);
  else if(near(o.position.z,-760,.2)&&near(o.position.y,390,.2))recolor(o,story.pillows[o.position.x<0?0:1],.96);
  else if(story.headboard&&near(o.position.y,590,.2)&&near(o.position.z,-955,.2))swap(o,fabric(story.headboard.kind,story.headboard.color));
 }
 bed?.traverse(o=>{if(o.isMesh&&o.geometry?.parameters?.width===1060&&o.geometry.parameters.depth===140)swap(o,sheet);if(o.isMesh&&o.geometry?.type==='TubeGeometry'&&o.parent?.name==='Soft quilt · padded crown and stitched edge')recolor(o,story.quilt==='jersey'||story.quilt==='linen'?'#d8ccb5':p.accent,.9);});
 const throwMesh=root.getObjectByName('Woven throw following quilt crown');
 const throwColour={early:p.cloth,primary:p.cloth,preteen:p.cloth,teen:p.accent,college:'#d8ccb6'}[stage];
 if(throwMesh){const map=canvasMap(512,256,(c,w,hh,r)=>drawThrow(c,w,hh,story.throw,throwColour,r));swap(throwMesh,std('#ffffff',.97,{map,bumpMap:map,bumpScale:.3*mm,side:THREE.DoubleSide},'fabric'));throwMesh.material.userData.roomCraftFinish=story.throw+' throw';
  const bedding=throwMesh.parent;for(const o of bedding.children)if(o.isMesh&&o!==throwMesh&&near(o.position.x,285,.5)&&near(o.position.y,423,.5))swap(o,fabric(story.cushion,{early:p.accent,primary:p.dado,preteen:p.accent,teen:'#b8664f',college:'#c08a5a'}[stage]));}
 // ---- Reading cushion and its bolster.
 for(const o of nook?.children||[]){if(!o.isMesh)continue;
  if(near(o.position.y,75,.2)&&near(o.position.z,0,.2))swap(o,fabric(story.nook,{early:p.cloth,primary:mix(p.cloth,'#c99a3a',.25),preteen:'#5f7896',teen:'#2f3b59',college:'#ddd3c2'}[stage]));
  else if(near(o.position.y,190,.2)&&near(o.position.z,-220,.2))swap(o,fabric(stage==='teen'?'velvet':'canvas',{early:'#efe3cd',primary:p.accent,preteen:'#e7d9c9',teen:'#b8664f',college:'#4e7477'}[stage]));
 }
 // ---- Curtains: one shared print; the front panel's UVs are mirrored so
 // both faded leading edges sit beside the glass.
 const windowZ=l.back+1500,curtains=[];right?.traverse(o=>{if(o.isMesh&&o.geometry?.type==='PlaneGeometry'&&o.geometry.parameters.width===260&&o.material?.userData.roomSurface==='fabric')curtains.push(o);});
 if(curtains.length){const curtainMat=std('#ffffff',story.curtain==='blackout'?.9:.97,{map:canvasMap(256,512,(c,w,hh,r)=>drawCurtain(c,w,hh,story.curtain,p,r)),side:THREE.DoubleSide},'fabric');curtainMat.userData.roomCraftFinish=story.curtain+' curtain';
  for(const o of curtains){if(o.position.z>windowZ){const uv=o.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));uv.needsUpdate=true;}swap(o,curtainMat);}}

 // ---- Wall wear: scuffs at the skirting, fingerprints by the switch and
 // stage-specific marks. All quads share one atlas and merge per wall.
 const atlas=canvasMap(512,512,(c,S,_,r)=>drawWearAtlas(c,S,p,{patch:stage==='preteen'?p.dado:p.wall},r));
 const decalMat=std('#ffffff',.9,{map:atlas,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
 const bay=[l.bed[0]-660,l.bed[0]+660],rearOffset=(x,y,hh)=>y+hh/2<=100?20.8:y-hh/2>=100&&y+hh/2<=880?12.8:y-hh/2>=1010&&x>bay[0]&&x<bay[1]?10.9:2;
 const winLo=windowZ-1050,winHi=windowZ+1050;
 const decals={rear:[],right:[],left:[]};
 const add=(wall,a,y,w,hh,cell)=>{if(wall==='right'&&y+hh/2>800&&a+w/2>winLo&&a-w/2<winHi)return;decals[wall].push({a,y,w,hh,cell});};
 // Walls (child-wall-life) owns everything above the skirting zone; this
 // layer keeps to scuffs at shoe height and the switch smudges it placed.
 add('rear',l.bed[0]+980,230,420,220,3);add('rear',l.desk[0]-300,230,460,220,3);add('rear',l.desk[0]+500,250,300,200,14);add('right',front-1600,170,420,300,3);add('right',front-2300,150,300,260,3);add('right',front-130,1080,230,230,10);add('left',front-900,150,420,260,3);
 const quad=(wall,{a,y,w,hh,cell})=>{const u0=(cell%4)/4+.004,u1=(cell%4+1)/4-.004,v1=1-Math.floor(cell/4)/4-.004,v0=1-(Math.floor(cell/4)+1)/4+.004;
  if(wall==='rear'){const z=l.back+rearOffset(a,y,hh);return {p:[[a-w/2,y-hh/2,z],[a+w/2,y-hh/2,z],[a+w/2,y+hh/2,z],[a-w/2,y+hh/2,z]],n:[0,0,1],uv:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]};}
  if(wall==='right'){const x=l.width/2-2;return {p:[[x,y-hh/2,a+w/2],[x,y-hh/2,a-w/2],[x,y+hh/2,a-w/2],[x,y+hh/2,a+w/2]],n:[-1,0,0],uv:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]};}
  const x=-l.width/2+(y+hh/2<=100?20.8:2);return {p:[[x,y-hh/2,a-w/2],[x,y-hh/2,a+w/2],[x,y+hh/2,a+w/2],[x,y+hh/2,a-w/2]],n:[1,0,0],uv:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]};};
 for(const [wall,parent] of [['rear',rear],['right',right],['left',left]]){const list=decals[wall];if(!list.length||!parent)continue;
  const pos=[],nor=[],uv=[],idx=[];list.forEach((d,i)=>{const q=quad(wall,d);q.p.forEach(v=>pos.push(...v));for(let k=0;k<4;k++)nor.push(...q.n);q.uv.forEach(v=>uv.push(...v));idx.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  const o=h.mesh(parent,g,decalMat,[0,0,0]);o.name='Wall wear · '+wall;o.castShadow=false;o.receiveShadow=true;o.userData.presentationOnly=true;o.userData.dropSurface=false;o.raycast=()=>{};report.decals+=list.length;}
 // A light switch by the door edge of the right wall, with its smudges.
 if(right){const plate=std('#f3f0e8',.38),rocker=std('#e7e3da',.32);const sw=new THREE.Group();sw.name='Light switch · fingerprinted plate';sw.userData.presentationOnly=true;sw.position.set(l.width/2,1080,front-130);right.add(sw);h.box(sw,[7,84,84],[-3.5,0,0],plate,2);h.box(sw,[5,34,20],[-8.5,0,0],rocker,1.5);}

 report.textures=(root.ownedTextures||[]).length-texturesBefore;
 root.userData.childMaterials=report;
 return report;
}
function mergePlanes(list){const pos=[],nor=[],uv=[],idx=[];let base=0;for(const g of list){const gp=g.attributes.position,gn=g.attributes.normal,gu=g.attributes.uv;for(let i=0;i<gp.count;i++){pos.push(gp.getX(i),gp.getY(i),gp.getZ(i));nor.push(gn.getX(i),gn.getY(i),gn.getZ(i));uv.push(gu.getX(i),gu.getY(i));}for(const i of g.index.array)idx.push(i+base);base+=gp.count;g.dispose();}
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));out.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));out.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));out.setIndex(idx);out.computeVertexNormals();return out;}
